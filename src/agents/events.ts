import { useOfficeStore } from './store'
import { LEVEL_ORDER } from './types'

export type OfficeEvent = {
  id: string
  type: string
  icon: string
  message: string
  timestamp: number
}

type EventDef = {
  type: string
  icon: string
  messages: string[]
  effect: (id: string) => void
}

const EVENT_DEFS: EventDef[] = [
  {
    type: 'coffee',
    icon: '☕',
    messages: ['{name} 去倒了杯咖啡，效率+20%', '{name} 咖啡时间！短暂摸鱼中...'],
    effect: (id) => {
      const { updateStatus, workers } = useOfficeStore.getState()
      const w = workers[id]
      if (w) updateStatus(id, 'idle', '☕ 咖啡时间~')
    },
  },
  {
    type: 'bug',
    icon: '🐛',
    messages: ['{name} 遇到一个诡异的 bug！', '{name} 的代码炸了，紧急修复中...'],
    effect: (id) => {
      const { updateStatus, workers } = useOfficeStore.getState()
      const w = workers[id]
      if (w) updateStatus(id, 'error', '🐛 Bug 爆发！')
    },
  },
  {
    type: 'slacking',
    icon: '😴',
    messages: ['{name} 被老板发现在摸鱼！', '{name} 偷偷刷手机被抓了...'],
    effect: (id) => {
      const { updateStatus, workers } = useOfficeStore.getState()
      const w = workers[id]
      if (w) updateStatus(id, 'idle', '😴 被抓摸鱼...')
    },
  },
  {
    type: 'breakthrough',
    icon: '💡',
    messages: ['{name} 灵光一闪！产出翻倍！', '{name} 进入心流状态！'],
    effect: (id) => {
      const { workers } = useOfficeStore.getState()
      const w = workers[id]
      if (!w) return
      // Boost: add 3 task completions
      useOfficeStore.setState((s) => ({
        workers: {
          ...s.workers,
          [id]: { ...s.workers[id], tasksCompleted: s.workers[id].tasksCompleted + 3 },
        },
      }))
      useOfficeStore.getState().updateStatus(id, 'typing', '💡 灵感爆发！疯狂输出...')
    },
  },
  {
    type: 'meeting',
    icon: '📋',
    messages: ['{name} 被拉进了一个没用的会议', '{name}: "这个会真的需要我参加吗？"'],
    effect: (id) => {
      const { updateStatus, workers } = useOfficeStore.getState()
      const w = workers[id]
      if (w) updateStatus(id, 'idle', '📋 无聊的会议中...')
    },
  },
  {
    type: 'promotion_auto',
    icon: '⬆️',
    messages: ['{name} 表现优秀，自动升职！', '老板注意到了 {name} 的努力！'],
    effect: (id) => {
      const { workers, promote } = useOfficeStore.getState()
      const w = workers[id]
      if (!w) return
      if (LEVEL_ORDER.indexOf(w.level) >= LEVEL_ORDER.length - 1) return
      promote(id)
    },
  },
]

// Event log stored in module scope
let eventLog: OfficeEvent[] = []
let listeners: (() => void)[] = []

export function getEventLog(): OfficeEvent[] {
  return eventLog
}

export function onEventLogChange(fn: () => void) {
  listeners.push(fn)
  return () => { listeners = listeners.filter((l) => l !== fn) }
}

function pushEvent(event: OfficeEvent) {
  eventLog = [event, ...eventLog].slice(0, 20)
  listeners.forEach((fn) => fn())
}

// Trigger a random event on a random worker
export function triggerRandomEvent() {
  const { workers } = useOfficeStore.getState()
  const workerList = Object.values(workers)
  if (workerList.length === 0) return

  const target = workerList[Math.floor(Math.random() * workerList.length)]
  const def = EVENT_DEFS[Math.floor(Math.random() * EVENT_DEFS.length)]
  const msgTemplate = def.messages[Math.floor(Math.random() * def.messages.length)]
  const message = msgTemplate.replace('{name}', target.name)

  const event: OfficeEvent = {
    id: crypto.randomUUID().slice(0, 8),
    type: def.type,
    icon: def.icon,
    message,
    timestamp: Date.now(),
  }

  pushEvent(event)
  def.effect(target.id)
}

// Start random events (every 8-15 seconds)
let eventHandle: ReturnType<typeof setTimeout> | null = null

export function startRandomEvents() {
  if (eventHandle !== null) return
  const tick = () => {
    triggerRandomEvent()
    eventHandle = setTimeout(tick, 8000 + Math.random() * 7000)
  }
  eventHandle = setTimeout(tick, 5000)
}

// Live mode — real events come from bridge, no fake events needed
// startRandomEvents()
