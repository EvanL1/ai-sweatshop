import type { AgentStatus } from '../agents/types'

const STATUS_STYLES: Record<AgentStatus, { bg: string; text: string; label: string }> = {
  idle: { bg: 'bg-gray-600', text: 'text-gray-200', label: 'IDLE' },
  typing: { bg: 'bg-green-600', text: 'text-green-100', label: 'TYPING' },
  reading: { bg: 'bg-blue-600', text: 'text-blue-100', label: 'READING' },
  running: { bg: 'bg-yellow-600', text: 'text-yellow-100', label: 'RUNNING' },
  error: { bg: 'bg-red-600', text: 'text-red-100', label: 'ERROR' },
  done: { bg: 'bg-purple-600', text: 'text-purple-100', label: 'DONE' },
}

export function StatusBadge({ status }: { status: AgentStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.idle
  return (
    <span className={`${style.bg} ${style.text} text-[8px] px-1.5 py-0.5 rounded font-mono`}>
      {style.label}
    </span>
  )
}
