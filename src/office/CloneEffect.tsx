import { useCallback, useEffect, useRef, useState } from 'react'
import { useTick } from '@pixi/react'
import type { Graphics as PixiGraphics, Ticker } from 'pixi.js'

type Props = {
  x: number
  y: number
  parentX: number
  parentY: number
  onComplete?: () => void
}

const POOF_FRAMES = 8
const POOF_DURATION = 0.4
const LINE_FADE_DURATION = 2.0

export function CloneEffect({ x, y, parentX, parentY, onComplete }: Props) {
  const [frame, setFrame] = useState(0)
  const [lineAlpha, setLineAlpha] = useState(0.6)
  const elapsed = useRef(0)
  const done = useRef(false)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { onCompleteRef.current = onComplete })

  useTick(
    useCallback((ticker: Ticker) => {
      if (done.current) return
      const dt = ticker.deltaMS / 1000

      elapsed.current += dt

      if (elapsed.current < POOF_DURATION) {
        const progress = elapsed.current / POOF_DURATION
        setFrame(Math.floor(progress * POOF_FRAMES))
      }

      if (elapsed.current < LINE_FADE_DURATION) {
        setLineAlpha(0.6 * (1 - elapsed.current / LINE_FADE_DURATION))
      } else {
        done.current = true
        onCompleteRef.current?.()
      }
    }, [])
  )

  const drawPoof = useCallback(
    (g: PixiGraphics) => {
      g.clear()
      if (frame >= POOF_FRAMES) return

      const size = 12 + frame * 4
      const alpha = 1 - frame / POOF_FRAMES

      g.setFillStyle({ color: 0xffffff, alpha: alpha * 0.6 })
      g.circle(-size / 2, -size / 3, size / 3)
      g.fill()
      g.circle(size / 2, -size / 4, size / 4)
      g.fill()
      g.circle(0, -size / 2, size / 3)
      g.fill()
      g.circle(-size / 3, size / 4, size / 4)
      g.fill()
      g.circle(size / 3, size / 3, size / 5)
      g.fill()
    },
    [frame]
  )

  const drawLine = useCallback(
    (g: PixiGraphics) => {
      g.clear()
      if (lineAlpha <= 0.01) return

      const dx = parentX - x
      const dy = parentY - y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1) return
      const dashLen = 6
      const gapLen = 4
      const steps = Math.floor(dist / (dashLen + gapLen))

      g.setStrokeStyle({ width: 1, color: 0xfbbf24, alpha: lineAlpha })
      for (let i = 0; i < steps; i++) {
        const t1 = (i * (dashLen + gapLen)) / dist
        const t2 = (i * (dashLen + gapLen) + dashLen) / dist
        g.moveTo(dx * t1, dy * t1)
        g.lineTo(dx * t2, dy * t2)
      }
      g.stroke()
    },
    [x, y, parentX, parentY, lineAlpha]
  )

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={drawPoof} />
      <pixiGraphics draw={drawLine} />
    </pixiContainer>
  )
}
