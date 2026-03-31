export type AgentStatus = 'idle' | 'typing' | 'reading' | 'running' | 'error' | 'done'

export type AnimationState = 'idle' | 'typing' | 'walking'

export type Vec2 = { x: number; y: number }

export type AgentType = 'claude' | 'codex' | 'gemini' | 'unknown'

export type PerformanceRank = 'S' | 'A' | 'B' | 'C' | 'D'

export type WorkerLevel = 'intern' | 'junior' | 'senior' | 'lead'

export type Desk = {
  readonly id: string
  readonly position: Vec2
  assignedWorkerId: string | null
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
  tasksCompleted: number
  level: WorkerLevel
  salaryMultiplier: number  // can be raised
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
}

export function getPerformanceRank(worker: AgentWorker): PerformanceRank {
  if (worker.tokenUsed < 500) return 'B'
  const roi = worker.tasksCompleted / (worker.tokenUsed / 1000)
  if (roi >= 2.0) return 'S'
  if (roi >= 1.2) return 'A'
  if (roi >= 0.6) return 'B'
  if (roi >= 0.3) return 'C'
  return 'D'
}

export const RANK_COLORS: Record<PerformanceRank, string> = {
  S: '#fbbf24',
  A: '#22c55e',
  B: '#60a5fa',
  C: '#f97316',
  D: '#ef4444',
}
