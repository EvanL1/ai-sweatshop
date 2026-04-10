import { useOfficeStore } from '../agents/store'
import { FURNITURE_CATALOG } from '../furniture/types'
import { totalToolCalls } from '../agents/types'

export function FurnitureDetail() {
  const selectedId = useOfficeStore((s) => s.selectedFurnitureId)
  const furniture = useOfficeStore((s) => s.furniture)
  const selectFurniture = useOfficeStore((s) => s.selectFurniture)

  if (!selectedId) return null
  const item = furniture[selectedId]
  if (!item) return null
  const def = FURNITURE_CATALOG[item.type]

  return (
    <div className="mb-3 px-2 py-2 bg-[#1a2744] rounded border border-[#0f3460]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-mono font-bold text-[#e94560]">
          {def.icon} {def.label}
        </span>
        <button
          className="text-[11px] text-[#6b7280] hover:text-[#e94560]"
          onClick={() => selectFurniture(null)}
        >
          ✕
        </button>
      </div>
      <DetailContent type={item.type} />
    </div>
  )
}

function DetailContent({ type }: { type: string }) {
  switch (type) {
    case 'whiteboard': return <WhiteboardDetail />
    case 'kpi_monitor': return <KpiDetail />
    case 'leaderboard': return <LeaderboardDetail />
    case 'server_rack': return <ServerRackDetail />
    case 'meeting_table': return <MeetingDetail />
    case 'bulletin_board': return <BulletinDetail />
    case 'time_clock': return <TimeClockDetail />
    default: return <p className="text-[11px] font-mono text-[#6b7280]">装饰物件</p>
  }
}

function WhiteboardDetail() {
  const tokenPool = useOfficeStore((s) => s.tokenPool)
  const tokenPoolUsed = useOfficeStore((s) => s.tokenPoolUsed)
  const workers = useOfficeStore((s) => s.workers)
  const workerList = Object.values(workers)
  const totEdits = workerList.reduce((s, w) => s + w.toolCalls.edits, 0)
  const totReads = workerList.reduce((s, w) => s + w.toolCalls.reads, 0)
  const totRuns = workerList.reduce((s, w) => s + w.toolCalls.runs, 0)
  const activeCount = workerList.filter((w) => w.status === 'typing' || w.status === 'running').length
  const pct = tokenPool > 0 ? ((tokenPoolUsed / tokenPool) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-1.5">
      <Row label="预算使用" value={`${Math.floor(tokenPoolUsed).toLocaleString()} / ${tokenPool.toLocaleString()}`} />
      <Row label="使用率" value={`${pct}%`} color={Number(pct) > 80 ? '#ef4444' : '#22c55e'} />
      <Row label="活动" value={`✏️${totEdits} · 📖${totReads} · ⚡${totRuns}`} />
      <Row label="活跃 Agent" value={`${activeCount} / ${workerList.length}`} />
      <MiniBar pct={tokenPoolUsed / tokenPool} />
    </div>
  )
}

function KpiDetail() {
  const workers = useOfficeStore((s) => s.workers)
  const workerList = Object.values(workers)
  const totEdits = workerList.reduce((s, w) => s + w.toolCalls.edits, 0)
  const totReads = workerList.reduce((s, w) => s + w.toolCalls.reads, 0)
  const totRuns = workerList.reduce((s, w) => s + w.toolCalls.runs, 0)
  const activeCount = workerList.filter((w) => w.status === 'typing' || w.status === 'running').length

  return (
    <div className="space-y-1.5">
      <Row label="活动总计" value={`✏️${totEdits} · 📖${totReads} · ⚡${totRuns}`} />
      <Row label="活跃 Agent" value={`${activeCount} / ${workerList.length}`} />
      <p className="text-[11px] font-mono text-[#6b7280] mt-1">按类型:</p>
      {Object.entries(
        workerList.reduce<Record<string, { e: number; r: number; x: number }>>((acc, w) => {
          const prev = acc[w.agentType] || { e: 0, r: 0, x: 0 }
          acc[w.agentType] = {
            e: prev.e + w.toolCalls.edits,
            r: prev.r + w.toolCalls.reads,
            x: prev.x + w.toolCalls.runs,
          }
          return acc
        }, {})
      ).map(([type, tc]) => (
        <Row key={type} label={type} value={`✏️${tc.e} · 📖${tc.r} · ⚡${tc.x}`} />
      ))}
    </div>
  )
}

