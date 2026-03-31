import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST_DIR = join(__dirname, '..', 'dist')
const PORT = process.env.SWEATSHOP_PORT || 7777

// --- State ---
const agents = new Map()  // session_id -> agent state
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
  const sessionId = data.session_id
  if (!sessionId) return

  const agentId = data.agent_id || sessionId
  const agentType = data.agent_type || 'main'
  const event = data.hook_event_name

  switch (event) {
    case 'SessionStart': {
      if (agents.has(agentId)) {
        const existing = agents.get(agentId)
        existing.agentType = detectAgentType(data)
        existing.project = extractProject(data.cwd)
        existing.cwd = data.cwd
      } else {
        // Replace any idle agent from the same cwd (same terminal, new conversation)
        const cwd = data.cwd
        for (const [oldId, old] of agents) {
          if (old.cwd === cwd && old.status === 'idle' && !old.parentId) {
            broadcast({ type: 'agent:end', agentId: oldId })
            agents.delete(oldId)
            break
          }
        }
        agents.set(agentId, {
          id: agentId,
          sessionId,
          name: generateName(data, false),
          agentType: detectAgentType(data),
          parentId: null,
          status: 'idle',
          currentTask: 'Session started',
          project: extractProject(data.cwd),
          cwd: data.cwd,
          startedAt: Date.now(),
        })
        broadcast({ type: 'agent:start', agent: agents.get(agentId) })
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
        const isSubagent = !!data.agent_id && data.agent_id !== sessionId
        agents.set(agentId, {
          id: agentId, sessionId,
          name: generateName(data, isSubagent),
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
        broadcast({ type: 'agent:status', agentId, status: 'idle', task: agent.currentTask })
        broadcast({ type: 'agent:task_completed', agentId })
      }
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
      if (agents.has(subId)) {
        // Sub-agent was auto-registered by an early PreToolUse without knowing its
        // parent. Now that we have the parent context (sessionId = parent's session),
        // patch in the correct parentId.
        const existing = agents.get(subId)
        existing.parentId = sessionId
        existing.name = generateName(data, true)
        broadcast({ type: 'agent:update', agent: existing })
      } else {
        agents.set(subId, {
          id: subId, sessionId,
          name: generateName(data, true),
          agentType: detectAgentType(data),
          parentId: sessionId,
          status: 'running',
          currentTask: `Subagent ${data.agent_type} starting...`,
          project: extractProject(data.cwd), cwd: data.cwd,
          startedAt: Date.now(),
        })
        broadcast({ type: 'agent:start', agent: agents.get(subId), parentId: sessionId })
      }
      break
    }

    case 'SubagentStop': {
      const subId = data.agent_id
      broadcast({ type: 'agent:end', agentId: subId })
      agents.delete(subId)
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
      break
    }

    case 'SessionEnd': {
      // Session truly ended — agent leaves the office
      broadcast({ type: 'agent:end', agentId })
      agents.delete(agentId)
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
const server = createServer((req, res) => {
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

server.listen(PORT, () => {
  log(`🏭 Sweatshop bridge running on http://localhost:${PORT}`)
  log(`   WebSocket: ws://localhost:${PORT}`)
  log(`   Hook endpoint: POST http://localhost:${PORT}/events`)
})

export { PORT }
