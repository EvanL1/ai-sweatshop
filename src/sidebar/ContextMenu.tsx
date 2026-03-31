import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useOfficeStore } from '../agents/store'
import { LEVEL_LABELS, LEVEL_ORDER } from '../agents/types'

export function ContextMenu() {
  const menu = useOfficeStore((s) => s.contextMenu)
  const workers = useOfficeStore((s) => s.workers)
  const close = useOfficeStore((s) => s.closeContextMenu)
  const promote = useOfficeStore((s) => s.promote)
  const demote = useOfficeStore((s) => s.demote)
  const giveRaise = useOfficeStore((s) => s.giveRaise)
  const fireWorker = useOfficeStore((s) => s.fireWorker)
  const spawnClone = useOfficeStore((s) => s.spawnClone)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [close])

  // Clamp menu inside viewport after it renders so we know its dimensions
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!menu || !ref.current) { setPos(null); return }
    const { offsetWidth: w, offsetHeight: h } = ref.current
    const left = Math.min(menu.x, window.innerWidth - w - 8)
    const top = Math.min(menu.y, window.innerHeight - h - 8)
    setPos({ left, top })
  }, [menu])

  if (!menu) return null
  const worker = workers[menu.workerId]
  if (!worker) return null

  const levelIdx = LEVEL_ORDER.indexOf(worker.level)
  const canPromote = levelIdx < LEVEL_ORDER.length - 1
  const canDemote = levelIdx > 0

  const items = [
    { label: `升职 → ${canPromote ? LEVEL_LABELS[LEVEL_ORDER[levelIdx + 1]] : '已满级'}`,
      action: () => { promote(menu.workerId); close() },
      disabled: !canPromote, color: 'text-green-400' },
    { label: `降职 → ${canDemote ? LEVEL_LABELS[LEVEL_ORDER[levelIdx - 1]] : '已最低'}`,
      action: () => { demote(menu.workerId); close() },
      disabled: !canDemote, color: 'text-orange-400' },
    { label: `加薪 (x${(worker.salaryMultiplier + 0.2).toFixed(1)})`,
      action: () => { giveRaise(menu.workerId); close() },
      disabled: false, color: 'text-yellow-400' },
    { label: '影分身の術',
      action: () => { spawnClone(menu.workerId); close() },
      disabled: false, color: 'text-blue-400' },
    { label: '开除',
      action: () => fireWorker(menu.workerId),
      disabled: false, color: 'text-red-400' },
  ]

  // Use raw click position until layout effect runs, then switch to clamped pos
  const style = pos
    ? { left: pos.left, top: pos.top }
    : { left: menu.x, top: menu.y, visibility: 'hidden' as const }

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-[#1a2744] border border-[#0f3460] rounded shadow-lg py-1 min-w-[160px]"
      style={style}
    >
      <div className="px-3 py-1 border-b border-[#0f3460] mb-1">
        <span className="text-[#e0e0f0] text-[10px] font-mono font-bold">{worker.name}</span>
        <span className="text-[#666688] text-[9px] font-mono ml-2">
          {LEVEL_LABELS[worker.level]} · x{worker.salaryMultiplier}
        </span>
      </div>
      {items.map((item) => (
        <button
          key={item.label}
          className={`
            w-full text-left px-3 py-1 text-[10px] font-mono
            ${item.disabled ? 'text-[#444] cursor-not-allowed' : `${item.color} hover:bg-[#1e3a5f] cursor-pointer`}
            transition-colors
          `}
          onClick={item.disabled ? undefined : item.action}
          disabled={item.disabled}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
