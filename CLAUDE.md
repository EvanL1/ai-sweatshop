# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

AI Sweatshop is a pixel-art monitoring dashboard that visualizes AI coding agents (Claude Code, Codex, Gemini CLI) as pixel-art office workers. It hooks into Claude Code events, pushes them through a bridge server via WebSocket, and renders an animated PixiJS office in the browser.

## Commands

```bash
npm run dev        # Vite dev server with HMR (frontend only, port 5173)
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint (TS/TSX files only)
npm start          # Start bridge server + open browser (needs build first)
```

The bridge server runs on `localhost:7777` (configurable via `SWEATSHOP_PORT`). During development, the frontend dev server connects to the bridge via WebSocket on port 7777.

## Architecture

```
bin/ai-sweatshop.mjs     CLI entry — injects hooks into ~/.claude/settings.json, starts bridge
  ├── server/bridge.mjs   HTTP + WebSocket server (~310 lines, plain Node.js, no framework)
  │   ├── POST /events    Receives Claude Code hook payloads (SessionStart, PreToolUse, etc.)
  │   ├── GET /api/agents JSON snapshot of all tracked agents
  │   └── WebSocket       Broadcasts agent:start/status/end/update events to browser
  └── server/mcp.mjs      MCP server (stdio) — exposes list_agents, agent_status, office_summary tools
```

```
src/
  agents/
    types.ts              Core types: AgentWorker, AgentStatus, AgentType, WorkerLevel, salary/token rates
    store.ts              Zustand store — single source of truth for all frontend state
    events.ts             Random office events system (coffee breaks, bugs, promotions)
    mockData.ts           Grid positioning, demo workers
  hooks/
    useAgentSocket.ts     WebSocket client — connects to bridge, maps server events to store actions
  office/                 PixiJS rendering components (OfficeCanvas, Worker, SpeechBubble, TeamLines, etc.)
  sidebar/                React UI panels (AgentCard, EventFeed, ContextMenu, StatusBadge)
```

### Data Flow

1. Claude Code fires hook events (PreToolUse, SubagentStart, Stop, etc.) → HTTP POST to bridge `/events`
2. Bridge maintains `agents` Map, broadcasts typed events (`agent:start`, `agent:status`, `agent:end`) via WebSocket
3. Frontend `useAgentSocket` hook receives events, maps server agents to `AgentWorker` objects, updates Zustand store
4. PixiJS office and React sidebar reactively render from store

### Key Concepts

- **Agent naming**: main agents named after their `cwd` directory; sub-agents get `Role@project` format (e.g., `Explorer@sweatshop`)
- **Agent types**: `claude | codex | gemini | unknown` — detected from hook payload fields, env vars, or cwd heuristics
- **Worker levels**: `intern → junior → senior → lead` — affect salary multiplier and token burn rate
- **Token pool**: shared budget that drains based on agent status × salary; when exhausted, lowest-ROI clone gets auto-fired
- **Clone links**: sub-agents render connecting lines to their parent via `cloneLinks` array in store
- **Hook marker**: `__sweatshop__` field on injected hooks allows clean install/uninstall without touching other hooks

### Server-Side Notes

- `bridge.mjs` and `mcp.mjs` are plain ESM `.mjs` files (not TypeScript) — they run directly with Node.js
- MCP mode (`--mcp`) suppresses console output, imports bridge as side-effect, reads agent state via HTTP loopback
- Hook injection writes to `~/.claude/settings.json`; cleanup happens on SIGINT/SIGTERM/process exit
