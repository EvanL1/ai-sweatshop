# Management Dashboard Design

## Overview

Add economic/management analytics to the AI Sweatshop dashboard by restructuring the sidebar into two tabs (**👤 人力** and **📋 项目**) and adding workstation heatmap coloring to the pixel art canvas.

## Features

### F1: Sidebar Tab System

Split the existing sidebar into two tabs sharing a common header (title, status, mode toggles, budget bar, economy panel) and footer (event feed).

- **👤 人力 tab** — Enhanced version of current agent card list
- **📋 项目 tab** — New project-level aggregation view

Tab state stored in Zustand (`sidebarTab: 'people' | 'project'`). Default: `people`.

### F2: Enhanced Agent Card (人力 tab)

Current agent card already shows `✏️ N 📖 N ⚡ N`. Add:

- **Edit ratio** — `edits / (edits + reads + runs)` as a percentage badge. Color-coded: green (>40%), yellow (15-40%), red (<15%), gray (no data).
- **Turn count** — `N 轮` shown in the stats row.

No ranking, no scores. Just facts.

### F3: Project Summary Cards (项目 tab)

Derive project summaries by grouping `Object.values(workers)` by `worker.project`. Each project card shows:

```
┌──────────────────────────────┐
│ sweatshop                     │
│ ✏️ 42 · 📖 138 · ⚡ 27        │  ← sum of all agents' toolCalls
│ 密度 31% · 3人 · 7轮         │  ← edit ratio, agent count, total turns
│ Claude, Explorer, Reviewer   │  ← agent names
│ 协作: Claude → Explorer ×1   │  ← cloneLinks within this project
└──────────────────────────────┘
```

Computed as a `useMemo` selector from workers + cloneLinks. Not stored in the store.

Sorting: projects with active agents (typing/running) first, then by total tool calls descending.

### F4: Turn Tracking

**Bridge change:** Add `turnsCompleted: number` to each agent object in the `agents` Map. Increment on `Stop` event (a turn = one `UserPromptSubmit → Stop` cycle). Broadcast via existing `agent:status` event (no new event type needed — the frontend can detect `status === 'idle'` after a Stop and increment locally too).

Simpler approach: bridge increments `turnsCompleted` on `Stop`, includes it in the `agent:status` broadcast payload. Frontend `AgentWorker` gets a new `turnsCompleted: number` field, updated from the `agent:status` event when the bridge sends it.

**Frontend:** `serverAgentToWorker()` initializes `turnsCompleted: 0`. The `agent:status` handler checks for a `turns` field in the event and updates the worker.

### F5: Workstation Heatmap

Color the workstation desk area in the pixel art based on the agent's cumulative edit ratio.

Calculation: `editRatio = toolCalls.edits / (toolCalls.edits + toolCalls.reads + toolCalls.runs)`

Colors (drawn as a semi-transparent overlay on the desk rectangle in Worker.tsx):
- `editRatio >= 0.4` → green glow (`0x22c55e`, alpha 0.15)
- `editRatio >= 0.15` → blue glow (`0x60a5fa`, alpha 0.15)
- `editRatio < 0.15 && total > 0` → orange glow (`0xf97316`, alpha 0.15)
- `total === 0 || offduty` → no glow

The glow is a rounded rectangle drawn behind the worker sprite, slightly larger than the desk. It updates reactively as `toolCalls` changes.

### F6: Collaboration Cost in Project View

Within each project card (F3), show sub-agent contribution breakdown:

- Count how many cloneLinks exist where both parent and child share the same `project`
- Show each sub-agent's `toolCalls` inline: `└─ Explorer: ✏️ 0 📖 22 ⚡ 3`
- If a sub-agent has 0 edits, it's a "research-only" contributor — visually dimmed

This is purely derived from existing `cloneLinks` + `workers` data. No new state needed.

## Data Flow Changes

### Bridge (server/bridge.mjs)

1. Add `turnsCompleted: 0` to agent creation (SessionStart, auto-register in PreToolUse)
2. In `Stop` handler: `agent.turnsCompleted = (agent.turnsCompleted || 0) + 1`
3. Include `turns: agent.turnsCompleted` in the `agent:status` broadcast payload for Stop events
4. Include `turnsCompleted` in the agent object sent with `agent:start`, `snapshot`

### Frontend (useAgentSocket.ts)

1. Add `turnsCompleted: number` to `ServerAgent` type
2. In `serverAgentToWorker()`: initialize `turnsCompleted: agent.turnsCompleted || 0`
3. In `agent:status` handler: if `event.turns !== undefined`, update `worker.turnsCompleted`

### Types (types.ts)

1. Add `turnsCompleted: number` to `AgentWorker`

### Store (store.ts)

1. Add `sidebarTab: 'people' | 'project'` to state
2. Add `setSidebarTab` action
3. Initialize `turnsCompleted: 0` in `spawnClone`

## UI Components

### New: `src/sidebar/TabBar.tsx`

Simple two-button tab bar component. Reads/writes `sidebarTab` from store.

### New: `src/sidebar/ProjectTab.tsx`

Contains `ProjectCard` component. Uses `useMemo` to derive project summaries from workers.

### Modified: `src/sidebar/Sidebar.tsx`

- Add TabBar below header/budget section
- Conditionally render people tab (existing agent tree) or project tab based on `sidebarTab`
- Event feed stays below both tabs

### Modified: `src/sidebar/AgentCard.tsx`

- Add edit ratio badge (colored percentage)
- Add turn count to stats row

### Modified: `src/office/Worker.tsx`

- Add heatmap glow rectangle behind the desk, colored by edit ratio
- Add `worker.toolCalls` to draw callback dependencies (already done)

### Modified: `src/agents/mockData.ts`

- Add `turnsCompleted: 0` to mock workers

## File Change Summary

| File | Change |
|------|--------|
| `server/bridge.mjs` | Add `turnsCompleted`, include in broadcasts |
| `src/agents/types.ts` | Add `turnsCompleted` to `AgentWorker` |
| `src/agents/store.ts` | Add `sidebarTab` state + action, init `turnsCompleted` |
| `src/agents/mockData.ts` | Add `turnsCompleted` to mocks |
| `src/hooks/useAgentSocket.ts` | Handle `turnsCompleted` from server events |
| `src/sidebar/TabBar.tsx` | **New** — tab switcher |
| `src/sidebar/ProjectTab.tsx` | **New** — project summary cards |
| `src/sidebar/Sidebar.tsx` | Add tab system, conditional rendering |
| `src/sidebar/AgentCard.tsx` | Add edit ratio badge + turn count |
| `src/office/Worker.tsx` | Add heatmap glow |

## Out of Scope

- Real API token usage (hook payloads don't expose this)
- Per-turn tool breakdown history (only turn count, per decision)
- Ranking or scoring systems (removed intentionally)
- Furniture-bound data views (all analytics go to sidebar)
