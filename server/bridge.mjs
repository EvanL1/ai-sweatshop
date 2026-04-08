import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST_DIR = join(__dirname, '..', 'dist')
const PORT = process.env.SWEATSHOP_PORT || 7777
const LEDGER_URL = `http://127.0.0.1:${process.env.LEDGER_PORT || 7778}`

// --- Ledger client (fire-and-forget, graceful if offline) ---
async function submitTx(txType, agentId, amount, currency, description) {
  try {
    const res = await fetch(`${LEDGER_URL}/tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx_type: txType, agent_id: agentId, amount, currency, description }),
    })
    if (res.ok) {
      const tx = await res.json()
      broadcast({ type: 'economy:tx', tx })
    }
    return res.ok
  } catch { return false }
}

async function getLedgerBalance(agentId) {
  try {
    const res = await fetch(`${LEDGER_URL}/balance/${agentId}`)
    return res.ok ? await res.json() : null
  } catch { return null }
}

// --- Persistence ---
const SWEATSHOP_DIR = join(homedir(), '.sweatshop')
const AGENTS_FILE = join(SWEATSHOP_DIR, 'agents.json')

function loadPersistedAgents() {
  try {
    if (!existsSync(AGENTS_FILE)) return new Map()
    const raw = JSON.parse(readFileSync(AGENTS_FILE, 'utf8'))
    const map = new Map()
    for (const agent of raw) {
      // On reload all main agents start as offduty
      if (!agent.parentId) {
        map.set(agent.id, { ...agent, status: 'offduty' })
      }
    }
    return map
  } catch {
    return new Map()
  }
}

function saveAgents() {
  try {
    mkdirSync(SWEATSHOP_DIR, { recursive: true })
    // Only persist main agents (no sub-agents)
    const mainAgents = [...agents.values()].filter((a) => !a.parentId)
    writeFileSync(AGENTS_FILE, JSON.stringify(mainAgents, null, 2), 'utf8')
  } catch { /* ignore write errors */ }
}

// --- State ---
// agents map keyed by agent ID (persistent ID for mains, session ID for sub-agents)
const agents = loadPersistedAgents()
// cwd -> persistent agent ID mapping for main agents
const cwdIndex = new Map()
for (const agent of agents.values()) {
  if (agent.cwd) cwdIndex.set(agent.cwd, agent.id)
}

const wsClients = new Set()

// --- WebSocket broadcast ---
function broadcast(event) {
  const msg = JSON.stringify({ ...event, ts: Date.now() })
  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(msg)
  }
}

// --- Map hook event to sweatshop agent event ---
function handleHookEvent(data) {
  resetIdleTimer()
  const sessionId = data.session_id
  if (!sessionId) return

  const rawAgentId = data.agent_id || sessionId
  const agentType = data.agent_type || 'main'
  const event = data.hook_event_name
  // For main agents, resolve session ID to persistent ID via cwd lookup
  const isSubagentEvent = !!data.agent_id && data.agent_id !== sessionId
  const agentId = !isSubagentEvent && data.cwd && cwdIndex.has(data.cwd)
    ? cwdIndex.get(data.cwd)
    : rawAgentId

  switch (event) {
    case 'SessionStart': {
      const cwd = data.cwd
      // Check if we have a persistent agent for this cwd
      const persistentId = cwdIndex.get(cwd)
      if (persistentId && agents.has(persistentId)) {
        // Reactivate the existing persistent agent
        const existing = agents.get(persistentId)
        existing.sessionId = sessionId
        existing.agentType = detectAgentType(data)
        existing.project = extractProject(cwd)
        existing.cwd = cwd
        existing.status = 'idle'
        existing.currentTask = 'Session started'
        existing.lastSeen = Date.now()
        broadcast({ type: 'agent:wake', agentId: persistentId })
        saveAgents()
      } else if (agents.has(agentId)) {
        // Session ID collision — update in place
        const existing = agents.get(agentId)
        existing.agentType = detectAgentType(data)
        existing.project = extractProject(cwd)
        existing.cwd = cwd
      } else {
        // Brand-new agent — use stable persistent ID based on project name
        const project = extractProject(cwd)
        const persistId = `persistent-${project}`
        // If a persistent ID already exists but wasn't found via cwdIndex, remove it
        if (agents.has(persistId)) {
          agents.delete(persistId)
        }
        const newAgent = {
          id: persistId,
          sessionId,
          name: generateName(data, false),
          agentType: detectAgentType(data),
          parentId: null,
          status: 'idle',
          currentTask: 'Session started',
          project,
          cwd,
          startedAt: Date.now(),
        }
        agents.set(persistId, newAgent)
        cwdIndex.set(cwd, persistId)
        broadcast({ type: 'agent:start', agent: newAgent })
        saveAgents()
      }
      break
    }

    case 'PreToolUse': {
      const task = describeToolUse(data.tool_name, data.tool_input)
      const status = data.tool_name === 'Read' || data.tool_name === 'Grep' ? 'reading'
        : data.tool_name === 'Bash' ? 'running' : 'typing'
      if (!agents.has(agentId)) {
        // Auto-register agent on first tool use.
        // parentId cannot be reliably determined here (sessionId is this agent's
        // own session, not the parent's), so leave it null. SubagentStart will
        // patch it in with the correct parent session ID when it fires.
        agents.set(agentId, {
          id: agentId, sessionId,
          name: generateName(data, isSubagentEvent),
          agentType: detectAgentType(data),
          parentId: null,
          status, currentTask: task,
          project: extractProject(data.cwd), cwd: data.cwd,
          startedAt: Date.now(),
        })
        broadcast({ type: 'agent:start', agent: agents.get(agentId) })
      } else {
        const agent = agents.get(agentId)
        agent.status = status
        agent.currentTask = task
      }
      broadcast({ type: 'agent:status', agentId, status, task })
      break
    }

    case 'PostToolUse': {
      const agent = agents.get(agentId)
      if (agent) {
        agent.status = 'idle'
        agent.currentTask = `Done: ${data.tool_name}`
        agent.tasksCompleted = (agent.tasksCompleted || 0) + 1
        broadcast({ type: 'agent:status', agentId, status: 'idle', task: agent.currentTask, toolName: data.tool_name })
        broadcast({ type: 'agent:task_completed', agentId })
      }
      // Ledger: reward coins based on tool type
      const toolRewards = { Write: 50000, Edit: 50000, Bash: 40000, Read: 15000, Grep: 15000, Glob: 15000, Agent: 80000 }
      const reward = toolRewards[data.tool_name] || 20000
      submitTx('task_reward', agentId, reward, 'coin', `Completed ${data.tool_name}`).catch(() => {})
      break
    }

    case 'PostToolUseFailure': {
      const agent = agents.get(agentId)
      if (agent) {
        agent.status = 'error'
        agent.currentTask = `Error: ${data.tool_name}`
        broadcast({ type: 'agent:status', agentId, status: 'error', task: agent.currentTask })
      }
      break
    }

    case 'SubagentStart': {
      const subId = data.agent_id
      if (!subId) break  // no agent_id means we can't distinguish from main session
      // Resolve parent: sessionId here is the parent's session_id; find persistent ID
      const parentPersistentId = cwdIndex.get(data.cwd) ?? sessionId
      if (agents.has(subId)) {
        // Sub-agent was auto-registered by an early PreToolUse without knowing its
        // parent. Now that we have the parent context (sessionId = parent's session),
        // patch in the correct parentId.
        const existing = agents.get(subId)
        existing.parentId = parentPersistentId
        existing.name = generateName(data, true)
        broadcast({ type: 'agent:update', agent: existing })
      } else {
        agents.set(subId, {
          id: subId, sessionId,
          name: generateName(data, true),
          agentType: detectAgentType(data),
          parentId: parentPersistentId,
          status: 'running',
          currentTask: `Subagent ${data.agent_type} starting...`,
          project: extractProject(data.cwd), cwd: data.cwd,
          startedAt: Date.now(),
        })
        broadcast({ type: 'agent:start', agent: agents.get(subId), parentId: parentPersistentId })
      }
      break
    }

    case 'SubagentStop': {
      const subId = data.agent_id
      broadcast({ type: 'agent:end', agentId: subId })
      agents.delete(subId)
      submitTx('collab_bonus', subId, 200000, 'coin', 'Sub-agent task completed').catch(() => {})
      break
    }

    case 'Stop': {
      // Claude finished a turn — agent goes idle, NOT removed
      const agent = agents.get(agentId)
      if (agent) {
        agent.status = 'idle'
        agent.currentTask = 'Waiting for next task...'
        agent.lastSeen = Date.now()
        broadcast({ type: 'agent:status', agentId, status: 'idle', task: agent.currentTask })
      }
      submitTx('turn_bonus', agentId, 100000, 'coin', 'Turn completed').catch(() => {})
      break
    }

    case 'SessionEnd': {
      const agent = agents.get(agentId)
      if (agent && !agent.parentId) {
        // Ledger: session settlement bonus
        const tasks = agent.tasksCompleted || 0
        const bonus = Math.min(tasks * 50000, 500000)
        if (bonus > 0) submitTx('session_settle', agentId, bonus, 'coin', `Session settled (${tasks} tasks)`).catch(() => {})
        // Main agent goes offduty — persistent employee clocks out
        agent.status = 'offduty'
        agent.currentTask = '下班了'
        agent.lastSeen = Date.now()
        broadcast({ type: 'agent:sleep', agentId })
        saveAgents()
      } else {
        // Sub-agents are ephemeral — remove on session end
        broadcast({ type: 'agent:end', agentId })
        agents.delete(agentId)
      }
      break
    }

    case 'UserPromptSubmit': {
      const agent = agents.get(agentId)
      if (agent) {
        agent.status = 'reading'
        agent.currentTask = 'Processing user prompt...'
        broadcast({ type: 'agent:status', agentId, status: 'reading', task: agent.currentTask })
      }
      break
    }
  }
}

function detectAgentType(data) {
  // Check explicit agent_type field first
  const t = (data.agent_type || '').toLowerCase()
  if (t.includes('codex')) return 'codex'
  if (t.includes('gemini')) return 'gemini'
  if (t.includes('cursor')) return 'cursor'
  if (t.includes('claude')) return 'claude'

  // Check environment variables passed with the hook payload
  const env = data.env || {}
  if (env.CODEX_ENV || env.OPENAI_API_KEY) return 'codex'
  if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) return 'gemini'

  // Infer from cwd (e.g. tool-specific project paths)
  const cwd = (data.cwd || '').toLowerCase()
  if (cwd.includes('codex')) return 'codex'
  if (cwd.includes('gemini')) return 'gemini'
  if (cwd.includes('cursor')) return 'cursor'

  return 'claude'
}

function extractProject(cwd) {
  if (!cwd) return 'unknown'
  const parts = cwd.split('/')
  return parts[parts.length - 1] || 'unknown'
}

// Sub-agent type → readable role name
const ROLE_NAMES = {
  explore: 'Explorer', plan: 'Planner', 'code-reviewer': 'Reviewer',
  'security-reviewer': 'Security', architect: 'Architect', 'build-error-resolver': 'Builder',
  'go-reviewer': 'Go Review', 'tdd-guide': 'TDD Guide', 'general-purpose': 'Worker',
  'doc-updater': 'Doc Writer', 'e2e-runner': 'Tester', 'refactor-cleaner': 'Cleaner',
  'database-reviewer': 'DBA', planner: 'Planner', sage: 'Sage',
}

function generateName(data, isSubagent) {
  const project = extractProject(data.cwd)
  if (!isSubagent) return project // main agent named after project
  const t = (data.agent_type || '').toLowerCase()
  const role = ROLE_NAMES[t] || t.slice(0, 12) || 'Agent'
  return `${role}@${project}`
}

function describeToolUse(toolName, input) {
  if (!toolName) return 'Working...'
  switch (toolName) {
    case 'Bash': return `$ ${(input?.command || '').slice(0, 50)}`
    case 'Read': return `Reading ${input?.file_path?.split('/').pop() || '...'}`
    case 'Write': return `Writing ${input?.file_path?.split('/').pop() || '...'}`
    case 'Edit': return `Editing ${input?.file_path?.split('/').pop() || '...'}`
    case 'Grep': return `Searching: ${(input?.pattern || '').slice(0, 30)}`
    case 'Glob': return `Finding: ${input?.pattern || '...'}`
    case 'Agent': return `Spawning ${input?.subagent_type || 'agent'}...`
    default: return `${toolName}...`
  }
}

// --- MIME types ---
const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
}

// --- HTTP Server ---
const server = createServer(async (req, res) => {
  // POST /events — receive hook data
  if (req.method === 'POST' && req.url === '/events') {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        handleHookEvent(data)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{"ok":true}')
      } catch (e) {
        res.writeHead(400)
        res.end('{"error":"invalid json"}')
      }
    })
    return
  }

  // GET /api/agents — current state snapshot
  if (req.url === '/api/agents') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(JSON.stringify([...agents.values()]))
    return
  }

  // --- Economy proxy endpoints (forward to Rust ledger) ---
  if (req.url?.startsWith('/api/economy/balance/')) {
    const id = req.url.split('/').pop()
    const wallet = await getLedgerBalance(id)
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(wallet || { agent_id: id, diamonds: 0, coins: 0, prestige: 0 }))
    return
  }
  if (req.url === '/api/economy/stats') {
    try {
      const r = await fetch(`${LEDGER_URL}/stats`)
      const stats = await r.json()
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(JSON.stringify(stats))
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(JSON.stringify({ error: 'ledger_offline' }))
    }
    return
  }
  if (req.url === '/api/economy/chain') {
    try {
      const r = await fetch(`${LEDGER_URL}/chain`)
      const chain = await r.json()
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(JSON.stringify(chain))
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(JSON.stringify([]))
    }
    return
  }

  // Static file serving (built frontend)
  let filePath = req.url === '/' ? '/index.html' : req.url
  const fullPath = join(DIST_DIR, filePath)

  if (existsSync(fullPath)) {
    const ext = extname(fullPath)
    const mime = MIME[ext] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': mime })
    res.end(readFileSync(fullPath))
  } else {
    // SPA fallback
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(readFileSync(join(DIST_DIR, 'index.html')))
  }
})

// --- WebSocket Server ---
const wss = new WebSocketServer({ server })
wss.on('connection', (ws) => {
  wsClients.add(ws)
  // Send current state on connect
  ws.send(JSON.stringify({ type: 'snapshot', agents: [...agents.values()] }))
  ws.on('close', () => wsClients.delete(ws))
})

const isMcp = process.env.SWEATSHOP_MCP === '1'
const log = isMcp ? () => {} : console.log.bind(console)

// --- Idle auto-shutdown (skip in MCP mode — Claude Code manages that lifecycle) ---
const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
let idleTimer = null

function resetIdleTimer() {
  if (isMcp) return
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    const hasActive = [...agents.values()].some(a => a.status !== 'offduty')
    if (!hasActive && wsClients.size === 0) {
      log('💤 No active agents or viewers — shutting down.')
      saveAgents()
      process.exit(0)
    }
    // Still active — recheck later
    resetIdleTimer()
  }, IDLE_TIMEOUT_MS)
  idleTimer.unref() // don't keep process alive just for the timer
}

server.listen(PORT, () => {
  log(`🏭 Sweatshop bridge running on http://localhost:${PORT}`)
  log(`   WebSocket: ws://localhost:${PORT}`)
  log(`   Hook endpoint: POST http://localhost:${PORT}/events`)
  log(`   Auto-shutdown after ${IDLE_TIMEOUT_MS / 60000}min idle`)
  resetIdleTimer()
})

export { PORT }