function LeaderboardDetail() {
  const workers = useOfficeStore((s) => s.workers)
  const ranked = Object.values(workers)
    .filter((w) => totalToolCalls(w.toolCalls) > 0)
    .sort((a, b) => totalToolCalls(b.toolCalls) - totalToolCalls(a.toolCalls))
    .slice(0, 8)

  return (
    <div className="space-y-0.5">
      {ranked.length === 0 && (
        <p className="text-[11px] font-mono text-[#6b7280]">暂无数据</p>
      )}
      {ranked.map((w, i) => (
        <div key={w.id} className="flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-1">
            <span className="text-[#6b7280] w-3">{i + 1}.</span>
            <span className="text-[#b0b0c0] truncate max-w-[90px]">{w.name}</span>
          </div>
          <span className="text-[#6b7280]">✏️{w.toolCalls.edits} 📖{w.toolCalls.reads} ⚡{w.toolCalls.runs}</span>
        </div>
      ))}
    </div>
  )
}

function ServerRackDetail() {
  const wsStatus = useOfficeStore((s) => s.wsStatus)
  const workers = useOfficeStore((s) => s.workers)
  const workerList = Object.values(workers)
  const errorCount = workerList.filter((w) => w.status === 'error').length

  const statusColor = wsStatus === 'connected' ? '#22c55e' : wsStatus === 'connecting' ? '#fbbf24' : '#ef4444'
  const statusLabel = wsStatus === 'connected' ? '在线' : wsStatus === 'connecting' ? '连接中' : '离线'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
        <span className="text-[12px] font-mono" style={{ color: statusColor }}>
          WebSocket: {statusLabel}
        </span>
      </div>
      <Row label="Bridge 端口" value="7777" />
      <Row label="Agent 数" value={`${workerList.length}`} />
      <Row label="错误状态" value={`${errorCount}`} color={errorCount > 0 ? '#ef4444' : '#22c55e'} />
    </div>
  )
}

function MeetingDetail() {
  const cloneLinks = useOfficeStore((s) => s.cloneLinks)
  const workers = useOfficeStore((s) => s.workers)

  return (
    <div className="space-y-1">
      <Row label="协作关系" value={`${cloneLinks.length} 条`} />
      {cloneLinks.slice(0, 5).map((link) => {
        const parent = workers[link.parentId]
        const child = workers[link.childId]
        if (!parent || !child) return null
        return (
          <div key={link.childId} className="text-[11px] font-mono text-[#8888a8]">
            {parent.name} → {child.name}
          </div>
        )
      })}
      {cloneLinks.length === 0 && (
        <p className="text-[11px] font-mono text-[#6b7280]">暂无协作</p>
      )}
    </div>
  )
}

function BulletinDetail() {
  const workers = useOfficeStore((s) => s.workers)
  const recent = Object.values(workers)
    .sort((a, b) => b.spawnedAt - a.spawnedAt)
    .slice(0, 5)

  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-mono text-[#6b7280]">最近动态:</p>
      {recent.map((w) => (
        <div key={w.id} className="text-[11px] font-mono text-[#b0b0c0] truncate">
          {w.name}: {w.currentTask}
        </div>
      ))}
    </div>
  )
}

function TimeClockDetail() {
  const workers = useOfficeStore((s) => s.workers)
  const workerList = Object.values(workers)
  // eslint-disable-next-line react-hooks/purity -- reading current time for elapsed display is intentional
  const now = Date.now()

  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-mono text-[#6b7280]">在岗时长:</p>
      {workerList.slice(0, 6).map((w) => {
        const mins = Math.floor((now - w.spawnedAt) / 60000)
        return (
          <div key={w.id} className="flex justify-between text-[11px] font-mono">
            <span className="text-[#b0b0c0] truncate max-w-[80px]">{w.name}</span>
            <span className="text-[#6b7280]">{mins}m</span>
          </div>
        )
      })}
    </div>
  )
}

// --- Shared components ---

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between text-[11px] font-mono">
      <span className="text-[#6b7280]">{label}</span>
      <span style={{ color: color || '#b0b0c0' }}>{value}</span>
    </div>
  )
}

function MiniBar({ pct }: { pct: number }) {
  const clamped = Math.min(1, Math.max(0, pct))
  const color = clamped > 0.8 ? '#ef4444' : clamped > 0.5 ? '#fbbf24' : '#22c55e'
  return (
    <div className="h-1.5 bg-[#0f3460] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${clamped * 100}%`, backgroundColor: color }}
      />
    </div>
  )
}
