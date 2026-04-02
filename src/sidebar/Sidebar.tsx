import { type ReactNode, useState, useEffect } from 'react'
import type { AgentWorker } from '../agents/types'
import { useOfficeStore } from '../agents/store'
import { getPerformanceRank, RANK_COLORS } from '../agents/types'
import { AgentCard } from './AgentCard'
import { EventFeed } from './EventFeed'
import { BuildPanel } from './BuildPanel'
import { FurnitureDetail } from './FurnitureDetail'

function renderTree(all: AgentWorker[], parentId: string | null, depth: number): ReactNode[] {
  const children = all.filter((w) => w.parentId === parentId)
  const nodes: React.ReactNode[] = []
  for (const w of children) {
    nodes.push(
      <div key={w.id} style={{ marginLeft: depth * 12 }}>
        {depth > 0 && (
          <div className="flex items-center ml-1 -mb-1">
            <span className="text-[#0f3460] text-[13px] font-mono">└─</span>
          </div>
        )}
        <AgentCard worker={w} />
      </div>
    )
    nodes.push(...renderTree(all, w.id, depth + 1))
  }
  return nodes
}

const WS_STATUS_CONFIG = {
  connected:    { dot: '#22c55e', label: 'Live' },
  connecting:   { dot: '#fbbf24', label: 'Connecting...' },
  disconnected: { dot: '#6b7280', label: 'Mock' },
} as const

