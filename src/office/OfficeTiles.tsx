import { useCallback, useMemo } from 'react'
import type { Graphics as PixiGraphics } from 'pixi.js'
import { useOfficeStore } from '../agents/store'
import { FURNITURE_CATALOG, TILE_SIZE, FLOOR_TYPES } from '../furniture/types'

// Muted office floor — warm gray, subtle checkerboard
const FLOOR_COLOR = 0x484860
const FLOOR_ALT = 0x424258
const WALL_COLOR = 0x4a4e69
const WALL_DARK = 0x3d3f56
const WALL_HEIGHT = 56

function drawWaterCooler(g: PixiGraphics, x: number, y: number) {
  // Shadow
  g.setFillStyle({ color: 0x000000, alpha: 0.15 })
  g.roundRect(x + 2, y + 2, 26, 50, 2)
  g.fill()
  // Body
  g.setFillStyle({ color: 0xc8c8d0 })
  g.roundRect(x, y, 24, 48, 3)
  g.fill()
  // Water jug
  g.setFillStyle({ color: 0x93c5fd })
  g.roundRect(x + 3, y + 3, 18, 22, 4)
  g.fill()
  g.setFillStyle({ color: 0x60a5fa })
  g.roundRect(x + 5, y + 8, 14, 14, 3)
  g.fill()
  // Tap
  g.setFillStyle({ color: 0x9ca3af })
  g.rect(x + 8, y + 28, 8, 3)
  g.fill()
  // Base
  g.setFillStyle({ color: 0x9ca3af })
  g.roundRect(x - 2, y + 42, 28, 6, 2)
  g.fill()
}

function drawPlant(g: PixiGraphics, x: number, y: number) {
  // Shadow
  g.setFillStyle({ color: 0x000000, alpha: 0.12 })
  g.circle(x + 10, y + 34, 12)
  g.fill()
  // Pot
  g.setFillStyle({ color: 0xc2702a })
  g.roundRect(x - 1, y + 18, 22, 16, 3)
  g.fill()
  g.setFillStyle({ color: 0xd4863a })
  g.roundRect(x - 3, y + 16, 26, 5, 2)
  g.fill()
  // Dirt
  g.setFillStyle({ color: 0x5c3c1e })
  g.roundRect(x + 1, y + 18, 18, 4, 2)
  g.fill()
  // Leaves (layered for depth)
  g.setFillStyle({ color: 0x16a34a })
  g.circle(x + 10, y + 6, 11)
  g.fill()
  g.setFillStyle({ color: 0x22c55e })
  g.circle(x + 5, y + 3, 7)
  g.fill()
  g.circle(x + 15, y + 4, 7)
  g.fill()
  g.setFillStyle({ color: 0x4ade80 })
  g.circle(x + 10, y - 1, 5)
  g.fill()
}

function drawBrickPattern(g: PixiGraphics, x: number, y: number, w: number, h: number) {
  g.setStrokeStyle({ width: 1, color: 0x555570, alpha: 0.3 })
  for (let row = 0; row < h; row += 8) {
    const offset = (row / 8) % 2 === 0 ? 0 : 12
    for (let col = -12 + offset; col < w; col += 24) {
      g.rect(x + col, y + row, 24, 8)
    }
  }
  g.stroke()
}

function drawNeonSign(g: PixiGraphics, x: number, y: number) {
  // Outer glow
  g.setFillStyle({ color: 0xe94560, alpha: 0.15 })
  g.roundRect(x - 8, y - 6, 236, 44, 6)
  g.fill()
  // Sign backing (dark panel)
  g.setFillStyle({ color: 0x0a0a14 })
  g.roundRect(x, y, 220, 32, 4)
  g.fill()
  // Neon border
  g.setStrokeStyle({ width: 2, color: 0xe94560, alpha: 0.8 })
  g.roundRect(x + 2, y + 2, 216, 28, 3)
  g.stroke()
  // Inner glow lines (simulate neon text glow)
  g.setFillStyle({ color: 0xe94560, alpha: 0.4 })
  // S
  g.rect(x + 12, y + 10, 14, 3)
  g.rect(x + 12, y + 15, 14, 3)
  g.rect(x + 12, y + 20, 14, 3)
  g.rect(x + 12, y + 10, 3, 8)
  g.rect(x + 23, y + 15, 3, 8)
  // W
  g.rect(x + 30, y + 10, 3, 13)
  g.rect(x + 36, y + 16, 3, 7)
  g.rect(x + 42, y + 10, 3, 13)
  // E
  g.rect(x + 50, y + 10, 3, 13)
  g.rect(x + 50, y + 10, 12, 3)
  g.rect(x + 50, y + 15, 10, 3)
  g.rect(x + 50, y + 20, 12, 3)
  // A
  g.rect(x + 67, y + 10, 3, 13)
  g.rect(x + 79, y + 10, 3, 13)
  g.rect(x + 67, y + 10, 15, 3)
  g.rect(x + 67, y + 16, 15, 3)
  // T
  g.rect(x + 87, y + 10, 14, 3)
  g.rect(x + 92, y + 10, 3, 13)
  // S
  g.rect(x + 106, y + 10, 14, 3)
  g.rect(x + 106, y + 15, 14, 3)
  g.rect(x + 106, y + 20, 14, 3)
  g.rect(x + 106, y + 10, 3, 8)
  g.rect(x + 117, y + 15, 3, 8)
  // H
  g.rect(x + 126, y + 10, 3, 13)
  g.rect(x + 138, y + 10, 3, 13)
  g.rect(x + 126, y + 15, 15, 3)
  // O
  g.rect(x + 146, y + 10, 14, 3)
  g.rect(x + 146, y + 20, 14, 3)
  g.rect(x + 146, y + 10, 3, 13)
  g.rect(x + 157, y + 10, 3, 13)
  // P
  g.rect(x + 165, y + 10, 3, 13)
  g.rect(x + 165, y + 10, 14, 3)
  g.rect(x + 165, y + 15, 14, 3)
  g.rect(x + 176, y + 10, 3, 8)
  g.fill()

  // Bright core of neon
  g.setFillStyle({ color: 0xff6b81, alpha: 0.6 })
  g.rect(x + 13, y + 11, 12, 1)
  g.rect(x + 13, y + 16, 12, 1)
  g.rect(x + 13, y + 21, 12, 1)
  g.fill()
}

