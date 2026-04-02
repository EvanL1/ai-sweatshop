import type { AgentWorker, AgentType, Desk, Vec2 } from './types'
import type { Furniture } from '../furniture/types'
import { FURNITURE_CATALOG, TILE_SIZE, FLOOR_TYPES } from '../furniture/types'

// Grid layout: 3 columns, rows grow as clones spawn
const GRID = {
  startX: 80,
  startY: 70,
  colGap: 200,
  rowGap: 140,
  cols: 3,
}

export function gridPosition(index: number): Vec2 {
  const col = index % GRID.cols
  const row = Math.floor(index / GRID.cols)
  return {
    x: GRID.startX + col * GRID.colGap,
    y: GRID.startY + row * GRID.rowGap,
  }
}

/** Find first grid index whose 3×3 workstation footprint doesn't overlap any furniture */
export function findSafeGridIndex(
  startIndex: number,
  furniture: Record<string, Furniture>,
): number {
  // Build set of tiles occupied by non-floor furniture
  const blocked = new Set<string>()
  for (const item of Object.values(furniture)) {
    if (FLOOR_TYPES.has(item.type)) continue
    const def = FURNITURE_CATALOG[item.type]
    for (let dy = 0; dy < def.heightTiles; dy++) {
      for (let dx = 0; dx < def.widthTiles; dx++) {
        blocked.add(`${item.gridX + dx},${item.gridY + dy}`)
      }
    }
  }

  // Try grid positions starting from startIndex, skip overlapping ones
  for (let idx = startIndex; idx < startIndex + 50; idx++) {
    const pos = gridPosition(idx)
    const gx = Math.floor(pos.x / TILE_SIZE)
    const gy = Math.floor(pos.y / TILE_SIZE)
    let overlaps = false
    // Workstation footprint: 3 tiles wide × 3 tiles tall
    for (let dy = 0; dy < 3 && !overlaps; dy++) {
      for (let dx = 0; dx < 3 && !overlaps; dx++) {
        if (blocked.has(`${gx + dx},${gy + dy}`)) overlaps = true
      }
    }
    if (!overlaps) return idx
  }
  return startIndex // fallback
}

/** Door position — where new agents spawn before walking to desk */
export const DOOR_POSITION: Vec2 = { x: 710, y: -20 }

// Initial 6 desk slots (first 3 occupied)
export const INITIAL_DESKS: Record<string, Desk> = Object.fromEntries(
  Array.from({ length: 6 }, (_, i) => {
    const id = `desk-${i}`
    const assignedWorkerId =
      i === 0 ? 'claude-1' : i === 1 ? 'codex-1' : i === 2 ? 'gemini-1' : null
    return [id, { id, position: gridPosition(i), assignedWorkerId }]
  })
)

export const MOCK_WORKERS: Record<string, AgentWorker> = {
  'claude-1': {
    id: 'claude-1',
    name: 'Claude',
    agentType: 'claude',
    parentId: null,
    deskId: 'desk-0',
    position: gridPosition(0),
    status: 'typing',
    animation: 'typing',
    currentTask: 'Refactoring auth module...',
    project: 'VoltageEMS',
    spawnedAt: Date.now(),
    isClone: false,
    tokenUsed: 0,
    tasksCompleted: 0,
    level: 'lead',
    salaryMultiplier: 1,
  },
  'codex-1': {
    id: 'codex-1',
    name: 'Codex',
    agentType: 'codex',
    parentId: null,
    deskId: 'desk-1',
    position: gridPosition(1),
    status: 'reading',
    animation: 'idle',
    currentTask: 'Reading README.md...',
    project: 'sage',
    spawnedAt: Date.now(),
    isClone: false,
    tokenUsed: 0,
    tasksCompleted: 0,
    level: 'senior',
    salaryMultiplier: 1,
  },
  'gemini-1': {
    id: 'gemini-1',
    name: 'Gemini',
    agentType: 'gemini',
    parentId: null,
    deskId: 'desk-2',
    position: gridPosition(2),
    status: 'running',
    animation: 'typing',
    currentTask: 'Running test suite...',
    project: 'client-cli',
    spawnedAt: Date.now(),
    isClone: false,
    tokenUsed: 0,
    tasksCompleted: 0,
    level: 'junior',
    salaryMultiplier: 1,
  },
}

export const MOCK_TASKS: Record<AgentType, string[]> = {
  claude: [
    'Refactoring auth module...',
    'Writing unit tests...',
    'Reviewing PR #42...',
    'Fixing type errors...',
    'Reading main.rs...',
    'Thinking...',
    'Searching codebase...',
    'Editing store.ts...',
  ],
  codex: [
    'Reading README.md...',
    'Generating boilerplate...',
    'Analyzing dependencies...',
    'Writing migration...',
    'Fixing lint warnings...',
    'Creating API endpoint...',
  ],
  gemini: [
    'Running test suite...',
    'Analyzing code patterns...',
    'Optimizing query...',
    'Building Docker image...',
    'Checking security...',
    'Deploying to staging...',
  ],
  unknown: [
    'Processing...',
    'Thinking...',
    'Working hard...',
  ],
}
