import { useCallback, useRef } from 'react'
import type { Graphics as PixiGraphics, FederatedPointerEvent } from 'pixi.js'
import type { Furniture } from '../furniture/types'
import { FURNITURE_CATALOG, TILE_SIZE, getRotatedSize } from '../furniture/types'
import { useOfficeStore } from '../agents/store'

type Props = {
  item: Furniture
}

type LiveData = {
  wsStatus: string
  tokenPoolPct: number
  workerCount: number
  activeCount: number
}

function useLiveData(): LiveData {
  const wsStatus = useOfficeStore((s) => s.wsStatus)
  const tokenPool = useOfficeStore((s) => s.tokenPool)
  const tokenPoolUsed = useOfficeStore((s) => s.tokenPoolUsed)
  const workers = useOfficeStore((s) => s.workers)
  const workerList = Object.values(workers)
  return {
    wsStatus,
    tokenPoolPct: tokenPool > 0 ? tokenPoolUsed / tokenPool : 0,
    workerCount: workerList.length,
    activeCount: workerList.filter((w) => w.status === 'typing' || w.status === 'running').length,
  }
}

export function FurnitureItem({ item }: Props) {
  const def = FURNITURE_CATALOG[item.type]
  const buildMode = useOfficeStore((s) => s.buildMode)
  const selectedId = useOfficeStore((s) => s.selectedFurnitureId)
  const isSelected = selectedId === item.id
  const live = useLiveData()
  const dragRef = useRef<{ startX: number; startY: number; origGX: number; origGY: number } | null>(null)

  const { w: tw, h: th } = getRotatedSize(def, item.rotation ?? 0)
  const px = item.gridX * TILE_SIZE
  const py = item.gridY * TILE_SIZE
  const pw = tw * TILE_SIZE
  const ph = th * TILE_SIZE

  const draw = useCallback((g: PixiGraphics) => {
    g.clear()

    // Shadow
    g.setFillStyle({ color: 0x000000, alpha: 0.2 })
    g.roundRect(px + 2, py + 2, pw, ph, 3)
    g.fill()

    // Body
    g.setFillStyle({ color: def.color })
    g.roundRect(px, py, pw, ph, 3)
    g.fill()

    // Border
    const borderColor = isSelected ? 0xfbbf24 : buildMode ? 0x60a5fa : 0x000000
    const borderAlpha = isSelected ? 0.9 : buildMode ? 0.4 : 0.2
    g.setStrokeStyle({ width: isSelected ? 2 : 1, color: borderColor, alpha: borderAlpha })
    g.roundRect(px, py, pw, ph, 3)
    g.stroke()

    // Type-specific rendering with live data
    drawFurnitureDetail(g, item.type, px, py, pw, ph, live)
  }, [px, py, pw, ph, def.color, isSelected, buildMode, item.type, item.rotation, live])

  const onPointerDown = useCallback((e: FederatedPointerEvent) => {
    if (e.button === 2) {
      e.stopPropagation()
      // Right-click: open context menu (works in both build and live mode)
      const canvas = document.querySelector('canvas')
      const rect = canvas?.getBoundingClientRect()
      const mx = rect ? e.globalX + rect.left : e.globalX
      const my = rect ? e.globalY + rect.top : e.globalY
      useOfficeStore.getState().openFurnitureMenu(item.id, mx, my)
      return
    }
    if (buildMode) {
      // Left-click in build mode: start drag
      e.stopPropagation()
      dragRef.current = {
        startX: e.globalX, startY: e.globalY,
        origGX: item.gridX, origGY: item.gridY,
      }
    } else {
      // Left-click in live mode: select
      useOfficeStore.getState().selectFurniture(item.id)
    }
  }, [buildMode, item.id, item.gridX, item.gridY])

  const onPointerMove = useCallback((e: FederatedPointerEvent) => {
    if (!dragRef.current || !buildMode) return
    const dx = e.globalX - dragRef.current.startX
    const dy = e.globalY - dragRef.current.startY
    const newGX = dragRef.current.origGX + Math.round(dx / TILE_SIZE)
    const newGY = dragRef.current.origGY + Math.round(dy / TILE_SIZE)
    if (newGX !== item.gridX || newGY !== item.gridY) {
      useOfficeStore.getState().moveFurniture(item.id, newGX, newGY)
    }
  }, [buildMode, item.id, item.gridX, item.gridY])

  const onPointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  return (
    <pixiGraphics
      draw={draw}
      eventMode={buildMode ? 'static' : 'static'}
      cursor={buildMode ? 'grab' : 'pointer'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerUpOutside={onPointerUp}
    />
  )
}

// --- Per-type pixel detail renderers ---

function drawFurnitureDetail(g: PixiGraphics, type: Furniture['type'], x: number, y: number, w: number, h: number, live: LiveData) {
  switch (type) {
    case 'whiteboard': drawWhiteboard(g, x, y, w, h, live); break
    case 'kpi_monitor': drawKpiMonitor(g, x, y, w, h, live); break
    case 'leaderboard': drawLeaderboard(g, x, y, w, h); break
    case 'meeting_table': drawMeetingTable(g, x, y, w, h); break
    case 'server_rack': drawServerRack(g, x, y, w, h, live); break
    case 'lounge': drawLounge(g, x, y, w, h); break
    case 'bulletin_board': drawBulletinBoard(g, x, y, w, h); break
    case 'time_clock': drawTimeClock(g, x, y, w, h); break
    case 'plant_large': drawPlantLarge(g, x, y, w, h); break
    case 'trophy_case': drawTrophyCase(g, x, y, w, h); break
  }
}

function drawWhiteboard(g: PixiGraphics, x: number, y: number, w: number, h: number, live: LiveData) {
  // Frame
  g.setStrokeStyle({ width: 2, color: 0x9ca3af })
  g.rect(x + 4, y + 4, w - 8, h - 8)
  g.stroke()
  // Budget bar
  const barY = y + h - 14
  const barW = w - 16
  g.setFillStyle({ color: 0x0f3460 })
  g.rect(x + 8, barY, barW, 6)
  g.fill()
  const fillColor = live.tokenPoolPct > 0.8 ? 0xef4444 : live.tokenPoolPct > 0.5 ? 0xfbbf24 : 0x22c55e
  g.setFillStyle({ color: fillColor })
  g.rect(x + 8, barY, barW * Math.min(1, live.tokenPoolPct), 6)
  g.fill()
  // Activity indicator dots
  const dotY = y + 10
  for (let i = 0; i < Math.min(live.activeCount, 5); i++) {
    g.setFillStyle({ color: 0x22c55e })
    g.circle(x + 12 + i * 8, dotY, 2)
    g.fill()
  }
  for (let i = live.activeCount; i < Math.min(live.workerCount, 5); i++) {
    g.setFillStyle({ color: 0x4a5568 })
    g.circle(x + 12 + i * 8, dotY, 2)
    g.fill()
  }
}

function drawKpiMonitor(g: PixiGraphics, x: number, y: number, w: number, h: number, live: LiveData) {
  // Screen
  g.setFillStyle({ color: 0x0f172a })
  g.rect(x + 3, y + 3, w - 6, h - 10)
  g.fill()
  // Live bars representing agent activity
  const barH = 3
  const barGap = 5
  const maxBars = Math.min(live.workerCount, 4)
  for (let i = 0; i < maxBars; i++) {
    const isActive = i < live.activeCount
    g.setFillStyle({ color: isActive ? 0x22c55e : 0x4a5568, alpha: 0.8 })
    g.rect(x + 6, y + 7 + i * barGap, isActive ? w * 0.7 : w * 0.3, barH)
    g.fill()
  }
  // Stand
  g.setFillStyle({ color: 0x4a5568 })
  g.rect(x + w / 2 - 4, y + h - 7, 8, 4)
  g.fill()
}

function drawLeaderboard(g: PixiGraphics, x: number, y: number, w: number, h: number) {
  // Medal circles
  const medals = [0xfbbf24, 0xc0c0c0, 0xcd7f32]
  for (let i = 0; i < 3; i++) {
    g.setFillStyle({ color: medals[i] })
    g.circle(x + 10, y + 12 + i * (h / 3.5), 5)
    g.fill()
    // Bar
    g.setFillStyle({ color: 0x1a2744 })
    g.rect(x + 18, y + 8 + i * (h / 3.5), w - 26, 6)
    g.fill()
  }
}

function drawMeetingTable(g: PixiGraphics, x: number, y: number, w: number, h: number) {
  // Table top (darker wood)
  g.setFillStyle({ color: 0x6d4c2a })
  g.roundRect(x + 6, y + 10, w - 12, h - 20, 4)
  g.fill()
  // Chairs (small squares around table)
  g.setFillStyle({ color: 0x4a5568 })
  for (let i = 0; i < 3; i++) {
    g.rect(x + 14 + i * ((w - 28) / 2), y + 2, 8, 6)   // top
    g.rect(x + 14 + i * ((w - 28) / 2), y + h - 8, 8, 6) // bottom
  }
  g.fill()
}

function drawServerRack(g: PixiGraphics, x: number, y: number, w: number, h: number, live: LiveData) {
  const statusLed = live.wsStatus === 'connected' ? 0x22c55e
    : live.wsStatus === 'connecting' ? 0xfbbf24 : 0xef4444
  // Rack units
  for (let i = 0; i < 4; i++) {
    g.setFillStyle({ color: 0x1a202c })
    g.rect(x + 3, y + 4 + i * (h / 4.5), w - 6, h / 5.5)
    g.fill()
    // LED — top LED reflects actual WS status, others show agent activity
    const ledColor = i === 0 ? statusLed
      : i <= live.activeCount ? 0x22c55e : 0x4a5568
    g.setFillStyle({ color: ledColor })
    g.circle(x + w - 8, y + 8 + i * (h / 4.5), 2)
    g.fill()
  }
}

function drawLounge(g: PixiGraphics, x: number, y: number, w: number, h: number) {
  // Counter
  g.setFillStyle({ color: 0x5c4f3d })
  g.rect(x + 4, y + 4, w - 8, h / 2)
  g.fill()
  // Coffee cup
  g.setFillStyle({ color: 0xffffff })
  g.rect(x + w / 2 - 4, y + 8, 8, 10)
  g.fill()
  g.setFillStyle({ color: 0x8b5e3c })
  g.rect(x + w / 2 - 3, y + 9, 6, 6)
  g.fill()
  // Steam
  g.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.4 })
  g.moveTo(x + w / 2, y + 5)
  g.lineTo(x + w / 2 - 2, y + 2)
  g.stroke()
}

