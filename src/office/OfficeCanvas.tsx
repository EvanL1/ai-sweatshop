import { useState, useCallback, useEffect, useRef } from 'react'
import { Application, extend } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'
import { useOfficeStore } from '../agents/store'
import { OfficeTiles } from './OfficeTiles'
import { Worker, WORKER_CENTER } from './Worker'
import { TeamLines } from './TeamLines'
import { CloneEffect } from './CloneEffect'
import { FurnitureLayer } from './FurnitureLayer'
import { BuildOverlay } from './BuildOverlay'

extend({ Container, Graphics, Text })

export function OfficeCanvas() {
  const workers = useOfficeStore((s) => s.workers)
  const cloneLinks = useOfficeStore((s) => s.cloneLinks)
  const selectedId = useOfficeStore((s) => s.selectedWorkerId)
  const scrollY = useOfficeStore((s) => s.scrollY)
  const setScrollY = useOfficeStore((s) => s.setScrollY)
  const [activeEffects, setActiveEffects] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  // Mouse wheel scrolling — reads fresh state via getState() to avoid stale closure
  useEffect(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const current = useOfficeStore.getState().scrollY
      const next = Math.min(0, Math.max(-2000, current - e.deltaY))
      setScrollY(next)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [setScrollY])

  useEffect(() => {
    if (cloneLinks.length === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveEffects((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const l of cloneLinks) {
        if (!next.has(l.childId)) {
          next.add(l.childId)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [cloneLinks])

  const removeEffect = useCallback((childId: string) => {
    setActiveEffects((prev) => {
      const next = new Set(prev)
      next.delete(childId)
      return next
    })
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
    <Application
      resizeTo={containerRef}
      background="#383850"
      antialias={false}
      resolution={1}
    >
      <pixiContainer y={scrollY}>
        <OfficeTiles />
        <FurnitureLayer />
        <TeamLines workers={workers} cloneLinks={cloneLinks} />
        {Object.values(workers).map((w) => (
          <Worker key={w.id} worker={w} isSelected={w.id === selectedId} />
        ))}
        {cloneLinks.map((link) => {
          const child = workers[link.childId]
          const parent = workers[link.parentId]
          if (!child || !parent) return null
          if (!activeEffects.has(link.childId)) return null
          return (
            <CloneEffect
              key={`effect-${link.childId}`}
              x={child.position.x + WORKER_CENTER.x}
              y={child.position.y + WORKER_CENTER.y}
              parentX={parent.position.x + WORKER_CENTER.x}
              parentY={parent.position.y + WORKER_CENTER.y}
              onComplete={() => removeEffect(link.childId)}
            />
          )
        })}
        <BuildOverlay />
      </pixiContainer>
    </Application>
    </div>
  )
}
