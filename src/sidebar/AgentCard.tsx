import { useState } from 'react'
import type { AgentWorker } from '../agents/types'
import { BASE_SALARY, LEVEL_MULTIPLIER, LEVEL_LABELS, editRatio, totalToolCalls } from '../agents/types'
import { useOfficeStore } from '../agents/store'
import { StatusBadge } from './StatusBadge'
import { DispatchInput } from './DispatchInput'
import { SKILL_SPECS, SKILL_CATEGORIES } from '../skills/types'

const SKILL_ICONS: Record<string, string> = {
  engineering: '🔧', research: '🔍', testing: '🧪', management: '📊', communication: '💬',
}

const TYPE_COLORS: Record<string, string> = {
  claude: 'border-l-[#e94560]',
  codex: 'border-l-green-500',
  gemini: 'border-l-blue-400',
  unknown: 'border-l-gray-500',
}

export function AgentCard({ worker }: { worker: AgentWorker }) {
  const selectWorker = useOfficeStore((s) => s.selectWorker)
  const selectedId = useOfficeStore((s) => s.selectedWorkerId)
  const unlimited = useOfficeStore((s) => s.unlimitedMode)
  const isSelected = selectedId === worker.id
  const [dispatching, setDispatching] = useState(false)
  const canDispatch = !worker.isClone && (worker.status === 'idle' || worker.status === 'offduty')

  const effectiveSalary = (BASE_SALARY[worker.agentType] ?? 1) * (LEVEL_MULTIPLIER[worker.level] ?? 1) * worker.salaryMultiplier

  const isOffduty = worker.status === 'offduty'
  const ratio = editRatio(worker.toolCalls)
  const total = totalToolCalls(worker.toolCalls)
  const ratioPct = Math.round(ratio * 100)
  const ratioColor = ratioPct >= 40 ? '#22c55e' : ratioPct >= 15 ? '#fbbf24' : ratioPct > 0 ? '#f97316' : '#6b7280'

  return (
    <div
      className={`
        border-l-3 ${TYPE_COLORS[worker.agentType] ?? TYPE_COLORS.unknown}
        ${isSelected ? 'bg-[#1e3a5f] ring-1 ring-[#e94560]/30' : isOffduty ? 'bg-[#111122]' : 'bg-[#1a2744]'}
        ${isOffduty ? 'opacity-50' : ''}
        rounded-r-lg px-3 py-2.5 cursor-pointer transition-all duration-200
        hover:bg-[#1e3a5f] hover:translate-x-0.5
      `}
      onClick={() => selectWorker(worker.id)}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-mono font-bold ${isOffduty ? 'text-[#666677]' : 'text-[#e0e0f0]'}`}>
            {worker.name}
          </span>
          {worker.isClone && <span className="text-yellow-400 text-[11px]">分身</span>}
          <span className="text-[#888] text-[11px] font-mono">{LEVEL_LABELS[worker.level]}</span>
        </div>
        <div className="flex items-center gap-1">
          {canDispatch && (
            <button
              className="text-[10px] font-mono text-[#e94560] hover:text-[#ff6b81]"
              onClick={(e) => { e.stopPropagation(); setDispatching(!dispatching) }}
              title="派活"
            >
              🚀
            </button>
          )}
          <StatusBadge status={worker.status} />
        </div>
      </div>
      <p className="text-[#8888a8] text-[13px] font-mono truncate">
        {worker.currentTask}
      </p>

      {/* Skill badges */}
      {worker.skills && (
        <div className="flex gap-1 mt-1">
          {SKILL_CATEGORIES.map((cat) => {
            const level = worker.skills[cat] ?? 0
            if (level === 0) return null
            const hex = `#${SKILL_SPECS[cat].color.toString(16).padStart(6, '0')}`
            return (
              <span key={cat} className="text-[11px] font-mono font-bold" style={{ color: hex }}>
                {SKILL_ICONS[cat]}{level}
              </span>
            )
          })}
        </div>
      )}

      {/* Stats row */}
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
      {dispatching && (
        <DispatchInput agentId={worker.id} project={worker.project} onClose={() => setDispatching(false)} />
      )}
    </div>
  )
}
