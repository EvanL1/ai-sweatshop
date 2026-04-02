import { useState } from 'react'
import { useOfficeStore } from '../agents/store'
import type { FurnitureCategory, FurnitureType } from '../furniture/types'
import { FURNITURE_CATALOG, CATEGORY_LABELS } from '../furniture/types'

const CATEGORIES: FurnitureCategory[] = ['data', 'furniture', 'decor', 'monitoring', 'floor']

export function BuildPanel() {
  const [activeCategory, setActiveCategory] = useState<FurnitureCategory>('data')
  const placingType = useOfficeStore((s) => s.placingType)
  const setPlacingType = useOfficeStore((s) => s.setPlacingType)
  const furniture = useOfficeStore((s) => s.furniture)
  const removeFurniture = useOfficeStore((s) => s.removeFurniture)

  const catalogItems = Object.values(FURNITURE_CATALOG).filter(
    (def) => def.category === activeCategory,
  )

  const placedItems = Object.values(furniture)

  return (
    <div className="mb-3">
      <p className="text-[12px] font-mono text-[#e94560] font-bold mb-2">BUILD MODE</p>

      {/* Category tabs */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`px-2 py-0.5 rounded text-[12px] font-mono border transition-all ${
              activeCategory === cat
                ? 'bg-[#e94560]/20 border-[#e94560]/50 text-[#e94560]'
                : 'bg-[#1a2744] border-[#0f3460] text-[#8888a8] hover:border-[#e94560]/30'
            }`}
            onClick={() => setActiveCategory(cat)}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Catalog grid */}
      <div className="grid grid-cols-2 gap-1 mb-3">
        {catalogItems.map((def) => (
          <CatalogItem
            key={def.type}
            type={def.type}
            label={def.label}
            icon={def.icon}
            color={def.color}
            isActive={placingType === def.type}
            onClick={() => setPlacingType(placingType === def.type ? null : def.type)}
          />
        ))}
      </div>

      {/* Placed items */}
      {placedItems.length > 0 && (
        <div>
          <p className="text-[11px] font-mono text-[#6b7280] mb-1">
            已放置 ({placedItems.length})
          </p>
          <div className="space-y-0.5 max-h-24 overflow-y-auto">
            {placedItems.map((item) => {
              const def = FURNITURE_CATALOG[item.type]
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-[11px] font-mono px-1.5 py-0.5 bg-[#1a2744] rounded"
                >
                  <span className="text-[#b0b0c0]">
                    {def.icon} {def.label}
                  </span>
                  <button
                    className="text-[#ef4444] hover:text-[#f87171] px-1"
                    onClick={() => removeFurniture(item.id)}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] font-mono text-[#4a5568] mt-2">
        点击放置 · R旋转 · 右键菜单 · ESC取消
      </p>
    </div>
  )
}

type CatalogItemProps = {
  type: FurnitureType
  label: string
  icon: string
  color: number
  isActive: boolean
  onClick: () => void
}

function CatalogItem({ label, icon, color, isActive, onClick }: CatalogItemProps) {
  const bgHex = `#${color.toString(16).padStart(6, '0')}`
  return (
    <button
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[12px] font-mono border transition-all ${
        isActive
          ? 'bg-[#e94560]/20 border-[#e94560] text-[#e94560]'
          : 'bg-[#1a2744] border-[#0f3460] text-[#b0b0c0] hover:border-[#e94560]/40'
      }`}
      onClick={onClick}
    >
      <span
        className="w-4 h-4 rounded flex-shrink-0 border border-black/20"
        style={{ backgroundColor: bgHex }}
      />
      <span className="truncate">{icon} {label}</span>
    </button>
  )
}