export function Sidebar() {
  const workers = useOfficeStore((s) => s.workers)
  const unlimited = useOfficeStore((s) => s.unlimitedMode)
  const toggleUnlimited = useOfficeStore((s) => s.toggleUnlimited)
  const tokenPool = useOfficeStore((s) => s.tokenPool)
  const tokenPoolUsed = useOfficeStore((s) => s.tokenPoolUsed)
  const wsStatus = useOfficeStore((s) => s.wsStatus)
  const buildMode = useOfficeStore((s) => s.buildMode)
  const setBuildMode = useOfficeStore((s) => s.setBuildMode)

  const sorted = Object.values(workers).sort((a, b) => {
    // Offduty agents go to the bottom
    const aOff = a.status === 'offduty' ? 1 : 0
    const bOff = b.status === 'offduty' ? 1 : 0
    if (aOff !== bOff) return aOff - bOff
    // Clones after mains
    if (a.isClone !== b.isClone) return a.isClone ? 1 : -1
    return a.spawnedAt - b.spawnedAt
  })

  const mainCount = sorted.filter((w) => !w.isClone).length
  const cloneCount = sorted.filter((w) => w.isClone).length
  const poolPct = tokenPool > 0 ? tokenPoolUsed / tokenPool : 0

  // Leaderboard: sort by ROI
  const ranked = [...sorted]
    .filter((w) => w.tokenUsed > 500)
    .sort((a, b) => {
      const roiA = a.tokenUsed > 0 ? a.tasksCompleted / a.tokenUsed : 0
      const roiB = b.tokenUsed > 0 ? b.tasksCompleted / b.tokenUsed : 0
      return roiB - roiA
    })
    .slice(0, 5)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4 pb-3 border-b border-[#0f3460]">
        <div className="flex items-center justify-between">
          <h1 className="text-[#e94560] text-xl font-bold tracking-[0.2em] font-mono">
            SWEATSHOP
          </h1>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0f3460]/50">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
              style={{ backgroundColor: WS_STATUS_CONFIG[wsStatus].dot }}
            />
            <span className="text-[11px] font-mono" style={{ color: WS_STATUS_CONFIG[wsStatus].dot }}>
              {WS_STATUS_CONFIG[wsStatus].label}
            </span>
          </div>
        </div>
        <p className="text-[#6b7280] text-[12px] font-mono mt-1">
          🏭 {mainCount} agents · {cloneCount} clones
        </p>
      </div>

      {/* Mode toggles */}
      <div className="flex gap-1.5 mb-3">
        <button
          className={`flex-1 px-2 py-1.5 rounded text-[13px] font-mono font-bold transition-all border ${
            unlimited ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
              : 'bg-[#1a2744] border-[#0f3460] text-[#8888a8] hover:border-[#e94560]'
          }`}
          onClick={toggleUnlimited}
        >
          {unlimited ? '~ UNLIMITED ~' : 'Budget'}
        </button>
        <button
          className={`flex-1 px-2 py-1.5 rounded text-[13px] font-mono font-bold transition-all border ${
            buildMode ? 'bg-[#e94560]/20 border-[#e94560]/50 text-[#e94560]'
              : 'bg-[#1a2744] border-[#0f3460] text-[#8888a8] hover:border-[#e94560]'
          }`}
          onClick={() => setBuildMode(!buildMode)}
        >
          {buildMode ? '🔨 Building' : '🔨 Build'}
        </button>
      </div>

      {buildMode && <BuildPanel />}
      <FurnitureDetail />

      {/* Shared pool */}
      {!unlimited && (
        <div className="mb-3 px-2 py-1.5 bg-[#1a2744] rounded">
          <div className="flex justify-between text-[12px] font-mono text-[#8888a8] mb-1">
            <span>Company Budget</span>
            <span>{Math.floor(tokenPoolUsed).toLocaleString()} / {tokenPool.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-[#0f3460] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, poolPct * 100)}%`,
                backgroundColor: poolPct > 0.8 ? '#ef4444' : poolPct > 0.5 ? '#fbbf24' : '#22c55e',
              }}
            />
          </div>
        </div>
      )}

      {/* Economy stats */}
      <EconomyPanel />

      {/* Performance leaderboard */}
      {ranked.length > 0 && (
        <div className="mb-3 px-2 py-1.5 bg-[#1a2744] rounded">
          <p className="text-[12px] font-mono text-[#e94560] font-bold mb-1">PERFORMANCE</p>
          {ranked.map((w, i) => {
            const rank = getPerformanceRank(w)
            const roi = w.tokenUsed > 0 ? (w.tasksCompleted / (w.tokenUsed / 1000)).toFixed(1) : '—'
            return (
              <div key={w.id} className="flex items-center justify-between text-[11px] font-mono py-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[#666688] w-3">{i + 1}.</span>
                  <span
                    className="font-bold w-4 text-center"
                    style={{ color: RANK_COLORS[rank] }}
                  >
                    {rank}
                  </span>
                  <span className="text-[#b0b0c0] truncate max-w-[80px]">{w.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[#666688]">
                  <span>{w.tasksCompleted} tasks</span>
                  <span>ROI {roi}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <EventFeed />

      <div className="flex-1 overflow-y-auto space-y-1">
        {renderTree(sorted, null, 0)}
      </div>

      <div className="mt-4 pt-3 border-t border-[#0f3460]">
        <p className="text-[#4a5568] text-[11px] font-mono text-center">
          ⛓ Powered by Rust Blockchain
        </p>
      </div>
    </div>
  )
}

function EconomyPanel() {
  const [stats, setStats] = useState<{
    total_blocks?: number; total_transactions?: number;
    company_wallet?: { coins: number; diamonds: number; prestige: number };
    office_tier?: string; error?: string;
  } | null>(null)

  useEffect(() => {
    let active = true
    const poll = () => {
      fetch(`http://${window.location.hostname}:7777/api/economy/stats`)
        .then((r) => r.json())
        .then((d) => { if (active) setStats(d) })
        .catch(() => { if (active) setStats(null) })
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => { active = false; clearInterval(id) }
  }, [])

  if (!stats || stats.error) return null
  const w = stats.company_wallet
  if (!w) return null

  const tierLabels: Record<string, string> = { garage: '🏚 小作坊', startup: '🏢 创业公司', studio: '🏛 科技公司', campus: '🏰 大厂' }

  return (
    <div className="mb-3 px-2 py-1.5 bg-[#1a2744] rounded">
      <p className="text-[12px] font-mono text-[#fbbf24] font-bold mb-1">⛓ ECONOMY</p>
      <div className="space-y-0.5 text-[11px] font-mono">
        <div className="flex justify-between">
          <span className="text-[#6b7280]">🪙 金币</span>
          <span className="text-[#fbbf24]">{(w.coins / 1000).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">💎 钻石</span>
          <span className="text-[#60a5fa]">{(w.diamonds / 1000).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">⭐ 声望</span>
          <span className="text-[#c084fc]">{(w.prestige / 1000).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">办公室</span>
          <span className="text-[#b0b0c0]">{tierLabels[stats.office_tier ?? 'garage'] ?? '🏚 小作坊'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">区块</span>
          <span className="text-[#b0b0c0]">{stats.total_blocks} blocks · {stats.total_transactions} txs</span>
        </div>
      </div>
    </div>
  )
}
