import type { Furniture, FurnitureRotation } from './types'
import { FURNITURE_CATALOG, TILE_SIZE, FLOOR_TYPES, getRotatedSize } from './types'
import type { Desk } from '../agents/types'

function tileKey(x: number, y: number): string {
  return `${x},${y}`
}

/** Get all grid tiles occupied by existing desks (workstation footprint: 3×3 tiles) */
export function deskOccupiedTiles(desks: Record<string, Desk>): Set<string> {
  const occupied = new Set<string>()
  for (const desk of Object.values(desks)) {
    const gx = Math.floor(desk.position.x / TILE_SIZE)
    const gy = Math.floor(desk.position.y / TILE_SIZE)
    // Workstation footprint: 3 tiles wide, 3 tiles tall (monitor + desk + person)
    for (let dx = 0; dx < 3; dx++) {
      for (let dy = 0; dy < 3; dy++) {
        occupied.add(tileKey(gx + dx, gy + dy))
      }
    }
  }
  return occupied
}

/** Get all grid tiles occupied by existing furniture */
export function furnitureOccupiedTiles(
  furniture: Record<string, Furniture>,
  excludeId?: string,
  floorOnly?: boolean,
): Set<string> {
  const occupied = new Set<string>()
  for (const item of Object.values(furniture)) {
    if (item.id === excludeId) continue
    const isFloor = FLOOR_TYPES.has(item.type)
    if (floorOnly !== undefined && isFloor !== floorOnly) continue
    const def = FURNITURE_CATALOG[item.type]
    const { w, h } = getRotatedSize(def, item.rotation ?? 0)
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        occupied.add(tileKey(item.gridX + dx, item.gridY + dy))
      }
    }
  }
  return occupied
}

/** Check if placing furniture at (gridX, gridY) is valid */
export function isPlacementValid(
  gridX: number,
  gridY: number,
  type: Furniture['type'],
  furniture: Record<string, Furniture>,
  desks: Record<string, Desk>,
  excludeId?: string,
  rotation: FurnitureRotation = 0,
): boolean {
  if (gridX < 0 || gridY < 0) return false
  const def = FURNITURE_CATALOG[type]
  const { w, h } = getRotatedSize(def, rotation)
  const isFloor = FLOOR_TYPES.has(type)

  if (isFloor) {
    const floorTiles = furnitureOccupiedTiles(furniture, excludeId, true)
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        if (floorTiles.has(tileKey(gridX + dx, gridY + dy))) return false
      }
    }
    return true
  }

  const deskTiles = deskOccupiedTiles(desks)
  const furnTiles = furnitureOccupiedTiles(furniture, excludeId, false)

  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      const key = tileKey(gridX + dx, gridY + dy)
      if (deskTiles.has(key) || furnTiles.has(key)) return false
    }
  }
  return true
}
