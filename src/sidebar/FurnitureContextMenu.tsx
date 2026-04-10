import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useOfficeStore } from '../agents/store'
import { FURNITURE_CATALOG, FLOOR_TYPES } from '../furniture/types'

export function FurnitureContextMenu() {
  const menu = useOfficeStore((s) => s.furnitureContextMenu)
  const furniture = useOfficeStore((s) => s.furniture)
  const close = useOfficeStore((s) => s.closeFurnitureMenu)
  const rotateFurniture = useOfficeStore((s) => s.rotateFurniture)
  const removeFurniture = useOfficeStore((s) => s.removeFurniture)
  const selectFurniture = useOfficeStore((s) => s.selectFurniture)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [close])

  const [prevMenu, setPrevMenu] = useState(menu)
  // Clear pos when menu closes — update state during render (React-approved pattern)
  if (prevMenu !== menu) {
    setPrevMenu(menu)
    if (!menu) setPos(null)
  }

  useLayoutEffect(() => {
    if (!menu || !ref.current) return
    const { offsetWidth: w, offsetHeight: h } = ref.current
    const left = Math.min(menu.x, window.innerWidth - w - 8)
    const top = Math.min(menu.y, window.innerHeight - h - 8)
    setPos({ left, top })
  }, [menu])

  if (!menu) return null
  const item = furniture[menu.furnitureId]
  if (!item) return null
  const def = FURNITURE_CATALOG[item.type]
  const isFloor = FLOOR_TYPES.has(item.type)
  const isSquare = def.widthTiles === def.heightTiles

  const items = [
    {
      label: `🔄 旋转 (${((item.rotation ?? 0) + 90) % 360}°)`,
      action: () => { rotateFurniture(menu.furnitureId); close() },
      disabled: isSquare, // square items don't need rotation
      color: 'text-blue-400',
    },
    {
      label: '📋 查看详情',
      action: () => { selectFurniture(menu.furnitureId); close() },
      disabled: isFloor,
      color: 'text-green-400',
    },
    {
      label: '🗑 删除',
      action: () => { removeFurniture(menu.furnitureId); close() },
      disabled: false,
      color: 'text-red-400',
    },
  ]

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
        <span className="text-[#e0e0f0] text-[13px] font-mono font-bold">
          {def.icon} {def.label}
        </span>
        <span className="text-[#666688] text-[11px] font-mono ml-2">
          {item.rotation ?? 0}°
        </span>
      </div>
      {items.map((it) => (
        <button
          key={it.label}
          className={`
            w-full text-left px-3 py-1.5 text-[12px] font-mono
            ${it.disabled ? 'text-[#444] cursor-not-allowed' : `${it.color} hover:bg-[#1e3a5f] cursor-pointer`}
            transition-colors
          `}
          onClick={it.disabled ? undefined : it.action}
          disabled={it.disabled}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
