import type { AgentWorker } from '../agents/types'
import { getPerformanceRank, RANK_COLORS, BASE_SALARY, LEVEL_MULTIPLIER, LEVEL_LABELS } from '../agents/types'
import { useOfficeStore } from '../agents/store'
import { StatusBadge } from './StatusBadge'

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

  const rank = getPerformanceRank(worker)
  const effectiveSalary = (BASE_SALARY[worker.agentType] ?? 1) * (LEVEL_MULTIPLIER[worker.level] ?? 1) * worker.salaryMultiplier

  return (
    <div
      className={`
        border-l-2 ${TYPE_COLORS[worker.agentType] ?? TYPE_COLORS.unknown}
        ${isSelected ? 'bg-[#1e3a5f]' : 'bg-[#1a2744]'}
        rounded-r px-3 py-2 cursor-pointer transition-colors
        hover:bg-[#1e3a5f]
      `}
      onClick={() => selectWorker(worker.id)}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-mono font-bold w-4 text-center"
            style={{ color: RANK_COLORS[rank] }}
          >
            {worker.tokenUsed > 500 ? rank : '—'}
          </span>
          <span className="text-[#e0e0f0] text-xs font-mono font-bold">
            {worker.name}
          </span>
          {worker.isClone && <span className="text-yellow-400 text-[8px]">分身</span>}
          <span className="text-[#888] text-[8px] font-mono">{LEVEL_LABELS[worker.level]}</span>
        </div>
        <StatusBadge status={worker.status} />
      </div>
      <p className="text-[#8888a8] text-[10px] font-mono truncate">
        {worker.currentTask}
      </p>

      {/* Stats row */}
      <div className="flex items-center justify-between mt-1 text-[8px] font-mono text-[#666688]">
        <div className="flex gap-2">
          <span>{worker.tasksCompleted} tasks</span>
          <span>{Math.floor(worker.tokenUsed).toLocaleString()} tok</span>
          {!unlimited && <span className="text-[#888]">¥{effectiveSalary.toFixed(1)}</span>}
        </div>
      </div>
    </div>
  )
}