function drawDoor(g: PixiGraphics, x: number) {
  // Door frame
  g.setFillStyle({ color: 0x6d5233 })
  g.roundRect(x - 3, 0, 62, WALL_HEIGHT, 2)
  g.fill()
  // Door panel
  g.setFillStyle({ color: 0x8b6c42 })
  g.rect(x + 2, 3, 52, WALL_HEIGHT - 3)
  g.fill()
  // Door inner panels
  g.setFillStyle({ color: 0x7a5c36 })
  g.roundRect(x + 6, 7, 20, 18, 2)
  g.fill()
  g.roundRect(x + 30, 7, 20, 18, 2)
  g.fill()
  g.roundRect(x + 6, 29, 20, 18, 2)
  g.fill()
  g.roundRect(x + 30, 29, 20, 18, 2)
  g.fill()
  // Handle
  g.setFillStyle({ color: 0xfbbf24 })
  g.circle(x + 44, 30, 3)
  g.fill()
  g.setFillStyle({ color: 0xfcd34d })
  g.circle(x + 44, 30, 1.5)
  g.fill()
  // Threshold light
  g.setFillStyle({ color: 0x22c55e, alpha: 0.3 })
  g.rect(x + 2, WALL_HEIGHT - 4, 52, 4)
  g.fill()
}

function drawWallLamp(g: PixiGraphics, x: number) {
  // Bracket
  g.setFillStyle({ color: 0x9ca3af })
  g.rect(x, 12, 4, 14)
  g.fill()
  // Shade
  g.setFillStyle({ color: 0xfbbf24, alpha: 0.8 })
  g.roundRect(x - 6, 8, 16, 10, 3)
  g.fill()
  // Glow on wall
  g.setFillStyle({ color: 0xfbbf24, alpha: 0.06 })
  g.circle(x + 2, 20, 30)
  g.fill()
  // Glow on floor
  g.setFillStyle({ color: 0xfbbf24, alpha: 0.03 })
  g.ellipse(x + 2, WALL_HEIGHT + 10, 24, 12)
  g.fill()
}

// Stable selector
function useFloorFurniture() {
  const furniture = useOfficeStore((s) => s.furniture)
  return useMemo(() => {
    const floorMap = new Map<string, number>()
    for (const item of Object.values(furniture)) {
      if (!FLOOR_TYPES.has(item.type)) continue
      const def = FURNITURE_CATALOG[item.type]
      for (let dy = 0; dy < def.heightTiles; dy++) {
        for (let dx = 0; dx < def.widthTiles; dx++) {
          floorMap.set(`${item.gridX + dx},${item.gridY + dy}`, def.color)
        }
      }
    }
    return floorMap
  }, [furniture])
}

export function OfficeTiles() {
  const floorMap = useFloorFurniture()
  const doorX = useOfficeStore((s) => s.doorX)

  const draw = useCallback((g: PixiGraphics) => {
    g.clear()

    // Floor tiles
    for (let row = 0; row < 40; row++) {
      for (let col = 0; col < 40; col++) {
        const custom = floorMap.get(`${col},${row}`)
        const color = custom !== undefined
          ? ((row + col) % 2 === 0 ? custom : darken(custom, 0.08))
          : ((row + col) % 2 === 0 ? FLOOR_COLOR : FLOOR_ALT)
        g.setFillStyle({ color })
        g.rect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        g.fill()
      }
    }

    // Baseboard shadow (floor meets wall)
    g.setFillStyle({ color: 0x000000, alpha: 0.15 })
    g.rect(0, WALL_HEIGHT, 1280, 5)
    g.fill()

    // Wall (brick texture)
    g.setFillStyle({ color: WALL_COLOR })
    g.rect(0, 0, 1280, WALL_HEIGHT)
    g.fill()
    drawBrickPattern(g, 0, 0, 1280, WALL_HEIGHT)

    // Wall top trim
    g.setFillStyle({ color: WALL_DARK })
    g.rect(0, 0, 1280, 3)
    g.fill()
    // Baseboard
    g.setFillStyle({ color: 0x5c5e78 })
    g.rect(0, WALL_HEIGHT - 4, 1280, 4)
    g.fill()
    g.setFillStyle({ color: 0x6b6d88 })
    g.rect(0, WALL_HEIGHT - 5, 1280, 1)
    g.fill()

    // Door
    drawDoor(g, doorX)

    // Neon sign
    drawNeonSign(g, 240, 12)

    // Wall lamps
    drawWallLamp(g, 120)
    drawWallLamp(g, 520)
    drawWallLamp(g, 820)

    // Decorations
    drawWaterCooler(g, 860, WALL_HEIGHT + 20)
    drawPlant(g, 60, WALL_HEIGHT + 8)
    drawPlant(g, 780, WALL_HEIGHT + 8)
  }, [floorMap, doorX])

  return <pixiGraphics draw={draw} />
}

function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount)) | 0
  const gr = Math.max(0, ((color >> 8) & 0xff) * (1 - amount)) | 0
  const b = Math.max(0, (color & 0xff) * (1 - amount)) | 0
  return (r << 16) | (gr << 8) | b
}
