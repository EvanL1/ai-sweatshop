import { useMemo, useState } from 'react'
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

const WS_PORT = import.meta.env.VITE_WS_PORT ?? 7777

function DispatchInput({ project, onClose }: { project: string; onClose: () => void }) {
  const [task, setTask] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const dispatch = async () => {
    if (!task.trim()) return
    setStatus('sending')
    try {
      const res = await fetch(`http://${window.location.hostname}:${WS_PORT}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, task: task.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus('sent')
        setTimeout(onClose, 1500)
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="mt-1.5 space-y-1">
      <textarea
        className="w-full bg-[#0f1729] border border-[#0f3460] rounded px-2 py-1 text-[11px] font-mono text-[#b0b0c0] resize-none focus:border-[#e94560] outline-none"
        rows={2}
        placeholder="描述任务..."
        value={task}
        onChange={(e) => setTask(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); dispatch() } }}
        autoFocus
      />
      <div className="flex gap-1">
        <button
          className="flex-1 px-2 py-1 rounded text-[11px] font-mono font-bold bg-[#e94560]/20 border border-[#e94560]/50 text-[#e94560] hover:bg-[#e94560]/30 disabled:opacity-50"
          onClick={dispatch}
          disabled={!task.trim() || status === 'sending'}
        >
          {status === 'sending' ? '派发中...' : status === 'sent' ? '✓ 已派发' : '派活'}
        </button>
        <button
          className="px-2 py-1 rounded text-[11px] font-mono text-[#6b7280] hover:text-[#b0b0c0]"
          onClick={onClose}
        >
          取消
        </button>
      </div>
    </div>
  )
}

export function ProjectTab() {
  const workers = useOfficeStore((s) => s.workers)
  const cloneLinks = useOfficeStore((s) => s.cloneLinks)
  const projects = useMemo(() => deriveProjects(workers, cloneLinks), [workers, cloneLinks])
  const [dispatchingProject, setDispatchingProject] = useState<string | null>(null)

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
            <div className="flex items-center gap-1.5">
              {p.hasActive && <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />}
              <button
                className="text-[10px] font-mono text-[#e94560] hover:text-[#ff6b81]"
                onClick={() => setDispatchingProject(dispatchingProject === p.project ? null : p.project)}
                title="派活给 Agent"
              >
                🚀
              </button>
            </div>
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
          {dispatchingProject === p.project && (
            <DispatchInput project={p.project} onClose={() => setDispatchingProject(null)} />
          )}
        </div>
      ))}
    </div>
  )
}
