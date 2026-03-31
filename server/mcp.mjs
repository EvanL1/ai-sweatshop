import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

// Import bridge state (starts the HTTP + WS server as side effect)
const bridgePath = new URL('./bridge.mjs', import.meta.url).pathname
const bridge = await import(bridgePath)

// The bridge populates `agents` Map via handleHookEvent
// We need to access it — re-import the module's agents map
// Since bridge.mjs uses module-level state, we access it through the HTTP API
const BRIDGE_URL = `http://localhost:${process.env.SWEATSHOP_PORT || 7777}`

async function getAgents() {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/agents`)
    return await res.json()
  } catch {
    return []
  }
}

// --- MCP Server ---
const server = new McpServer({
  name: 'sweatshop',
  version: '0.1.0',
})

// Tool: list all agents in the office
server.tool(
  'list_agents',
  'List all AI agents currently in the pixel office. Shows who is working, idle, or has errors.',
  {},
  async () => {
    const agents = await getAgents()
    if (agents.length === 0) {
      return { content: [{ type: 'text', text: 'The office is empty. No agents are currently working.' }] }
    }

    const lines = agents.map(a => {
      const role = a.parentId ? '👷' : '👔'
      const name = a.name || a.project || a.id.slice(0, 8)
      return `${role} ${name} [${a.status}] — ${a.currentTask} (${a.project})`
    })

    const port = process.env.SWEATSHOP_PORT || 7777
    return {
      content: [{
        type: 'text',
        text: `🏭 Sweatshop Office — ${agents.length} agent(s)\n\n${lines.join('\n')}\n\n📺 Open pixel office: http://localhost:${port}`,
      }],
    }
  }
)

// Tool: get specific agent details
server.tool(
  'agent_status',
  'Get detailed status of a specific agent by name or project.',
  { query: z.string().describe('Agent name, project name, or partial ID to search for') },
  async ({ query }) => {
    const agents = await getAgents()
    const q = (query || '').toLowerCase()
    const matches = agents.filter(a =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.project || '').toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
    )

    if (matches.length === 0) {
      return { content: [{ type: 'text', text: `No agent matching "${query}" found.` }] }
    }

    const details = matches.map(a => {
      const name = a.name || a.project || a.id.slice(0, 8)
      return [
        `Name: ${name}`,
        `Status: ${a.status}`,
        `Task: ${a.currentTask}`,
        `Project: ${a.project}`,
        `Type: ${a.agentType}`,
        `Parent: ${a.parentId ? 'sub-agent' : 'main'}`,
        `Started: ${new Date(a.startedAt).toLocaleTimeString()}`,
      ].join('\n')
    })

    return { content: [{ type: 'text', text: details.join('\n---\n') }] }
  }
)

// Tool: get office summary / stats
server.tool(
  'office_summary',
  'Get a summary of the office: total agents, active vs idle, projects being worked on.',
  {},
  async () => {
    const agents = await getAgents()
    const active = agents.filter(a => ['typing', 'running', 'reading'].includes(a.status))
    const idle = agents.filter(a => a.status === 'idle')
    const errors = agents.filter(a => a.status === 'error')
    const projects = [...new Set(agents.map(a => a.project))]
    const subs = agents.filter(a => a.parentId)

    return {
      content: [{
        type: 'text',
        text: [
          `🏭 Office Summary`,
          `Total: ${agents.length} agents`,
          `Active: ${active.length} | Idle: ${idle.length} | Errors: ${errors.length}`,
          `Teams: ${agents.length - subs.length} leads + ${subs.length} sub-agents`,
          `Projects: ${projects.join(', ')}`,
          ``,
          `Web UI: http://localhost:${process.env.SWEATSHOP_PORT || 7777}`,
        ].join('\n'),
      }],
    }
  }
)

// Resource: office web UI URL
server.resource(
  'office-url',
  'sweatshop://office',
  async () => ({
    contents: [{
      uri: 'sweatshop://office',
      mimeType: 'text/plain',
      text: `http://localhost:${process.env.SWEATSHOP_PORT || 7777}`,
    }],
  })
)

// Start MCP server on stdio
const transport = new StdioServerTransport()
await server.connect(transport)
