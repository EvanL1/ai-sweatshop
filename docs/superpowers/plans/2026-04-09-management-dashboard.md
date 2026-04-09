# Management Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add people/project dual-tab sidebar with edit ratio, turn tracking, collaboration cost, and workstation heatmap to the AI Sweatshop dashboard.

**Architecture:** Restructure the existing sidebar into two tabs (👤 人力 / 📋 项目) sharing common header/footer. Add `turnsCompleted` tracking from bridge through frontend. Add heatmap glow to PixiJS worker sprites based on cumulative edit ratio. All project analytics are derived (useMemo), not stored in Zustand.

**Tech Stack:** React 18, Zustand, PixiJS (@pixi/react), Vite, plain Node.js ESM (bridge server)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/agents/types.ts` | Modify | Add `turnsCompleted` to `AgentWorker`, add `editRatio()` helper |
| `src/agents/store.ts` | Modify | Add `sidebarTab` state + `setSidebarTab` action, init `turnsCompleted` |
| `src/agents/mockData.ts` | Modify | Add `turnsCompleted` to mock workers |
| `server/bridge.mjs` | Modify | Track + broadcast `turnsCompleted` on Stop events |
| `src/hooks/useAgentSocket.ts` | Modify | Handle `turns` field from server, add to `ServerAgent` + worker mapping |
| `src/sidebar/TabBar.tsx` | **Create** | Tab switcher component (👤 人力 / 📋 项目) |
| `src/sidebar/ProjectTab.tsx` | **Create** | Project summary cards with collaboration breakdown |
| `src/sidebar/Sidebar.tsx` | Modify | Integrate TabBar, conditional tab content rendering |
| `src/sidebar/AgentCard.tsx` | Modify | Add edit ratio badge + turn count |
| `src/office/Worker.tsx` | Modify | Add heatmap desk glow based on edit ratio |

---

### Task 1: Add turnsCompleted to data layer

**Files:**
- Modify: `src/agents/types.ts:32-51`
- Modify: `src/agents/mockData.ts:84-87,102-105,120-123`

- [ ] **Step 1: Add `turnsCompleted` and `editRatio()` to types.ts**

In `src/agents/types.ts`, add `turnsCompleted: number` to the `AgentWorker` type after `toolCalls`, and add the `editRatio` helper after `totalToolCalls`:

```typescript
// Add to AgentWorker type, after the toolCalls field:
  turnsCompleted: number

