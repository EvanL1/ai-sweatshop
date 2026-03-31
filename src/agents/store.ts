import { create } from 'zustand'
import type { AgentWorker, AgentStatus, CloneLink, Vec2, Desk } from './types'
import { BASE_TOKEN_RATES, BASE_SALARY, LEVEL_MULTIPLIER, LEVEL_ORDER } from './types'
import {
  gridPosition,
} from './mockData'

type OfficeStore = {
  workers: Record<string, AgentWorker>
  desks: Record<string, Desk>
  cloneLinks: CloneLink[]
  selectedWorkerId: string | null
  scrollY: number
  unlimitedMode: boolean
  liveMode: boolean
  wsStatus: 'connected' | 'connecting' | 'disconnected'
  tokenPool: number
  tokenPoolUsed: number
  // context menu
  contextMenu: { workerId: string; x: number; y: number } | null
  // actions
  setScrollY: (y: number) => void
  toggleUnlimited: () => void
  setLiveMode: (live: boolean) => void
  setWsStatus: (status: 'connected' | 'connecting' | 'disconnected') => void
  moveWorker: (id: string, pos: Vec2) => void
  updateStatus: (id: string, status: AgentStatus, task: string) => void
  addWorker: (worker: AgentWorker) => void
  removeWorker: (id: string) => void
  selectWorker: (id: string | null) => void
  spawnClone: (parentId: string) => void
  tickTokens: (dtSeconds: number) => void
  // management actions
  promote: (id: string) => void
  demote: (id: string) => void
  giveRaise: (id: string) => void
  fireWorker: (id: string) => void
  openContextMenu: (workerId: string, x: number, y: number) => void
  closeContextMenu: () => void
}

const INITIAL_POOL = 100000

function findOrCreateDesk(desks: Record<string, Desk>): { desk: Desk; newDesks: Record<string, Desk> } {
  const free = Object.values(desks).find((d) => d.assignedWorkerId === null)
  if (free) return { desk: free, newDesks: desks }
  const count = Object.keys(desks).length
  const id = `desk-${count}`
  const newDesk: Desk = { id, position: gridPosition(count), assignedWorkerId: null }
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
  wsStatus: 'connecting',
  tokenPool: INITIAL_POOL,
  tokenPoolUsed: 0,
  contextMenu: null,

  setScrollY: (y) => set({ scrollY: y }),
  toggleUnlimited: () => set((s) => ({ unlimitedMode: !s.unlimitedMode })),
  setLiveMode: (live) => set({ liveMode: live }),
  setWsStatus: (status) => set({ wsStatus: status }),

  moveWorker: (id, pos) =>
    set((s) => ({
      workers: { ...s.workers, [id]: { ...s.workers[id], position: pos } },
    })),

  updateStatus: (id, status, task) =>
    set((s) => {
      const w = s.workers[id]
      if (!w) return s
      const wasActive = w.status === 'typing' || w.status === 'running'
      const taskChanged = w.currentTask !== task && wasActive
      return {
        workers: {
          ...s.workers,
          [id]: {
            ...w, status, currentTask: task,
            animation: status === 'typing' || status === 'running' ? 'typing' : 'idle',
            tasksCompleted: w.tasksCompleted + (taskChanged ? 1 : 0),
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

    const { desk, newDesks } = findOrCreateDesk(state.desks)
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
      tasksCompleted: 0,
      level: 'intern',
      salaryMultiplier: 1,
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
          const roiA = a.tokenUsed > 0 ? a.tasksCompleted / a.tokenUsed : 0
          const roiB = b.tokenUsed > 0 ? b.tasksCompleted / b.tokenUsed : 0
          return roiA < roiB ? a : b
        })
        get().removeWorker(worst.id)
      }
      return
    }

    set({ workers: updatedWorkers, tokenPoolUsed: newPoolUsed })
  },
}))

// --- Token timer (tracks real agent consumption) ---
const TOKEN_INTERVAL = 500
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
