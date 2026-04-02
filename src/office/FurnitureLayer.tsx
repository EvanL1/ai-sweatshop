import { useOfficeStore } from '../agents/store'
import { FurnitureItem } from './FurnitureItem'
import { FLOOR_TYPES } from '../furniture/types'

export function FurnitureLayer() {
  const furniture = useOfficeStore((s) => s.furniture)
  return (
    <>
      {Object.values(furniture)
        .filter((item) => !FLOOR_TYPES.has(item.type))
        .map((item) => (
          <FurnitureItem key={item.id} item={item} />
        ))}
    </>
  )
}
