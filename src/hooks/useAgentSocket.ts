import { useEffect, useRef } from 'react'
import { useOfficeStore } from '../agents/store'
import type { AgentWorker, Desk } from '../agents/types'
import { gridPosition, findSafeGridIndex } from '../agents/mockData'
import { EMPTY_SKILLS, EMPTY_SKILL_XP, getToolSkillGain, applyAgentBonus } from '../skills/types'

const WS_PORT = import.meta.env.VITE_WS_PORT ?? 7777
const WS_URL = `ws://${window.location.hostname}:${WS_PORT}`

type ServerEvent =
  | { type: 'snapshot'; agents: ServerAgent[] }
  | { type: 'agent:start'; agent: ServerAgent; parentId?: string }
  | { type: 'agent:update'; agent: ServerAgent }
  | { type: 'agent:status'; agentId: string; status: string; task: string; toolName?: string }
  | { type: 'agent:end'; agentId: string }
  | { type: 'agent:task_completed'; agentId: string }
  | { type: 'agent:sleep'; agentId: string }
  | { type: 'agent:wake'; agentId: string }

type ServerAgent = {
  id: string
  sessionId: string
  name?: string
  agentType: string
  parentId: string | null
  status: string
  currentTask: string
  project: string
}

function mapStatus(s: string): AgentWorker['status'] {
  if (['typing', 'reading', 'running', 'idle', 'error', 'done', 'offduty'].includes(s)) {
    return s as AgentWorker['status']
  }
  return 'idle'
}

function mapAgentType(t: string): AgentWorker['agentType'] {
  if (['claude', 'codex', 'gemini'].includes(t)) return t as AgentWorker['agentType']
  return 'claude' // default for Claude Code sessions
}

function findOrCreateDesk(
  desks: Record<string, Desk>,
  furniture: Record<string, import('../furniture/types').Furniture>,
): { desk: Desk; updatedDesks: Record<string, Desk> } {
  const free = Object.values(desks).find((d) => d.assignedWorkerId === null)
  if (free) return { desk: free, updatedDesks: desks }
  const count = Object.keys(desks).length
  const safeIdx = findSafeGridIndex(count, furniture)
  const id = `desk-${count}`
  const newDesk: Desk = { id, position: gridPosition(safeIdx), assignedWorkerId: null }
  return { desk: newDesk, updatedDesks: { ...desks, [id]: newDesk } }
}

function serverAgentToWorker(agent: ServerAgent, isClone: boolean, desk: Desk): AgentWorker {
  return {
    id: agent.id,
    name: agent.name || agent.project || agent.id.slice(0, 8),
    agentType: mapAgentType(agent.agentType),
    parentId: agent.parentId,
    deskId: desk.id,
    position: { ...desk.position },
    status: mapStatus(agent.status),
    animation: agent.status === 'typing' || agent.status === 'running' ? 'typing' : 'idle',
    currentTask: agent.currentTask || 'Working...',
    project: agent.project || 'unknown',
    spawnedAt: Date.now(),
    isClone,
    tokenUsed: 0,
    tasksCompleted: 0,
    level: isClone ? 'intern' : 'senior',
    salaryMultiplier: 1,
    skills: { ...EMPTY_SKILLS },
    skillXP: { ...EMPTY_SKILL_XP },
  }
}

function addServerAgent(agent: ServerAgent) {
  const isClone = !!agent.parentId
  useOfficeStore.setState((s) => {
    if (s.workers[agent.id]) return s
    const { desk, updatedDesks } = findOrCreateDesk(s.desks, s.furniture)
    const worker = serverAgentToWorker(agent, isClone, desk)
    const cloneLinks = isClone && agent.parentId
      ? [...s.cloneLinks, { parentId: agent.parentId, childId: agent.id }]
      : s.cloneLinks
    return {
      workers: { ...s.workers, [agent.id]: worker },
      desks: { ...updatedDesks, [desk.id]: { ...desk, assignedWorkerId: agent.id } },
      cloneLinks,
    }
  })
}

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000

export function useAgentSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const liveModeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const attemptsRef = useRef(0)

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[sweatshop] Connected to bridge')
        attemptsRef.current = 0
        clearTimeout(liveModeTimerRef.current)
        useOfficeStore.getState().setLiveMode(true)
        useOfficeStore.getState().setWsStatus('connected')
      }

      ws.onmessage = (e) => {
        try {
          const event: ServerEvent = JSON.parse(e.data)
          const store = useOfficeStore.getState()

          switch (event.type) {
            case 'snapshot': {
              for (const agent of event.agents) {
                addServerAgent(agent)
              }
              break
            }

            case 'agent:start': {
              addServerAgent(event.agent)
              break
            }

            case 'agent:update': {
              // Patch an existing worker's fields (e.g. parentId resolved after SubagentStart)
              const { id, parentId } = event.agent
              useOfficeStore.setState((s) => {
                const existing = s.workers[id]
                if (!existing) return s
                const isClone = !!parentId
                const cloneLinks = isClone && parentId && !s.cloneLinks.some((l) => l.childId === id)
                  ? [...s.cloneLinks, { parentId, childId: id }]
                  : s.cloneLinks
                return {
                  workers: { ...s.workers, [id]: { ...existing, parentId, isClone } },
                  cloneLinks,
                }
              })
              break
            }

            case 'agent:status': {
              store.updateStatus(event.agentId, mapStatus(event.status), event.task)
              if (event.toolName) {
                const worker = store.workers[event.agentId]
                const { category, xp } = getToolSkillGain(event.toolName)
                const finalXP = worker ? applyAgentBonus(worker.agentType, category, xp) : xp
                store.addSkillXP(event.agentId, category, finalXP)
              }
              break
            }

            case 'agent:task_completed': {
              const w = store.workers[event.agentId]
              if (w) {
                useOfficeStore.setState((s) => ({
                  workers: {
                    ...s.workers,
                    [event.agentId]: {
                      ...s.workers[event.agentId],
                      tasksCompleted: s.workers[event.agentId].tasksCompleted + 1,
                    },
                  },
                }))
              }
              break
            }

            case 'agent:end': {
              store.removeWorker(event.agentId)
              break
            }

            case 'agent:sleep': {
              store.sleepWorker(event.agentId)
              break
            }

            case 'agent:wake': {
              // If agent doesn't exist yet (bridge restarted and sent wake for persisted agent),
              // fall back to treating it as a start from snapshot data.
              store.wakeWorker(event.agentId)
              break
            }
          }
        } catch (err) {
          console.warn('[sweatshop] Failed to parse event:', err)
        }
      }

      ws.onclose = () => {
        attemptsRef.current += 1
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** (attemptsRef.current - 1), RECONNECT_MAX_MS)
        console.log(`[sweatshop] Disconnected, reconnecting in ${delay}ms (attempt ${attemptsRef.current})`)
        useOfficeStore.getState().setWsStatus('connecting')
        reconnectRef.current = setTimeout(connect, delay)
        liveModeTimerRef.current = setTimeout(() => {
          useOfficeStore.getState().setLiveMode(false)
          useOfficeStore.getState().setWsStatus('disconnected')
        }, 5000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectRef.current)
      clearTimeout(liveModeTimerRef.current)
      wsRef.current?.close()
    }
  }, [])
}