function drawBulletinBoard(g: PixiGraphics, x: number, y: number, w: number, h: number) {
  // Cork background
  g.setFillStyle({ color: 0xb8956a })
  g.rect(x + 3, y + 3, w - 6, h - 6)
  g.fill()
  // Sticky notes
  const colors = [0xfbbf24, 0xef4444, 0x22c55e, 0x60a5fa]
  for (let i = 0; i < 4; i++) {
    const nx = x + 6 + (i % 2) * (w / 2 - 6)
    const ny = y + 6 + Math.floor(i / 2) * (h / 2 - 4)
    g.setFillStyle({ color: colors[i] })
    g.rect(nx, ny, w / 2 - 10, h / 2 - 10)
    g.fill()
  }
}

function drawTimeClock(g: PixiGraphics, x: number, y: number, w: number, h: number) {
  // Clock face
  const cx = x + w / 2, cy = y + h / 3
  g.setFillStyle({ color: 0xffffff })
  g.circle(cx, cy, Math.min(w, h) / 3)
  g.fill()
  g.setStrokeStyle({ width: 1, color: 0x1a202c })
  g.circle(cx, cy, Math.min(w, h) / 3)
  g.stroke()
  // Hands
  g.setStrokeStyle({ width: 2, color: 0x1a202c })
  g.moveTo(cx, cy)
  g.lineTo(cx + 4, cy - 6)
  g.moveTo(cx, cy)
  g.lineTo(cx - 3, cy + 2)
  g.stroke()
  // Card slot
  g.setFillStyle({ color: 0x0f172a })
  g.rect(x + 3, y + h - 14, w - 6, 10)
  g.fill()
}

