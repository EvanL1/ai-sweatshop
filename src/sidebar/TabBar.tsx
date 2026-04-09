import { useOfficeStore } from '../agents/store'

const TABS = [
  { key: 'people' as const, label: '👤 人力' },
  { key: 'project' as const, label: '📋 项目' },
]

export function TabBar() {
  const tab = useOfficeStore((s) => s.sidebarTab)
  const setTab = useOfficeStore((s) => s.setSidebarTab)

  return (
    <div className="flex gap-1 mb-3">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`flex-1 px-2 py-1.5 rounded text-[13px] font-mono font-bold transition-all border ${
            tab === t.key
              ? 'bg-[#e94560]/20 border-[#e94560]/50 text-[#e94560]'
              : 'bg-[#1a2744] border-[#0f3460] text-[#8888a8] hover:border-[#e94560]'
          }`}
          onClick={() => setTab(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
