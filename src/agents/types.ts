export type AgentStatus = 'idle' | 'typing' | 'reading' | 'running' | 'error' | 'done' | 'offduty'

export type AnimationState = 'idle' | 'typing' | 'walking'

export type Vec2 = { x: number; y: number }

export type AgentType = 'claude' | 'codex' | 'gemini' | 'unknown'

export type WorkerLevel = 'intern' | 'junior' | 'senior' | 'lead'

export type Desk = {
  readonly id: string
  readonly position: Vec2
  assignedWorkerId: string | null
}

export type ToolCalls = { edits: number; reads: number; runs: number }

export const EMPTY_TOOL_CALLS: ToolCalls = { edits: 0, reads: 0, runs: 0 }

export function categorizeToolCall(toolName: string): keyof ToolCalls {
  if (toolName === 'Write' || toolName === 'Edit' || toolName === 'NotebookEdit') return 'edits'
  if (toolName === 'Read' || toolName === 'Grep' || toolName === 'Glob'
    || toolName === 'WebSearch' || toolName === 'WebFetch') return 'reads'
  return 'runs'
}

export function totalToolCalls(tc: ToolCalls): number {
  return tc.edits + tc.reads + tc.runs
}

export function editRatio(tc: ToolCalls): number {
  const total = tc.edits + tc.reads + tc.runs
  return total > 0 ? tc.edits / total : 0
}

export type AgentWorker = {
  readonly id: string
  readonly name: string
  readonly agentType: AgentType
  readonly parentId: string | null
  deskId: string | null
  position: Vec2
  status: AgentStatus
  animation: AnimationState
  currentTask: string
  project: string
  spawnedAt: number
  isClone: boolean
  tokenUsed: number
  toolCalls: ToolCalls
  turnsCompleted: number
  level: WorkerLevel
  salaryMultiplier: number  // can be raised
  skills: import('../skills/types').AgentSkills
  skillXP: import('../skills/types').AgentSkillXP
}

export type CloneLink = {
  readonly parentId: string
  readonly childId: string
}

// Base salary by agent type
export const BASE_SALARY: Record<AgentType, number> = {
  claude: 1.5,
  codex: 1.0,
  gemini: 0.8,
  unknown: 0.6,
}

// Level multiplier stacks on top of base salary
export const LEVEL_MULTIPLIER: Record<WorkerLevel, number> = {
  intern: 0.5,
  junior: 1.0,
  senior: 1.5,
  lead: 2.0,
}

export const LEVEL_LABELS: Record<WorkerLevel, string> = {
  intern: '实习',
  junior: '初级',
  senior: '高级',
  lead: '主管',
}

export const LEVEL_ORDER: WorkerLevel[] = ['intern', 'junior', 'senior', 'lead']

export const BASE_TOKEN_RATES: Record<AgentStatus, number> = {
  typing: 80,
  running: 60,
  reading: 30,
  idle: 5,
  error: 0,
  done: 0,
  offduty: 0,
}

