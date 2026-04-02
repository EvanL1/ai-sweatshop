import { useCallback, useEffect, useRef } from 'react'
import type { Graphics as PixiGraphics, FederatedPointerEvent } from 'pixi.js'
import { useOfficeStore } from '../agents/store'
import { FURNITURE_CATALOG, TILE_SIZE, getRotatedSize } from '../furniture/types'
import { isPlacementValid } from '../furniture/placement'

/** Static grid — only redraws when buildMode toggles */
function BuildGrid() {
  const buildMode = useOfficeStore((s) => s.buildMode)
  const draw = useCallback((g: PixiGraphics) => {
    g.clear()
    if (!buildMode) return
    g.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.06 })
    for (let x = 0; x < 800; x += TILE_SIZE) {
      g.moveTo(x, 0); g.lineTo(x, 2000)
    }
    for (let y = 0; y < 2000; y += TILE_SIZE) {
      g.moveTo(0, y); g.lineTo(800, y)
    }
    g.stroke()
  }, [buildMode])

  if (!buildMode) return null
  return <pixiGraphics draw={draw} />
}

/** Ghost preview — uses ref for imperative updates, no store writes on mousemove */
function GhostPreview() {
  const placingType = useOfficeStore((s) => s.placingType)
  const gfxRef = useRef<PixiGraphics | null>(null)
  const lastPos = useRef({ gridX: -1, gridY: -1, valid: false })

  const drawGhost = useCallback((gridX: number, gridY: number, valid: boolean) => {
    const g = gfxRef.current
    if (!g || !placingType) return
    g.clear()
    g.setFillStyle({ color: 0x000000, alpha: 0.001 })
    g.rect(0, 0, 1280, 2000)
    g.fill()
    const def = FURNITURE_CATALOG[placingType]
    const rotation = useOfficeStore.getState().placingRotation
    const { w, h } = getRotatedSize(def, rotation)
    const gx = gridX * TILE_SIZE
    const gy = gridY * TILE_SIZE
    const gw = w * TILE_SIZE
    const gh = h * TILE_SIZE
    const color = valid ? 0x22c55e : 0xef4444
    g.setFillStyle({ color, alpha: 0.3 })
    g.roundRect(gx, gy, gw, gh, 3)
    g.fill()
    g.setStrokeStyle({ width: 2, color, alpha: 0.7 })
    g.roundRect(gx, gy, gw, gh, 3)
    g.stroke()
  }, [placingType])

  const onPointerMove = useCallback((e: FederatedPointerEvent) => {
    if (!placingType) return
    const scrollY = useOfficeStore.getState().scrollY
    const gridX = Math.floor(e.globalX / TILE_SIZE)
    const gridY = Math.floor((e.globalY - scrollY) / TILE_SIZE)
    if (gridX === lastPos.current.gridX && gridY === lastPos.current.gridY) return
    const s = useOfficeStore.getState()
    const valid = isPlacementValid(gridX, gridY, placingType, s.furniture, s.desks, undefined, s.placingRotation)
    lastPos.current = { gridX, gridY, valid }
    // Also update store for the click handler
    s.setGhostPos(gridX, gridY)
    drawGhost(gridX, gridY, valid)
  }, [placingType, drawGhost])

  const onPointerDown = useCallback((e: FederatedPointerEvent) => {
    if (!placingType) return
    if (e.button === 2) {
      useOfficeStore.getState().setPlacingType(null)
      return
    }
    useOfficeStore.getState().placeFurniture()
  }, [placingType])

  const initGfx = useCallback((g: PixiGraphics) => {
    gfxRef.current = g
    g.clear()
    // Invisible hit area so pointer events work across the whole canvas
    g.setFillStyle({ color: 0x000000, alpha: 0.001 })
    g.rect(0, 0, 1280, 2000)
    g.fill()
  }, [])

  if (!placingType) return null
  return (
    <pixiGraphics
      draw={initGfx}
      eventMode="static"
      cursor="crosshair"
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
    />
  )
}

export function BuildOverlay() {
  const buildMode = useOfficeStore((s) => s.buildMode)

  useEffect(() => {
    if (!buildMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useOfficeStore.getState().setPlacingType(null)
      if (e.key === 'r' || e.key === 'R') useOfficeStore.getState().cyclePlacingRotation()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [buildMode])

  if (!buildMode) return null
  return (
    <>
      <BuildGrid />
      <GhostPreview />
    </>
  )
}