function drawPlantLarge(g: PixiGraphics, x: number, y: number, w: number, h: number) {
  // Pot
  g.setFillStyle({ color: 0xb45309 })
  g.rect(x + w / 4, y + h / 2, w / 2, h / 2 - 2)
  g.fill()
  // Foliage
  g.setFillStyle({ color: 0x16a34a })
  g.circle(x + w / 2, y + h / 3, w / 3)
  g.fill()
  g.setFillStyle({ color: 0x22c55e })
  g.circle(x + w / 2 - 4, y + h / 3 - 3, w / 4)
  g.fill()
}

function drawTrophyCase(g: PixiGraphics, x: number, y: number, w: number, h: number) {
  // Glass case
  g.setFillStyle({ color: 0x1e293b })
  g.rect(x + 3, y + 3, w - 6, h - 6)
  g.fill()
  // Shelves
  g.setFillStyle({ color: 0x4a5568 })
  g.rect(x + 3, y + h / 2, w - 6, 2)
  g.fill()
  // Trophies
  g.setFillStyle({ color: 0xfbbf24 })
  g.rect(x + w / 2 - 4, y + 8, 8, 12)
  g.fill()
  g.setFillStyle({ color: 0xc0c0c0 })
  g.rect(x + w / 2 - 3, y + h / 2 + 6, 6, 10)
  g.fill()
}
