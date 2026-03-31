import { useCallback, useEffect, useRef, useState } from 'react'
import { useTick } from '@pixi/react'
import type { Graphics as PixiGraphics } from 'pixi.js'

type Props = {
  text: string
  x: number
  y: number
}

const MAX_WIDTH = 160
const PADDING = 6
const FONT_SIZE = 9
const BG_COLOR = 0xffffff
const BORDER_COLOR = 0x1a1a2e
const TAIL_SIZE = 6
const ASCII_CHAR_WIDTH = FONT_SIZE * 0.6
const CJK_CHAR_WIDTH = FONT_SIZE * 1.0
const CJK_RE = /[\u3000-\u9fff\uf900-\ufaff\ufe30-\ufe4f]/
const TYPEWRITER_SPEED = 30 // chars per second

function measureText(s: string): number {
  let width = 0
  for (const ch of s) {
    width += CJK_RE.test(ch) ? CJK_CHAR_WIDTH : ASCII_CHAR_WIDTH
  }
  return width
}

export function SpeechBubble({ text, x, y }: Props) {
  const truncated = text.length > 28 ? text.slice(0, 26) + '...' : text

  // Typewriter: reveal chars over time when text changes
  const [visibleLen, setVisibleLen] = useState(truncated.length)
  const prevTextRef = useRef(truncated)
  const elapsedRef = useRef(0)

  useEffect(() => {
    if (truncated !== prevTextRef.current) {
      prevTextRef.current = truncated
      setVisibleLen(0)
      elapsedRef.current = 0
    }
  }, [truncated])

  // Floating bob animation
  const bobRef = useRef(0)
  const [bobY, setBobY] = useState(0)

  useTick(
    useCallback((ticker: any) => {
      // Typewriter tick
      if (visibleLen < truncated.length) {
        elapsedRef.current += ticker.deltaMS / 1000
        const newLen = Math.min(
          truncated.length,
          Math.floor(elapsedRef.current * TYPEWRITER_SPEED)
        )
        if (newLen !== visibleLen) setVisibleLen(newLen)
      }

      // Bob
      bobRef.current += ticker.deltaMS / 1000
      const newBob = Math.sin(bobRef.current * 1.5) * 1.5
      setBobY(newBob)
    }, [visibleLen, truncated.length])
  )

  const displayText = truncated.slice(0, visibleLen)
  const displayWidth = Math.min(measureText(displayText), MAX_WIDTH)
  // Use full target width for bubble so it doesn't resize during typing
  const targetWidth = Math.min(measureText(truncated), MAX_WIDTH)

  const drawBubble = useCallback(
    (g: PixiGraphics) => {
      g.clear()

      const bubbleW = targetWidth + PADDING * 2
      const bubbleH = FONT_SIZE + PADDING * 2
      const bx = -bubbleW / 2
      const by = -bubbleH - TAIL_SIZE

      // shadow
      g.setFillStyle({ color: 0x000000, alpha: 0.1 })
      g.roundRect(bx + 2, by + 2, bubbleW, bubbleH, 4)
      g.fill()

      // border
      g.setFillStyle({ color: BORDER_COLOR })
      g.roundRect(bx - 1, by - 1, bubbleW + 2, bubbleH + 2, 4)
      g.fill()

      // background
      g.setFillStyle({ color: BG_COLOR })
      g.roundRect(bx, by, bubbleW, bubbleH, 3)
      g.fill()

      // tail
      g.setFillStyle({ color: BG_COLOR })
      g.moveTo(-TAIL_SIZE / 2, by + bubbleH)
      g.lineTo(TAIL_SIZE / 2, by + bubbleH)
      g.lineTo(0, by + bubbleH + TAIL_SIZE)
      g.closePath()
      g.fill()

      // typing cursor blink when still revealing
      if (visibleLen < truncated.length) {
        const cursorX = -targetWidth / 2 + displayWidth + 1
        const cursorY = -(FONT_SIZE + PADDING * 2) - TAIL_SIZE + PADDING
        const blink = Math.floor(bobRef.current * 4) % 2 === 0
        if (blink) {
          g.setFillStyle({ color: 0x1a1a2e })
          g.rect(cursorX, cursorY, 1, FONT_SIZE)
          g.fill()
        }
      }
    },
    [targetWidth, visibleLen, truncated.length, displayWidth]
  )

  const textX = -targetWidth / 2
  const textY = -(FONT_SIZE + PADDING * 2) - TAIL_SIZE + PADDING

  return (
    <pixiContainer x={x} y={y + bobY} alpha={0.95}>
      <pixiGraphics draw={drawBubble} />
      <pixiText
        text={displayText}
        x={textX}
        y={textY}
        style={{ fontSize: FONT_SIZE, fill: 0x1a1a2e, fontFamily: 'monospace' }}
      />
    </pixiContainer>
  )
}
