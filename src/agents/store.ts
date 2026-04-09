import { create } from 'zustand'
import type { AgentWorker, AgentStatus, CloneLink, Vec2, Desk } from './types'
import { BASE_TOKEN_RATES, BASE_SALARY, LEVEL_MULTIPLIER, LEVEL_ORDER, EMPTY_TOOL_CALLS, totalToolCalls } from './types'
import {
  gridPosition, findSafeGridIndex,
} from './mockData'
import type { Furniture, FurnitureType, FurnitureRotation } from '../furniture/types'
import { isPlacementValid } from '../furniture/placement'
import type { SkillCategory } from '../skills/types'
import {
  EMPTY_SKILLS, EMPTY_SKILL_XP, getSkillLevel, getTotalSkillPoints, skillPointsToWorkerLevel,
} from '../skills/types'

type OfficeStore = {
  workers: Record<string, AgentWorker>
  desks: Record<string, Desk>
  cloneLinks: CloneLink[]
  selectedWorkerId: string | null
  scrollY: number
  unlimitedMode: boolean
  liveMode: boolean
  sidebarTab: 'people' | 'project'
  wsStatus: 'connected' | 'connecting' | 'disconnected'
  tokenPool: number
  tokenPoolUsed: number
  // context menu
  contextMenu: { workerId: string; x: number; y: number } | null
  // furniture / build mode
  furniture: Record<string, Furniture>
  buildMode: boolean
  placingType: FurnitureType | null
  placingRotation: FurnitureRotation
  ghostPos: { gridX: number; gridY: number } | null
  placementValid: boolean
  selectedFurnitureId: string | null
  doorX: number // door X position on wall (pixels)
  furnitureContextMenu: { furnitureId: string; x: number; y: number } | null
  skillLevelUps: Array<{ workerId: string; category: SkillCategory; newLevel: number; id: string }>
  // actions
  setScrollY: (y: number) => void
  toggleUnlimited: () => void
  setLiveMode: (live: boolean) => void
  setSidebarTab: (tab: 'people' | 'project') => void
  setWsStatus: (status: 'connected' | 'connecting' | 'disconnected') => void
  moveWorker: (id: string, pos: Vec2) => void
  updateStatus: (id: string, status: AgentStatus, task: string) => void
  addWorker: (worker: AgentWorker) => void
  removeWorker: (id: string) => void
  selectWorker: (id: string | null) => void
  spawnClone: (parentId: string) => void
  tickTokens: (dtSeconds: number) => void
  // persistence actions
  sleepWorker: (id: string) => void
  wakeWorker: (id: string) => void
  // management actions
  promote: (id: string) => void
  demote: (id: string) => void
  giveRaise: (id: string) => void
  fireWorker: (id: string) => void
  openContextMenu: (workerId: string, x: number, y: number) => void
  closeContextMenu: () => void
  addSkillXP: (workerId: string, category: SkillCategory, xp: number) => void
  dismissSkillLevelUp: (id: string) => void
  // furniture actions
  setBuildMode: (on: boolean) => void
  setPlacingType: (t: FurnitureType | null) => void
  setGhostPos: (gridX: number, gridY: number) => void
  placeFurniture: () => void
  moveFurniture: (id: string, gridX: number, gridY: number) => void
  removeFurniture: (id: string) => void
  selectFurniture: (id: string | null) => void
  rotateFurniture: (id: string) => void
  cyclePlacingRotation: () => void
  setDoorX: (x: number) => void
  openFurnitureMenu: (furnitureId: string, x: number, y: number) => void
  closeFurnitureMenu: () => void
}

const INITIAL_POOL = 100000

// Default office layout — used on first visit
function defaultFurniture(): Record<string, Furniture> {
  const items: Furniture[] = [
    // Wall-mounted items (row 2 = just below wall)
    { id: 'f-whiteboard', type: 'whiteboard', gridX: 12, gridY: 2, rotation: 0 },
    { id: 'f-kpi', type: 'kpi_monitor', gridX: 19, gridY: 2, rotation: 0 },
    { id: 'f-bulletin', type: 'bulletin_board', gridX: 6, gridY: 2, rotation: 0 },

    // Meeting area (right side)
    { id: 'f-meeting', type: 'meeting_table', gridX: 20, gridY: 7, rotation: 0 },

    // Server corner (far right wall)
    { id: 'f-rack1', type: 'server_rack', gridX: 26, gridY: 2, rotation: 0 },
    { id: 'f-rack2', type: 'server_rack', gridX: 27, gridY: 2, rotation: 0 },

    // Break area (bottom right)
    { id: 'f-lounge', type: 'lounge', gridX: 22, gridY: 12, rotation: 0 },

    // Decorations
    { id: 'f-trophy', type: 'trophy_case', gridX: 18, gridY: 12, rotation: 0 },
    { id: 'f-plant1', type: 'plant_large', gridX: 0, gridY: 2, rotation: 0 },
    { id: 'f-plant2', type: 'plant_large', gridX: 25, gridY: 10, rotation: 0 },
    { id: 'f-clock', type: 'time_clock', gridX: 24, gridY: 2, rotation: 0 },

    // Leaderboard (near entrance)
    { id: 'f-leader', type: 'leaderboard', gridX: 22, gridY: 2, rotation: 0 },

  ]
  const map: Record<string, Furniture> = {}
  for (const item of items) map[item.id] = item
  return map
}

