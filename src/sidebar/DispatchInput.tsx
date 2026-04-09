import { useState } from 'react'

type CliTool = 'claude' | 'codex'

type Props = {
  project?: string
  agentId?: string
  onClose: () => void
}

const WS_PORT = import.meta.env.VITE_WS_PORT ?? 7777

export function DispatchInput({ project, agentId, onClose }: Props) {
  const [task, setTask] = useState('')
  const [cli, setCli] = useState<CliTool>('claude')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [result, setResult] = useState<{ mode?: string; error?: string } | null>(null)

  const dispatch = async () => {
    if (!task.trim()) return
    setStatus('sending')
    setResult(null)
    try {
      const res = await fetch(`http://${window.location.hostname}:${WS_PORT}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: task.trim(),
          cli,
          ...(agentId ? { agentId } : {}),
          ...(project ? { project } : {}),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus('sent')
        setResult({ mode: data.mode })
        setTimeout(onClose, 1500)
      } else {
        setStatus('error')
        setResult({ error: data.error })
      }
    } catch {
      setStatus('error')
      setResult({ error: 'Network error' })
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
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && status === 'idle') { e.preventDefault(); dispatch() } }}
        autoFocus
      />
      <div className="flex gap-1 items-center">
        {/* CLI selector */}
        <div className="flex rounded border border-[#0f3460] overflow-hidden">
          {(['claude', 'codex'] as const).map((t) => (
            <button
              key={t}
              className={`px-2 py-0.5 text-[10px] font-mono font-bold transition-colors ${
                cli === t
                  ? t === 'claude' ? 'bg-[#e94560]/30 text-[#e94560]' : 'bg-green-500/30 text-green-400'
                  : 'text-[#555570] hover:text-[#8888a8]'
              }`}
              onClick={() => setCli(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          className="flex-1 px-2 py-1 rounded text-[11px] font-mono font-bold bg-[#e94560]/20 border border-[#e94560]/50 text-[#e94560] hover:bg-[#e94560]/30 disabled:opacity-50"
          onClick={dispatch}
          disabled={!task.trim() || status === 'sending'}
        >
          {status === 'sending' ? '派发中...'
            : status === 'sent' ? (result?.mode === 'append' ? '✓ 已追加' : '✓ 已派发')
            : '派活'}
        </button>
        <button
          className="px-2 py-1 rounded text-[11px] font-mono text-[#6b7280] hover:text-[#b0b0c0]"
          onClick={onClose}
        >
          取消
        </button>
      </div>
      {status === 'error' && result?.error && (
        <p className="text-[10px] font-mono text-red-400">{result.error}</p>
      )}
    </div>
  )
}