// Add after the totalToolCalls function:
export function editRatio(tc: ToolCalls): number {
  const total = tc.edits + tc.reads + tc.runs
  return total > 0 ? tc.edits / total : 0
}
```

- [ ] **Step 2: Add `turnsCompleted` to mock workers in mockData.ts**

Add `turnsCompleted: 0,` after each `toolCalls` line in the three mock workers (claude-1, codex-1, gemini-1).

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds (mock workers and type now match)

- [ ] **Step 4: Commit**

```bash
git add src/agents/types.ts src/agents/mockData.ts
git commit -m "feat: add turnsCompleted field and editRatio helper"
```

---

### Task 2: Add turnsCompleted to bridge server

**Files:**
- Modify: `server/bridge.mjs:100-147` (SessionStart / auto-register)
- Modify: `server/bridge.mjs:242-253` (Stop handler)

- [ ] **Step 1: Initialize turnsCompleted in agent creation**

In `server/bridge.mjs`, add `turnsCompleted: 0` to both agent creation sites:

In the `SessionStart` handler, add to the `newAgent` object (around line 131):
```javascript
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
  turnsCompleted: 0,  // <-- add this
}
```

In the `PreToolUse` auto-register block (around line 160):
```javascript
agents.set(agentId, {
  id: agentId, sessionId,
  name: generateName(data, isSubagentEvent),
  agentType: detectAgentType(data),
  parentId: null,
  status, currentTask: task,
  project: extractProject(data.cwd), cwd: data.cwd,
  startedAt: Date.now(),
  turnsCompleted: 0,  // <-- add this
})
```

- [ ] **Step 2: Increment and broadcast turnsCompleted on Stop**

In the `Stop` handler (around line 242), change:
```javascript
case 'Stop': {
  const agent = agents.get(agentId)
  if (agent) {
    agent.status = 'idle'
    agent.currentTask = 'Waiting for next task...'
    agent.lastSeen = Date.now()
    agent.turnsCompleted = (agent.turnsCompleted || 0) + 1
    broadcast({ type: 'agent:status', agentId, status: 'idle', task: agent.currentTask, turns: agent.turnsCompleted })
  }
  submitTx('turn_bonus', agentId, 100000, 'coin', 'Turn completed').catch(() => {})
  break
}
```

- [ ] **Step 3: Commit**

```bash
git add server/bridge.mjs
git commit -m "feat: track and broadcast turnsCompleted in bridge"
```

---

### Task 3: Handle turnsCompleted in frontend data sync

**Files:**
- Modify: `src/hooks/useAgentSocket.ts:11-30` (ServerEvent + ServerAgent types)
- Modify: `src/hooks/useAgentSocket.ts:56-77` (serverAgentToWorker)
- Modify: `src/hooks/useAgentSocket.ts:154-163` (agent:status handler)
- Modify: `src/agents/store.ts:14-75` (OfficeStore type)
- Modify: `src/agents/store.ts:289-308` (spawnClone)

- [ ] **Step 1: Update ServerEvent and ServerAgent types**

In `src/hooks/useAgentSocket.ts`, add `turns` to the `agent:status` event type:
```typescript
| { type: 'agent:status'; agentId: string; status: string; task: string; toolName?: string; turns?: number }
```

Add `turnsCompleted` to `ServerAgent`:
```typescript
type ServerAgent = {
  id: string
  sessionId: string
  name?: string
  agentType: string
  parentId: string | null
  status: string
  currentTask: string
  project: string
  turnsCompleted?: number  // <-- add this
}
```

- [ ] **Step 2: Initialize turnsCompleted in serverAgentToWorker**

In the `serverAgentToWorker` function, add after `toolCalls`:
```typescript
    turnsCompleted: agent.turnsCompleted || 0,
```

- [ ] **Step 3: Handle turns in agent:status handler**

In the `agent:status` case, after the existing `addSkillXP` call, add:
```typescript
if (event.turns !== undefined) {
  useOfficeStore.setState((s) => {
    const w = s.workers[event.agentId]
    if (!w) return s
    return { workers: { ...s.workers, [event.agentId]: { ...w, turnsCompleted: event.turns! } } }
  })
}
```

- [ ] **Step 4: Add sidebarTab to store**

In `src/agents/store.ts`, add to the `OfficeStore` type:
```typescript
  sidebarTab: 'people' | 'project'
  setSidebarTab: (tab: 'people' | 'project') => void