// Furniture persistence
function loadFurniture(): Record<string, Furniture> {
  try {
    const raw = localStorage.getItem('sweatshop-furniture')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Object.keys(parsed).length > 0) return parsed
    }
    // First visit — use default layout
    const defaults = defaultFurniture()
    saveFurniture(defaults)
    return defaults
  } catch { return defaultFurniture() }
}
function saveFurniture(furniture: Record<string, Furniture>) {
  localStorage.setItem('sweatshop-furniture', JSON.stringify(furniture))
}

function findOrCreateDesk(
  desks: Record<string, Desk>,
  furniture: Record<string, Furniture>,
): { desk: Desk; newDesks: Record<string, Desk> } {
  const free = Object.values(desks).find((d) => d.assignedWorkerId === null)
  if (free) return { desk: free, newDesks: desks }
  const count = Object.keys(desks).length
  const safeIdx = findSafeGridIndex(count, furniture)
  const id = `desk-${count}`
  const newDesk: Desk = { id, position: gridPosition(safeIdx), assignedWorkerId: null }
  return { desk: newDesk, newDesks: { ...desks, [id]: newDesk } }
}

function getEffectiveSalary(w: AgentWorker): number {
  return (BASE_SALARY[w.agentType] ?? 1) * (LEVEL_MULTIPLIER[w.level] ?? 1) * w.salaryMultiplier
}

