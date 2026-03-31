import { useCallback, useEffect, useRef } from 'react'
import { useTick } from '@pixi/react'
import type { Graphics as PixiGraphics, Ticker } from 'pixi.js'
import type { AgentWorker, CloneLink } from '../agents/types'
import { WORKER_CENTER } from './Worker'

type Props = {
  workers: Record<string, AgentWorker>
  cloneLinks: CloneLink[]
}

const DASH_LEN = 5
const GAP_LEN = 3
const LINE_COLORS: Record<string, number> = {
  claude: 0xe94560,
  codex: 0x22c55e,
  gemini: 0x60a5fa,
  unknown: 0xfbbf24,
}

const CX = WORKER_CENTER.x
const CY = WORKER_CENTER.y

function drawLines(
  g: PixiGraphics,
  workers: Record<string, AgentWorker>,
  cloneLinks: CloneLink[],
  dashOffset: number,
) {
  g.clear()
  if (cloneLinks.length === 0) return

  for (const link of cloneLinks) {
    const parent = workers[link.parentId]
    const child = workers[link.childId]
    if (!parent || !child) continue

    const x1 = parent.position.x + CX
    const y1 = parent.position.y + CY
    const x2 = child.position.x + CX
    const y2 = child.position.y + CY

    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) continue

    const color = LINE_COLORS[parent.agentType] ?? LINE_COLORS.unknown
    const totalDash = DASH_LEN + GAP_LEN

    g.setStrokeStyle({ width: 1.5, color, alpha: 0.5 })
    const startOffset = (dashOffset % totalDash) / dist
    const steps = Math.ceil(dist / totalDash) + 1

    for (let i = -1; i < steps; i++) {
      const t1 = Math.max(0, (i * totalDash) / dist + startOffset)
      const t2 = Math.min(1, (i * totalDash + DASH_LEN) / dist + startOffset)
      if (t1 >= 1 || t2 <= 0) continue
      g.moveTo(x1 + dx * t1, y1 + dy * t1)
      g.lineTo(x1 + dx * t2, y1 + dy * t2)
    }
    g.stroke()

    // Small diamond at midpoint
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    g.setFillStyle({ color, alpha: 0.7 })
    g.moveTo(mx, my - 3)
    g.lineTo(mx + 3, my)
    g.lineTo(mx, my + 3)
    g.lineTo(mx - 3, my)
    g.closePath()
    g.fill()
  }
}

export function TeamLines({ workers, cloneLinks }: Props) {
  // Refs for offset and the graphics instance — mutating these never causes re-renders.
  const dashOffsetRef = useRef(0)
  const graphicsRef = useRef<PixiGraphics | null>(null)

  // Keep latest props reachable from the stable tick callback.
  const workersRef = useRef(workers)
  const cloneLinksRef = useRef(cloneLinks)
  useEffect(() => { workersRef.current = workers })
  useEffect(() => { cloneLinksRef.current = cloneLinks })

  // Every frame: advance offset and redraw imperatively — zero re-renders.
  useTick(
    useCallback((ticker: Ticker) => {
      dashOffsetRef.current += (ticker.deltaMS / 1000) * 20 // 20px/sec flow speed
      const g = graphicsRef.current
      if (g) drawLines(g, workersRef.current, cloneLinksRef.current, dashOffsetRef.current)
    }, [])
  )

  // The `draw` prop is required by pixi-react for Graphics elements; it also
  // handles initial paint and re-mounts. Stable deps → never recreated.
  const draw = useCallback((g: PixiGraphics) => {
    graphicsRef.current = g
    drawLines(g, workersRef.current, cloneLinksRef.current, dashOffsetRef.current)
  }, [])

  return <pixiGraphics draw={draw} />
}
