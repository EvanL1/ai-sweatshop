import { useCallback, useEffect, useRef, useState } from 'react'
import { useTick } from '@pixi/react'
import type { Graphics as PixiGraphics, Ticker } from 'pixi.js'
import { SKILL_SPECS } from '../skills/types'
import type { SkillCategory } from '../skills/types'

type Props = {
  x: number
  y: number
  category: SkillCategory
  level: number
  onComplete?: () => void
}

const BURST_DURATION = 0.3
const FLOAT_DURATION = 1.5
const TOTAL_DURATION = BURST_DURATION + FLOAT_DURATION

export function SkillLevelUp({ x, y, category, level, onComplete }: Props) {
  const elapsed = useRef(0)
  const done = useRef(false)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete })

  const [progress, setProgress] = useState(0)

  useTick(
    useCallback((ticker: Ticker) => {
      if (done.current) return
      const dt = ticker.deltaMS / 1000
      elapsed.current += dt
      const p = Math.min(elapsed.current / TOTAL_DURATION, 1)
      setProgress(p)
      if (elapsed.current >= TOTAL_DURATION) {
        done.current = true
        onCompleteRef.current?.()
      }
    }, [])
  )

  const spec = SKILL_SPECS[category]
  const color = spec.color

  const drawBurst = useCallback(
    (g: PixiGraphics) => {
      g.clear()
      const burstProgress = Math.min(elapsed.current / BURST_DURATION, 1)
      if (burstProgress >= 1) return

      const alpha = 1 - burstProgress
      const size = 4 + burstProgress * 12

      // Pixel burst particles
      const offsets = [
        [-1, -1], [1, -1], [-1, 1], [1, 1],
        [0, -1], [0, 1], [-1, 0], [1, 0],
      ]
      for (const [dx, dy] of offsets) {
        g.setFillStyle({ color, alpha })
        g.rect(dx * size, dy * size, 3, 3)
        g.fill()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress, color]
  )

  const floatAlpha = progress < BURST_DURATION / TOTAL_DURATION
    ? 1
    : 1 - (progress - BURST_DURATION / TOTAL_DURATION) / (FLOAT_DURATION / TOTAL_DURATION)
  const floatY = -progress * 28

  const label = `${spec.label} Lv.${level}!`

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={drawBurst} />
      <pixiText
        text={label}
        anchor={{ x: 0.5, y: 1 }}
        x={0}
        y={floatY}
        alpha={Math.max(0, floatAlpha)}
        style={{ fontSize: 8, fill: color, fontFamily: 'monospace', fontWeight: 'bold' }}
      />
    </pixiContainer>
  )
}
