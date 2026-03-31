import { useCallback } from 'react'
import type { Graphics as PixiGraphics } from 'pixi.js'

const TILE_SIZE = 32
const FLOOR_COLOR = 0x3d405b
const FLOOR_ALT = 0x353849

function drawWaterCooler(g: PixiGraphics, x: number, y: number) {
  g.setFillStyle({ color: 0xd4d4d8 })
  g.rect(x, y, 24, 40)
  g.fill()
  g.setFillStyle({ color: 0x60a5fa })
  g.rect(x + 4, y + 4, 16, 20)
  g.fill()
  g.setFillStyle({ color: 0x9ca3af })
  g.rect(x - 2, y + 40, 28, 8)
  g.fill()
}

function drawPlant(g: PixiGraphics, x: number, y: number) {
  g.setFillStyle({ color: 0xb45309 })
  g.rect(x, y + 16, 20, 16)
  g.fill()
  g.setFillStyle({ color: 0x22c55e })
  g.rect(x - 4, y, 12, 16)
  g.fill()
  g.rect(x + 12, y, 12, 16)
  g.fill()
  g.setFillStyle({ color: 0x16a34a })
  g.rect(x + 4, y - 8, 12, 20)
  g.fill()
}

export function OfficeTiles() {
  const draw = useCallback((g: PixiGraphics) => {
    g.clear()

    // floor tiles (large enough for scrolling)
    for (let row = 0; row < 40; row++) {
      for (let col = 0; col < 40; col++) {
        const color = (row + col) % 2 === 0 ? FLOOR_COLOR : FLOOR_ALT
        g.setFillStyle({ color })
        g.rect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        g.fill()
      }
    }

    // wall
    g.setFillStyle({ color: 0x4a4e69 })
    g.rect(0, 0, 1280, 48)
    g.fill()
    g.setFillStyle({ color: 0x6b7280 })
    g.rect(0, 44, 1280, 4)
    g.fill()

    // "SWEATSHOP" sign
    g.setFillStyle({ color: 0xe94560 })
    g.rect(340, 10, 200, 28)
    g.fill()
    g.setFillStyle({ color: 0x1a1a2e })
    g.rect(344, 14, 192, 20)
    g.fill()

    // decorations
    drawWaterCooler(g, 860, 160)
    drawPlant(g, 100, 80)
    drawPlant(g, 780, 80)
  }, [])

  return <pixiGraphics draw={draw} />
}
