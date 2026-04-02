import type { AgentType, WorkerLevel } from '../agents/types'

export type SkillCategory = 'engineering' | 'research' | 'testing' | 'management' | 'communication'

export type SkillSpec = {
  category: SkillCategory
  label: string
  icon: string
  color: number
  triggerTools: string[]
}

export type AgentSkills = Record<SkillCategory, number>
export type AgentSkillXP = Record<SkillCategory, number>

// XP thresholds per level (梦幻西游 exponential: base × 1.8^level)
export const XP_PER_LEVEL = [0, 100, 280, 604, 1187, 2237, 4126, 7527, 13648, 24667, 44400]

export const SKILL_SPECS: Record<SkillCategory, SkillSpec> = {
  engineering: {
    category: 'engineering',
    label: 'Engineering',
    icon: '🔧',
    color: 0xe94560,
    triggerTools: ['Write', 'Edit'],
  },
  research: {
    category: 'research',
    label: 'Research',
    icon: '🔍',
    color: 0x60a5fa,
    triggerTools: ['Read', 'Grep', 'Glob'],
  },
  testing: {
    category: 'testing',
    label: 'Testing',
    icon: '🧪',
    color: 0x22c55e,
    triggerTools: ['Bash'],
  },
  management: {
    category: 'management',
    label: 'Management',
    icon: '📊',
    color: 0xfbbf24,
    triggerTools: ['Agent'],
  },
  communication: {
    category: 'communication',
    label: 'Communication',
    icon: '💬',
    color: 0xc084fc,
    triggerTools: [], // triggered by all tools as fallback
  },
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  'engineering', 'research', 'testing', 'management', 'communication',
]

// Agent type XP multipliers per skill
export const AGENT_TYPE_BONUS: Record<AgentType, Partial<Record<SkillCategory, number>>> = {
  claude:  { management: 1.2, communication: 1.1 },
  codex:   { engineering: 1.3, testing: 1.2 },
  gemini:  { research: 1.4, communication: 1.2 },
  unknown: {},
}

// Synergy system (暗黑2 style)
export type Synergy = {
  skills: [SkillCategory, SkillCategory]
  threshold: number
  bonus: number
  label: string
}

export const SYNERGIES: Synergy[] = [
  { skills: ['engineering', 'research'], threshold: 5, bonus: 0.10, label: '全栈开发' },
  { skills: ['testing', 'engineering'], threshold: 5, bonus: 0.10, label: '质量保障' },
  { skills: ['management', 'communication'], threshold: 5, bonus: 0.10, label: '团队领导' },
]

export function getActiveSynergies(skills: AgentSkills): Synergy[] {
  return SYNERGIES.filter(
    (s) => skills[s.skills[0]] >= s.threshold && skills[s.skills[1]] >= s.threshold
  )
}

export function skillEconMultiplier(skills: AgentSkills): number {
  const total = Object.values(skills).reduce((a, b) => a + b, 0)
  return 1 + total * 0.05
}

export function getSkillLevel(xp: number): number {
  for (let i = XP_PER_LEVEL.length - 1; i >= 0; i--) {
    if (xp >= XP_PER_LEVEL[i]) return i
  }
  return 0
}

export function getTotalSkillPoints(skills: AgentSkills): number {
  return SKILL_CATEGORIES.reduce((sum, cat) => sum + skills[cat], 0)
}

export function skillPointsToWorkerLevel(totalPoints: number): WorkerLevel {
  if (totalPoints >= 45) return 'lead'
  if (totalPoints >= 25) return 'senior'
  if (totalPoints >= 10) return 'junior'
  return 'intern'
}

export const EMPTY_SKILLS: AgentSkills = {
  engineering: 0,
  research: 0,
  testing: 0,
  management: 0,
  communication: 0,
}

export const EMPTY_SKILL_XP: AgentSkillXP = {
  engineering: 0,
  research: 0,
  testing: 0,
  management: 0,
  communication: 0,
}

// Map tool name → skill category and base XP amount
export function getToolSkillGain(toolName: string): { category: SkillCategory; xp: number } {
  if (['Write', 'Edit'].includes(toolName)) return { category: 'engineering', xp: 20 }
  if (['Read', 'Grep', 'Glob'].includes(toolName)) return { category: 'research', xp: 10 }
  if (toolName === 'Bash') return { category: 'testing', xp: 15 }
  if (toolName === 'Agent') return { category: 'management', xp: 30 }
  return { category: 'communication', xp: 5 }
}

// Apply agent type bonus to XP gain
export function applyAgentBonus(agentType: AgentType, category: SkillCategory, xp: number): number {
  const bonus = AGENT_TYPE_BONUS[agentType]?.[category] ?? 1
  return Math.round(xp * bonus)
}