```

In the store initializer (inside `create<OfficeStore>((set, get) => ({`), add:
```typescript
  sidebarTab: 'people',
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
```

- [ ] **Step 5: Initialize turnsCompleted in spawnClone**

In the `spawnClone` action, add `turnsCompleted: 0,` to the clone object after `toolCalls`.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useAgentSocket.ts src/agents/store.ts
git commit -m "feat: sync turnsCompleted from bridge, add sidebarTab state"
```

---

### Task 4: Create TabBar component

**Files:**
- Create: `src/sidebar/TabBar.tsx`

- [ ] **Step 1: Create TabBar.tsx**

Create `src/sidebar/TabBar.tsx`:
```tsx
import { useOfficeStore } from '../agents/store'

const TABS = [
  { key: 'people' as const, label: '👤 人力' },
  { key: 'project' as const, label: '📋 项目' },
]

export function TabBar() {
  const tab = useOfficeStore((s) => s.sidebarTab)
  const setTab = useOfficeStore((s) => s.setSidebarTab)

  return (
    <div className="flex gap-1 mb-3">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`flex-1 px-2 py-1.5 rounded text-[13px] font-mono font-bold transition-all border ${
            tab === t.key
              ? 'bg-[#e94560]/20 border-[#e94560]/50 text-[#e94560]'
              : 'bg-[#1a2744] border-[#0f3460] text-[#8888a8] hover:border-[#e94560]'
          }`}
          onClick={() => setTab(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds (component not yet imported anywhere)

- [ ] **Step 3: Commit**

```bash
git add src/sidebar/TabBar.tsx
git commit -m "feat: add TabBar component for people/project tabs"
```

---

### Task 5: Create ProjectTab component

**Files:**
- Create: `src/sidebar/ProjectTab.tsx`

- [ ] **Step 1: Create ProjectTab.tsx**

Create `src/sidebar/ProjectTab.tsx`:
```tsx
import { useMemo } from 'react'
import { useOfficeStore } from '../agents/store'
import { editRatio, totalToolCalls } from '../agents/types'
import type { AgentWorker, CloneLink, ToolCalls } from '../agents/types'

type ProjectSummary = {
  project: string
  toolCalls: ToolCalls
  ratio: number
  agentCount: number
  turnsTotal: number
  agents: AgentWorker[]
  collaborations: { parent: string; child: string }[]
  hasActive: boolean
}

function deriveProjects(
  workers: Record<string, AgentWorker>,
  cloneLinks: CloneLink[],
): ProjectSummary[] {
  const byProject = new Map<string, AgentWorker[]>()
  for (const w of Object.values(workers)) {
    const list = byProject.get(w.project) || []
    list.push(w)
    byProject.set(w.project, list)
  }

  const summaries: ProjectSummary[] = []
  for (const [project, agents] of byProject) {
    const tc: ToolCalls = { edits: 0, reads: 0, runs: 0 }
    let turnsTotal = 0
    let hasActive = false
    for (const a of agents) {
      tc.edits += a.toolCalls.edits
      tc.reads += a.toolCalls.reads
      tc.runs += a.toolCalls.runs
      turnsTotal += a.turnsCompleted
      if (a.status === 'typing' || a.status === 'running') hasActive = true
    }

    const agentIds = new Set(agents.map((a) => a.id))
    const collaborations = cloneLinks
      .filter((l) => agentIds.has(l.parentId) && agentIds.has(l.childId))
      .map((l) => {
        const parent = workers[l.parentId]?.name || l.parentId.slice(0, 8)
        const child = workers[l.childId]?.name || l.childId.slice(0, 8)
        return { parent, child }
      })

    summaries.push({
      project,
      toolCalls: tc,
      ratio: editRatio(tc),
      agentCount: agents.length,
      turnsTotal,
      agents,
      collaborations,
      hasActive,
    })
  }

  return summaries.sort((a, b) => {
    if (a.hasActive !== b.hasActive) return a.hasActive ? -1 : 1
    return totalToolCalls(b.toolCalls) - totalToolCalls(a.toolCalls)
  })
}

function RatioBadge({ ratio }: { ratio: number }) {
  const pct = Math.round(ratio * 100)
  const color = pct >= 40 ? '#22c55e' : pct >= 15 ? '#fbbf24' : pct > 0 ? '#f97316' : '#6b7280'
  return (
    <span className="font-bold" style={{ color }}>
      {pct}%
    </span>
  )
}

export function ProjectTab() {
  const workers = useOfficeStore((s) => s.workers)
  const cloneLinks = useOfficeStore((s) => s.cloneLinks)
  const projects = useMemo(() => deriveProjects(workers, cloneLinks), [workers, cloneLinks])

  if (projects.length === 0) {
    return <p className="text-[11px] font-mono text-[#6b7280] px-2">暂无项目数据</p>
  }

  return (
    <div className="space-y-1.5">
      {projects.map((p) => (
        <div
          key={p.project}
          className={`px-3 py-2 rounded-lg ${p.hasActive ? 'bg-[#1a2744]' : 'bg-[#111122]'}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono font-bold text-[#e0e0f0]">{p.project}</span>
            {p.hasActive && <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />}
          </div>
          <div className="text-[11px] font-mono text-[#8888a8]">
            ✏️{p.toolCalls.edits} · 📖{p.toolCalls.reads} · ⚡{p.toolCalls.runs}
          </div>
          <div className="flex gap-2 text-[11px] font-mono text-[#666688] mt-0.5">
            <span>密度 <RatioBadge ratio={p.ratio} /></span>
            <span>{p.agentCount}人</span>
            <span>{p.turnsTotal}轮</span>
          </div>
          <div className="text-[11px] font-mono text-[#555570] mt-0.5 truncate">
            {p.agents.map((a) => a.name).join(', ')}
          </div>
          {p.collaborations.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {p.collaborations.map((c, i) => (
                <div key={i} className="text-[10px] font-mono text-[#555570]">
                  └─ {c.parent} → {c.child}
                </div>
              ))}
            </div>
          )}
          {/* Sub-agent breakdown */}
          {p.agents.filter((a) => a.isClone).map((a) => (
            <div
              key={a.id}
              className={`text-[10px] font-mono mt-0.5 ${
                a.toolCalls.edits === 0 ? 'text-[#444455]' : 'text-[#666688]'
              }`}
            >
              └─ {a.name}: ✏️{a.toolCalls.edits} 📖{a.toolCalls.reads} ⚡{a.toolCalls.runs}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/sidebar/ProjectTab.tsx
git commit -m "feat: add ProjectTab with project summary cards"
```

---

### Task 6: Restructure Sidebar with tabs

**Files:**
- Modify: `src/sidebar/Sidebar.tsx`

- [ ] **Step 1: Add imports**

In `src/sidebar/Sidebar.tsx`, add imports at the top:
```typescript
import { TabBar } from './TabBar'
import { ProjectTab } from './ProjectTab'
```

Add a store selector for `sidebarTab`:
```typescript
const sidebarTab = useOfficeStore((s) => s.sidebarTab)
```

- [ ] **Step 2: Insert TabBar and conditional content**

In the JSX, after the `{buildMode && <BuildPanel />}` / `<FurnitureDetail />` block and before `{/* Shared pool */}`, insert the TabBar:

```tsx
<TabBar />
```

Then wrap the agent tree in a conditional and add the project tab:

Replace:
```tsx
      <div className="flex-1 overflow-y-auto space-y-1">
        {renderTree(sorted, null, 0)}
      </div>
```

With:
```tsx
      <div className="flex-1 overflow-y-auto space-y-1">
        {sidebarTab === 'people'
          ? renderTree(sorted, null, 0)
          : <ProjectTab />
        }
      </div>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/sidebar/Sidebar.tsx
git commit -m "feat: integrate tab system into sidebar"
```

---

### Task 7: Enhance AgentCard with edit ratio and turns

**Files:**
- Modify: `src/sidebar/AgentCard.tsx`

- [ ] **Step 1: Add imports and compute edit ratio**

In `src/sidebar/AgentCard.tsx`, add to imports:
```typescript
import { editRatio, totalToolCalls } from '../agents/types'
```

Inside the component, after `const isOffduty`, add:
```typescript
  const ratio = editRatio(worker.toolCalls)
  const total = totalToolCalls(worker.toolCalls)
  const ratioPct = Math.round(ratio * 100)
  const ratioColor = ratioPct >= 40 ? '#22c55e' : ratioPct >= 15 ? '#fbbf24' : ratioPct > 0 ? '#f97316' : '#6b7280'
```

- [ ] **Step 2: Add edit ratio badge and turn count to stats row**

Replace the stats row:
```tsx
      <div className="flex items-center justify-between mt-1 text-[11px] font-mono text-[#666688]">
        <div className="flex gap-2">
          <span>✏️{worker.toolCalls.edits}</span>
          <span>📖{worker.toolCalls.reads}</span>
          <span>⚡{worker.toolCalls.runs}</span>
          {!unlimited && <span className="text-[#888]">¥{effectiveSalary.toFixed(1)}</span>}
        </div>
      </div>
```

With:
```tsx
      <div className="flex items-center justify-between mt-1 text-[11px] font-mono text-[#666688]">
        <div className="flex gap-2">
          <span>✏️{worker.toolCalls.edits}</span>
          <span>📖{worker.toolCalls.reads}</span>
          <span>⚡{worker.toolCalls.runs}</span>
        </div>
        <div className="flex gap-2">
          {total > 0 && <span style={{ color: ratioColor }}>{ratioPct}%</span>}
          {worker.turnsCompleted > 0 && <span>{worker.turnsCompleted}轮</span>}
          {!unlimited && <span className="text-[#888]">¥{effectiveSalary.toFixed(1)}</span>}
        </div>
      </div>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/sidebar/AgentCard.tsx
git commit -m "feat: add edit ratio badge and turn count to AgentCard"
```

---

### Task 8: Add workstation heatmap glow

**Files:**
- Modify: `src/office/Worker.tsx:67-77` (component setup)
- Modify: `src/office/Worker.tsx` (draw callback, before existing desk drawing)

- [ ] **Step 1: Import editRatio and compute glow color**

In `src/office/Worker.tsx`, add to imports:
```typescript
import { editRatio, totalToolCalls } from '../agents/types'
```

Inside the `Worker` component function, after `const isOffduty = ...`, add:
```typescript
  const total = totalToolCalls(worker.toolCalls)
  const ratio = editRatio(worker.toolCalls)
  const glowColor = total === 0 || isOffduty ? -1
    : ratio >= 0.4 ? 0x22c55e
    : ratio >= 0.15 ? 0x60a5fa
    : 0xf97316
```

- [ ] **Step 2: Draw heatmap glow in the draw callback**

In the draw callback (`const draw = useCallback((g: PixiGraphics) => {`), add this block at the very beginning of the callback, before any existing drawing code:

```typescript
      // === HEATMAP GLOW (behind everything) ===
      if (glowColor >= 0) {
        g.setFillStyle({ color: glowColor, alpha: 0.12 })
        g.roundRect(-4, -4, DESK_W + 8, DESK_Y + DESK_H + PERSON_Y + 20, 6)
        g.fill()
      }
```

- [ ] **Step 3: Add glowColor to dependency array**

In the `useCallback` dependency array, add `glowColor` (and `total`, `ratio` are derived so only `glowColor` matters):

Find the dependency array line:
```typescript
  }, [color, hairColor, facing, isWorking, isOffduty, isSelected, worker.isClone, worker.id,
     worker.toolCalls, worker.level, worker.skills])
```

Add `glowColor`:
```typescript
  }, [color, hairColor, facing, isWorking, isOffduty, isSelected, worker.isClone, worker.id,
     worker.toolCalls, worker.level, worker.skills, glowColor])
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/office/Worker.tsx
git commit -m "feat: add workstation heatmap glow based on edit ratio"
```

---

### Task 9: Final verification and commit

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No new lint errors

- [ ] **Step 3: Visual verification**

Run: `npm run dev`
Verify:
- Sidebar shows 👤 人力 / 📋 项目 tabs
- 人力 tab shows agent cards with edit ratio % and turn count
- 📋 项目 tab shows project cards with aggregated tool calls, edit ratio, agent list, collaboration lines
- Pixel art shows colored glow behind active worker desks
- Tab switching works

- [ ] **Step 4: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "feat: management dashboard with dual-tab sidebar and heatmap"
```