export const useOfficeStore = create<OfficeStore>((set, get) => ({
  workers: {},
  desks: {},
  cloneLinks: [],
  selectedWorkerId: null,
  scrollY: 0,
  unlimitedMode: false,
  liveMode: false,
  sidebarTab: 'people',
  wsStatus: 'connecting',
  tokenPool: INITIAL_POOL,
  tokenPoolUsed: 0,
  contextMenu: null,
  furniture: loadFurniture(),
  buildMode: false,
  placingType: null,
  placingRotation: 0 as FurnitureRotation,
  ghostPos: null,
  placementValid: false,
  selectedFurnitureId: null,
  doorX: Number(localStorage.getItem('sweatshop-doorX') || 700),
  furnitureContextMenu: null,
  skillLevelUps: [],

  setScrollY: (y) => set({ scrollY: y }),
  toggleUnlimited: () => set((s) => ({ unlimitedMode: !s.unlimitedMode })),
  setLiveMode: (live) => set({ liveMode: live }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setWsStatus: (status) => set({ wsStatus: status }),

  moveWorker: (id, pos) =>
    set((s) => ({
      workers: { ...s.workers, [id]: { ...s.workers[id], position: pos } },
    })),

  updateStatus: (id, status, task) =>
    set((s) => {
      const w = s.workers[id]
      if (!w) return s
      return {
        workers: {
          ...s.workers,
          [id]: {
            ...w, status, currentTask: task,
            animation: status === 'typing' || status === 'running' ? 'typing' : 'idle',
          },
        },
      }
    }),

  addWorker: (worker) =>
    set((s) => ({ workers: { ...s.workers, [worker.id]: worker } })),

  removeWorker: (id) =>
    set((s) => {
      const worker = s.workers[id]
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _removed, ...rest } = s.workers
      const desks = worker?.deskId
        ? { ...s.desks, [worker.deskId]: { ...s.desks[worker.deskId], assignedWorkerId: null } }
        : s.desks
      return {
        workers: rest, desks,
        cloneLinks: s.cloneLinks.filter((l) => l.parentId !== id && l.childId !== id),
      }
    }),

  selectWorker: (id) => set({ selectedWorkerId: id }),

  sleepWorker: (id) =>
    set((s) => {
      const w = s.workers[id]
      if (!w) return s
      return {
        workers: { ...s.workers, [id]: { ...w, status: 'offduty', animation: 'idle', currentTask: '下班了' } },
      }
    }),

  wakeWorker: (id) =>
    set((s) => {
      const w = s.workers[id]
      if (!w) return s
      return {
        workers: { ...s.workers, [id]: { ...w, status: 'idle', animation: 'walking', currentTask: 'Session started' } },
      }
    }),

  openContextMenu: (workerId, x, y) => set({ contextMenu: { workerId, x, y } }),
  closeContextMenu: () => set({ contextMenu: null }),

  promote: (id) =>
    set((s) => {
      const w = s.workers[id]
      if (!w) return s
      const idx = LEVEL_ORDER.indexOf(w.level)
      if (idx >= LEVEL_ORDER.length - 1) return s
      return {
        workers: { ...s.workers, [id]: { ...w, level: LEVEL_ORDER[idx + 1] } },
      }
    }),

  demote: (id) =>
    set((s) => {
      const w = s.workers[id]
      if (!w) return s
      const idx = LEVEL_ORDER.indexOf(w.level)
      if (idx <= 0) return s
      return {
        workers: { ...s.workers, [id]: { ...w, level: LEVEL_ORDER[idx - 1] } },
      }
    }),

  giveRaise: (id) =>
    set((s) => {
      const w = s.workers[id]
      if (!w) return s
      return {
        workers: { ...s.workers, [id]: { ...w, salaryMultiplier: +(w.salaryMultiplier + 0.2).toFixed(1) } },
      }
    }),

  fireWorker: (id) =>
    set((s) => {
      const worker = s.workers[id]
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _fired, ...rest } = s.workers
      const desks = worker?.deskId
        ? { ...s.desks, [worker.deskId]: { ...s.desks[worker.deskId], assignedWorkerId: null } }
        : s.desks
      return {
        workers: rest,
        desks,
        cloneLinks: s.cloneLinks.filter((l) => l.parentId !== id && l.childId !== id),
        contextMenu: null,
      }
    }),

  spawnClone: (parentId) => {
    const state = get()
    const parent = state.workers[parentId]
    if (!parent) return

    const { desk, newDesks } = findOrCreateDesk(state.desks, state.furniture)
    const cloneId = `${parentId}-clone-${crypto.randomUUID().slice(0, 8)}`
    const clone: AgentWorker = {
      id: cloneId,
      name: `${parent.name} 分身`,
      agentType: parent.agentType,
      parentId,
      deskId: desk.id,
      position: { ...desk.position },
      status: 'running',
      animation: 'typing',
      currentTask: '初始化中...',
      project: parent.project,
      spawnedAt: Date.now(),
      isClone: true,
      tokenUsed: 0,
      toolCalls: { ...EMPTY_TOOL_CALLS },
      turnsCompleted: 0,
      level: 'intern',
      salaryMultiplier: 1,
      skills: { ...EMPTY_SKILLS },
      skillXP: { ...EMPTY_SKILL_XP },
    }

    set({
      workers: { ...state.workers, [cloneId]: clone },
      desks: { ...newDesks, [desk.id]: { ...desk, assignedWorkerId: cloneId } },
      cloneLinks: [...state.cloneLinks, { parentId, childId: cloneId }],
    })
  },

  tickTokens: (dtSeconds) => {
    const state = get()
    if (state.unlimitedMode) return

    const updatedWorkers = { ...state.workers }
    let poolDelta = 0

    for (const w of Object.values(updatedWorkers)) {
      const baseRate = BASE_TOKEN_RATES[w.status] ?? 0
      if (baseRate === 0) continue
      const cost = baseRate * getEffectiveSalary(w) * dtSeconds
      updatedWorkers[w.id] = { ...w, tokenUsed: w.tokenUsed + cost }
      poolDelta += cost
    }

    const newPoolUsed = state.tokenPoolUsed + poolDelta

    if (newPoolUsed >= state.tokenPool) {
      set({ workers: updatedWorkers, tokenPoolUsed: newPoolUsed })
      const clones = Object.values(updatedWorkers).filter((w) => w.isClone)
      if (clones.length > 0) {
        const worst = clones.reduce((a, b) => {
          const totalA = totalToolCalls(a.toolCalls)
          const totalB = totalToolCalls(b.toolCalls)
          const roiA = a.tokenUsed > 0 ? totalA / a.tokenUsed : 0
          const roiB = b.tokenUsed > 0 ? totalB / b.tokenUsed : 0
          return roiA < roiB ? a : b
        })
        get().removeWorker(worst.id)
      }
      return
    }

    set({ workers: updatedWorkers, tokenPoolUsed: newPoolUsed })
  },

  addSkillXP: (workerId, category, xp) =>
    set((s) => {
      const w = s.workers[workerId]
      if (!w) return s
      const prevXP = w.skillXP[category]
      const newXP = prevXP + xp
      const prevLevel = getSkillLevel(prevXP)
      const newLevel = getSkillLevel(newXP)
      const updatedSkillXP = { ...w.skillXP, [category]: newXP }
      const updatedSkills = { ...w.skills, [category]: newLevel }
      const totalPoints = getTotalSkillPoints(updatedSkills)
      const newWorkerLevel = skillPointsToWorkerLevel(totalPoints)
      const leveledUp = newLevel > prevLevel
      const levelUpEntry = leveledUp
        ? [{ workerId, category, newLevel, id: `${workerId}-${category}-${newLevel}-${Date.now()}` }]
        : []
      return {
        workers: {
          ...s.workers,
          [workerId]: { ...w, skillXP: updatedSkillXP, skills: updatedSkills, level: newWorkerLevel },
        },
        skillLevelUps: [...s.skillLevelUps, ...levelUpEntry],
      }
    }),

  dismissSkillLevelUp: (id) =>
    set((s) => ({ skillLevelUps: s.skillLevelUps.filter((e) => e.id !== id) })),

  // --- Furniture / Build mode ---
  setBuildMode: (on) => set({ buildMode: on, placingType: null, placingRotation: 0 as FurnitureRotation, ghostPos: null, selectedFurnitureId: null }),
  setPlacingType: (t) => set({ placingType: t, placingRotation: 0 as FurnitureRotation, ghostPos: null, placementValid: false }),
  cyclePlacingRotation: () => set((s) => {
    const next = ((s.placingRotation + 90) % 360) as FurnitureRotation
    return { placingRotation: next }
  }),

  setGhostPos: (gridX, gridY) => {
    const s = get()
    if (!s.placingType) return
    const valid = isPlacementValid(gridX, gridY, s.placingType, s.furniture, s.desks, undefined, s.placingRotation)
    set({ ghostPos: { gridX, gridY }, placementValid: valid })
  },

  placeFurniture: () => {
    const s = get()
    if (!s.placingType || !s.ghostPos || !s.placementValid) return
    const id = `furn-${crypto.randomUUID().slice(0, 8)}`
    const item: Furniture = { id, type: s.placingType, gridX: s.ghostPos.gridX, gridY: s.ghostPos.gridY, rotation: s.placingRotation }
    const next = { ...s.furniture, [id]: item }
    saveFurniture(next)
    set({ furniture: next })
  },

  moveFurniture: (id, gridX, gridY) => {
    const s = get()
    const item = s.furniture[id]
    if (!item) return
    if (!isPlacementValid(gridX, gridY, item.type, s.furniture, s.desks, id)) return
    const next = { ...s.furniture, [id]: { ...item, gridX, gridY } }
    saveFurniture(next)
    set({ furniture: next })
  },

  removeFurniture: (id) => {
    const s = get()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [id]: _removed, ...rest } = s.furniture
    saveFurniture(rest)
    set({ furniture: rest, selectedFurnitureId: s.selectedFurnitureId === id ? null : s.selectedFurnitureId })
  },

  selectFurniture: (id) => set({ selectedFurnitureId: id, selectedWorkerId: null }),

  rotateFurniture: (id) => {
    const s = get()
    const item = s.furniture[id]
    if (!item) return
    const next = ((item.rotation + 90) % 360) as FurnitureRotation
    if (!isPlacementValid(item.gridX, item.gridY, item.type, s.furniture, s.desks, id, next)) return
    const updated = { ...s.furniture, [id]: { ...item, rotation: next } }
    saveFurniture(updated)
    set({ furniture: updated })
  },

  setDoorX: (x) => {
    const clamped = Math.max(0, Math.min(1200, x))
    localStorage.setItem('sweatshop-doorX', String(clamped))
    set({ doorX: clamped })
  },
  openFurnitureMenu: (furnitureId, x, y) => set({ furnitureContextMenu: { furnitureId, x, y } }),
  closeFurnitureMenu: () => set({ furnitureContextMenu: null }),
}))

// --- Token timer (tracks real agent consumption) ---
const TOKEN_INTERVAL = 2000  // 2s instead of 500ms to reduce re-renders
let tokenHandle: ReturnType<typeof setInterval> | null = null

export function startTokenTimer() {
  if (tokenHandle !== null) return
  tokenHandle = setInterval(() => {
    useOfficeStore.getState().tickTokens(TOKEN_INTERVAL / 1000)
  }, TOKEN_INTERVAL)
}

export function stopTokenTimer() {
  if (tokenHandle !== null) { clearInterval(tokenHandle); tokenHandle = null }
}

startTokenTimer()
