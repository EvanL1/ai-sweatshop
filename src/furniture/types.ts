export type FurnitureCategory = 'data' | 'furniture' | 'decor' | 'monitoring' | 'floor'

export type FurnitureType =
  | 'whiteboard'
  | 'kpi_monitor'
  | 'leaderboard'
  | 'meeting_table'
  | 'server_rack'
  | 'lounge'
  | 'bulletin_board'
  | 'time_clock'
  | 'plant_large'
  | 'trophy_case'
  | 'floor_wood'
  | 'floor_carpet'
  | 'floor_tile_white'
  | 'floor_grass'

export type FurnitureRotation = 0 | 90 | 180 | 270

export type Furniture = {
  readonly id: string
  readonly type: FurnitureType
  gridX: number
  gridY: number
  rotation: FurnitureRotation
}

/** Get effective width/height tiles after rotation */
export function getRotatedSize(def: FurnitureDef, rotation: FurnitureRotation): { w: number; h: number } {
  if (rotation === 90 || rotation === 270) return { w: def.heightTiles, h: def.widthTiles }
  return { w: def.widthTiles, h: def.heightTiles }
}

export type FurnitureDef = {
  readonly type: FurnitureType
  readonly label: string
  readonly category: FurnitureCategory
  readonly widthTiles: number
  readonly heightTiles: number
  readonly color: number
  readonly icon: string
}

export const FURNITURE_CATALOG: Record<FurnitureType, FurnitureDef> = {
  whiteboard: {
    type: 'whiteboard', label: '白板', category: 'data',
    widthTiles: 3, heightTiles: 2, color: 0xf5f5f5, icon: '📊',
  },
  kpi_monitor: {
    type: 'kpi_monitor', label: 'KPI 屏', category: 'data',
    widthTiles: 2, heightTiles: 2, color: 0x1a1a2e, icon: '🖥',
  },
  leaderboard: {
    type: 'leaderboard', label: '排行榜', category: 'data',
    widthTiles: 2, heightTiles: 3, color: 0xfbbf24, icon: '🏆',
  },
  meeting_table: {
    type: 'meeting_table', label: '会议桌', category: 'furniture',
    widthTiles: 4, heightTiles: 2, color: 0x8b5e3c, icon: '🪑',
  },
  server_rack: {
    type: 'server_rack', label: '服务器', category: 'monitoring',
    widthTiles: 1, heightTiles: 3, color: 0x2d3748, icon: '🖧',
  },
  lounge: {
    type: 'lounge', label: '茶水间', category: 'furniture',
    widthTiles: 3, heightTiles: 2, color: 0x7c6f5b, icon: '☕',
  },
  bulletin_board: {
    type: 'bulletin_board', label: '公告板', category: 'monitoring',
    widthTiles: 2, heightTiles: 2, color: 0xc4a882, icon: '📋',
  },
  time_clock: {
    type: 'time_clock', label: '打卡机', category: 'monitoring',
    widthTiles: 1, heightTiles: 2, color: 0x4a5568, icon: '⏰',
  },
  plant_large: {
    type: 'plant_large', label: '大盆栽', category: 'decor',
    widthTiles: 1, heightTiles: 1, color: 0x22c55e, icon: '🌿',
  },
  trophy_case: {
    type: 'trophy_case', label: '奖杯柜', category: 'decor',
    widthTiles: 2, heightTiles: 2, color: 0xd4af37, icon: '🏅',
  },
  floor_wood: {
    type: 'floor_wood', label: '木地板', category: 'floor',
    widthTiles: 3, heightTiles: 3, color: 0x8b6c42, icon: '🟫',
  },
  floor_carpet: {
    type: 'floor_carpet', label: '地毯', category: 'floor',
    widthTiles: 3, heightTiles: 3, color: 0x6b3a5a, icon: '🟪',
  },
  floor_tile_white: {
    type: 'floor_tile_white', label: '白地砖', category: 'floor',
    widthTiles: 3, heightTiles: 3, color: 0xd1d5db, icon: '⬜',
  },
  floor_grass: {
    type: 'floor_grass', label: '草坪', category: 'floor',
    widthTiles: 3, heightTiles: 3, color: 0x4a7c3f, icon: '🟩',
  },
}

export const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  data: '📊 数据',
  furniture: '🪑 家具',
  decor: '🎨 装饰',
  monitoring: '⚠️ 监控',
  floor: '🏗 地板',
}

export const FLOOR_TYPES = new Set<FurnitureType>(['floor_wood', 'floor_carpet', 'floor_tile_white', 'floor_grass'])

export const TILE_SIZE = 32
