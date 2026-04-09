import { useCallback, useRef, useEffect } from 'react'
import { useTick } from '@pixi/react'
import type { Graphics as PixiGraphics, FederatedPointerEvent } from 'pixi.js'
import type { AgentWorker } from '../agents/types'
import { LEVEL_MULTIPLIER, LEVEL_ORDER, editRatio, totalToolCalls } from '../agents/types'
import { useOfficeStore } from '../agents/store'
import { SpeechBubble } from './SpeechBubble'
import { SkillLevelUp } from './SkillLevelUp'
import { SKILL_CATEGORIES, SKILL_SPECS } from '../skills/types'

const AGENT_COLORS: Record<string, number> = {
  claude: 0xe94560,
  codex: 0x22c55e,
  gemini: 0x60a5fa,
  unknown: 0x9ca3af,
}
const HAIR_COLORS: Record<string, number> = {
  claude: 0xc13050,
  codex: 0x1a9e3a,
  gemini: 0x4090d8,
  unknown: 0x7a7a8a,
}

// Workstation layout
const MONITOR_X = 30
const MONITOR_Y = 0
const MONITOR_W = 36
const MONITOR_H = 24
const SCREEN_PAD = 3

const DESK_Y = MONITOR_H + 4
const DESK_W = 96
const DESK_H = 16

const PERSON_X = 36
const PERSON_Y = DESK_Y + DESK_H + 2
const BODY_W = 24
const HEAD_SIZE = 14
const BODY_H = 12

const UNIT_CENTER_X = DESK_W / 2
const BUBBLE_Y = MONITOR_Y - 8
const SKIN = 0xfcd5b0

type Props = {
  worker: AgentWorker
  isSelected: boolean
}

// Facing direction based on status
type Facing = 'back' | 'front' | 'front-error' | 'offduty'
function getFacing(status: string): Facing {
  switch (status) {
    case 'typing':
    case 'reading':
    case 'running':
      return 'back'
    case 'error':
      return 'front-error'
    case 'offduty':
      return 'offduty'
    default:
      return 'front'
  }
}

export function Worker({ worker, isSelected }: Props) {
  const moveWorker = useOfficeStore((s) => s.moveWorker)
  const selectWorker = useOfficeStore((s) => s.selectWorker)
  const dragRef = useRef({ dragging: false, offsetX: 0, offsetY: 0 })

  const color = AGENT_COLORS[worker.agentType] ?? AGENT_COLORS.unknown
  const hairColor = HAIR_COLORS[worker.agentType] ?? HAIR_COLORS.unknown
  const facing = getFacing(worker.status)
  const isWorking = facing === 'back'
  const isOffduty = facing === 'offduty'
  const total = totalToolCalls(worker.toolCalls)
  const ratio = editRatio(worker.toolCalls)
  const glowColor = total === 0 || isOffduty ? -1
    : ratio >= 0.4 ? 0x22c55e
    : ratio >= 0.15 ? 0x60a5fa
    : 0xf97316
  // Animation state — all refs to avoid per-frame React re-renders
  const animTime = useRef(Math.random() * 10)
  const bodyBobRef = useRef(0)
  const handPhaseRef = useRef(false)
  const eyeOpenRef = useRef(true)
  const screenScrollRef = useRef(0)
  const gfxRef = useRef<PixiGraphics | null>(null)

  useTick(useCallback((ticker: { deltaMS: number }) => {
    const dt = ticker.deltaMS / 1000
    animTime.current += dt
    bodyBobRef.current = Math.sin(animTime.current * 2) * 1
    if (isWorking) {
      handPhaseRef.current = Math.floor(animTime.current * 4) % 2 === 0
      screenScrollRef.current = (animTime.current * 8) % 20
    }
    if (!isWorking) {
      eyeOpenRef.current = (animTime.current % 3.5) > 0.15
    }
    // Imperatively redraw without triggering React re-render
    if (gfxRef.current) {
      drawWorker(gfxRef.current)
    }
  }, [isWorking]))

  useEffect(() => {
    const onMouseMove = (e: PointerEvent) => {
      if (!dragRef.current.dragging) return
      const canvas = document.querySelector('canvas')
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const { scrollY } = useOfficeStore.getState()
      moveWorker(worker.id, {
        x: e.clientX - rect.left - dragRef.current.offsetX,
        y: e.clientY - rect.top - scrollY - dragRef.current.offsetY,
      })
    }
    const onMouseUp = () => { dragRef.current.dragging = false }
    window.addEventListener('pointermove', onMouseMove)
    window.addEventListener('pointerup', onMouseUp)
    return () => {
      window.removeEventListener('pointermove', onMouseMove)
      window.removeEventListener('pointerup', onMouseUp)
    }
  }, [worker.id, moveWorker])

  const drawWorker = useCallback((g: PixiGraphics) => {
    g.clear()

      // === HEATMAP GLOW (behind everything) ===
      if (glowColor >= 0) {
        g.setFillStyle({ color: glowColor, alpha: 0.12 })
        g.roundRect(-4, -4, DESK_W + 8, DESK_Y + DESK_H + PERSON_Y + 20, 6)
        g.fill()
      }

    const bodyBob = bodyBobRef.current
    const handPhase = handPhaseRef.current
    const eyeOpen = eyeOpenRef.current
    const screenScroll = screenScrollRef.current
    const px = PERSON_X
    const py = PERSON_Y + bodyBob

      // selection glow
      if (isSelected) {
        g.setFillStyle({ color: 0xfbbf24, alpha: 0.15 })
        g.roundRect(-6, -6, DESK_W + 12, py + HEAD_SIZE + BODY_H + 28, 6)
        g.fill()
      }

      // Dim entire workstation when offduty
      if (isOffduty) {
        g.setFillStyle({ color: 0x000000, alpha: 0.45 })
        g.rect(-6, MONITOR_Y - 6, DESK_W + 12, DESK_Y + DESK_H + 60)
        g.fill()
      }

      // === MONITOR ===
      g.setFillStyle({ color: 0x1a1a2e })
      g.roundRect(MONITOR_X - 1, MONITOR_Y - 1, MONITOR_W + 2, MONITOR_H + 2, 2)
      g.fill()
      const screenColor = isWorking ? 0x2ec4b6 : isOffduty ? 0x0a0a0a : 0x1e6e68
      g.setFillStyle({ color: screenColor })
      g.rect(MONITOR_X + SCREEN_PAD, MONITOR_Y + SCREEN_PAD,
        MONITOR_W - SCREEN_PAD * 2, MONITOR_H - SCREEN_PAD * 2)
      g.fill()
      if (isWorking) {
        // Scrolling code lines on screen
        g.setFillStyle({ color: 0x80ffee, alpha: 0.6 })
        for (let i = 0; i < 5; i++) {
          const lineY = MONITOR_Y + 4 + ((i * 4 + screenScroll) % 18)
          if (lineY > MONITOR_Y + 2 && lineY < MONITOR_Y + MONITOR_H - 4) {
            const w = 6 + Math.abs(((worker.id.charCodeAt(0) + i * 7) % 14))
            const indent = (i % 3) * 3
            g.rect(MONITOR_X + 4 + indent, lineY, w, 1.5)
            g.fill()
          }
        }
        // cursor blink
        const cursorY = MONITOR_Y + 4 + ((2 * 4 + screenScroll) % 18)
        if (cursorY > MONITOR_Y + 2 && cursorY < MONITOR_Y + MONITOR_H - 4) {
          const blink = Math.floor(animTime.current * 3) % 2 === 0
          if (blink) {
            g.setFillStyle({ color: 0xffffff, alpha: 0.9 })
            g.rect(MONITOR_X + 24, cursorY, 2, 2)
            g.fill()
          }
        }
      }
      // error screen
      if (facing === 'front-error') {
        g.setFillStyle({ color: 0xff4444 })
        g.rect(MONITOR_X + SCREEN_PAD, MONITOR_Y + SCREEN_PAD,
          MONITOR_W - SCREEN_PAD * 2, MONITOR_H - SCREEN_PAD * 2)
        g.fill()
        // "X" on screen
        g.setFillStyle({ color: 0xffffff })
        g.rect(MONITOR_X + 12, MONITOR_Y + 8, 4, 4)
        g.fill()
        g.rect(MONITOR_X + 20, MONITOR_Y + 8, 4, 4)
        g.fill()
        g.rect(MONITOR_X + 14, MONITOR_Y + 14, 8, 2)
        g.fill()
      }
      // stand + base
      g.setFillStyle({ color: 0x1a1a2e })
      g.rect(MONITOR_X + MONITOR_W / 2 - 4, MONITOR_Y + MONITOR_H, 8, 4)
      g.fill()
      g.rect(MONITOR_X + MONITOR_W / 2 - 8, MONITOR_Y + MONITOR_H + 3, 16, 2)
      g.fill()

      // === DESK ===
      g.setFillStyle({ color: 0x8b6914 })
      g.rect(0, DESK_Y, DESK_W, DESK_H)
      g.fill()
      g.setFillStyle({ color: 0xa07828 })
      g.rect(2, DESK_Y + 1, DESK_W - 4, 3)
      g.fill()
      g.setFillStyle({ color: 0x3a3a4a })
      g.rect(34, DESK_Y + 5, 28, 8)
      g.fill()
      g.setFillStyle({ color: 0x5a5a6a })
      g.rect(36, DESK_Y + 6, 24, 6)
      g.fill()

      // === PERSON ===
      // body
      g.setFillStyle({ color: isOffduty ? 0x555566 : color })
      g.rect(px, py + HEAD_SIZE, BODY_W, BODY_H)
      g.fill()

      if (isOffduty) {
        // --- OFFDUTY: slumped head on desk ---
        // Arms folded on desk
        g.setFillStyle({ color: 0x555566 })
        g.rect(px - 4, DESK_Y + 3, BODY_W + 8, 5)
        g.fill()
        // Head face-down on folded arms
        g.setFillStyle({ color: SKIN, alpha: 0.8 })
        g.rect(px + 5, DESK_Y - 6, HEAD_SIZE, HEAD_SIZE - 2)
        g.fill()
        // Hair
        g.setFillStyle({ color: hairColor, alpha: 0.8 })
        g.rect(px + 5, DESK_Y - 6, HEAD_SIZE, 6)
        g.fill()
      } else if (facing === 'back') {
        // --- BACK VIEW: facing monitor, working ---
        g.setFillStyle({ color: SKIN })
        g.rect(px + 4, py, HEAD_SIZE, HEAD_SIZE)
        g.fill()
        g.setFillStyle({ color: hairColor })
        g.rect(px + 4, py, HEAD_SIZE, 9)
        g.fill()
        // ears
        g.setFillStyle({ color: SKIN })
        g.rect(px + 3, py + 4, 2, 4)
        g.fill()
        g.rect(px + 4 + HEAD_SIZE - 1, py + 4, 2, 4)
        g.fill()
        // arms reaching to keyboard (alternating)
        g.setFillStyle({ color })
        const lArmY = handPhase ? -3 : -1
        const rArmY = handPhase ? -1 : -3
        g.rect(px - 2, py + HEAD_SIZE + lArmY, 6, 5)
        g.fill()
        g.rect(px + BODY_W - 4, py + HEAD_SIZE + rArmY, 6, 5)
        g.fill()
      } else {
        // --- FRONT VIEW: turned around, facing viewer ---
        // head
        g.setFillStyle({ color: SKIN })
        g.rect(px + 4, py, HEAD_SIZE, HEAD_SIZE)
        g.fill()
        // hair (top only, forehead visible)
        g.setFillStyle({ color: hairColor })
        g.rect(px + 4, py, HEAD_SIZE, 5)
        g.fill()

        if (facing === 'front-error') {
          // X_X eyes
          g.setFillStyle({ color: 0xff0000 })
          g.rect(px + 6, py + 6, 2, 2)
          g.fill()
          g.rect(px + 8, py + 8, 2, 2)
          g.fill()
          g.rect(px + 8, py + 6, 2, 2)
          g.fill()
          g.rect(px + 6, py + 8, 2, 2)
          g.fill()
          g.rect(px + 13, py + 6, 2, 2)
          g.fill()
          g.rect(px + 15, py + 8, 2, 2)
          g.fill()
          g.rect(px + 15, py + 6, 2, 2)
          g.fill()
          g.rect(px + 13, py + 8, 2, 2)
          g.fill()
          // wavy mouth (distress)
          g.rect(px + 7, py + 11, 2, 1)
          g.fill()
          g.rect(px + 9, py + 12, 2, 1)
          g.fill()
          g.rect(px + 11, py + 11, 2, 1)
          g.fill()
          g.rect(px + 13, py + 12, 2, 1)
          g.fill()
        } else {
          // eyes (blink animation)
          g.setFillStyle({ color: 0x1a1a2e })
          if (eyeOpen) {
            g.rect(px + 7, py + 6, 3, 3)
            g.fill()
            g.rect(px + 13, py + 6, 3, 3)
            g.fill()
            // eye shine
            g.setFillStyle({ color: 0xffffff })
            g.rect(px + 8, py + 6, 1, 1)
            g.fill()
            g.rect(px + 14, py + 6, 1, 1)
            g.fill()
          } else {
            // closed eyes (flat lines)
            g.rect(px + 7, py + 7, 3, 1)
            g.fill()
            g.rect(px + 13, py + 7, 3, 1)
            g.fill()
          }
          // relaxed smile
          g.setFillStyle({ color: 0xd4956b })
          g.rect(px + 9, py + 11, 5, 1)
          g.fill()
          g.rect(px + 8, py + 10, 1, 1)
          g.fill()
          g.rect(px + 14, py + 10, 1, 1)
          g.fill()
        }

        // arms resting at sides (turned around)
        g.setFillStyle({ color })
        g.rect(px - 3, py + HEAD_SIZE + 1, 4, 8)
        g.fill()
        g.rect(px + BODY_W - 1, py + HEAD_SIZE + 1, 4, 8)
        g.fill()
      }

      // chair
      g.setFillStyle({ color: 0x4a4e69 })
      g.rect(px + 2, py + HEAD_SIZE + BODY_H + 2, BODY_W - 4, 6)
      g.fill()

      // clone shimmer
      if (worker.isClone) {
        g.setFillStyle({ color: 0xffffff, alpha: 0.15 })
        g.rect(px, py, BODY_W, HEAD_SIZE + BODY_H)
        g.fill()
      }

      // level stars (left of monitor): 1 star=intern, 2=junior, 3=senior, 4=lead
      const levelStars = LEVEL_MULTIPLIER[worker.level]
      const starCount = LEVEL_ORDER.indexOf(worker.level) + 1
      const starColor = levelStars >= 2 ? 0xfbbf24 : levelStars >= 1.5 ? 0x60a5fa : 0x9ca3af
      for (let i = 0; i < starCount; i++) {
        g.setFillStyle({ color: starColor })
        g.rect(6 + i * 7, MONITOR_Y + 2, 5, 5)
        g.fill()
      }

      // name tag (grayed when offduty)
      const tagW = 56
      g.setFillStyle({ color: isOffduty ? 0x222233 : 0x000000, alpha: 0.6 })
      g.roundRect(UNIT_CENTER_X - tagW / 2, py + HEAD_SIZE + BODY_H + 12, tagW, 12, 2)
      g.fill()

      // === TOOL CALL BARS (left of monitor): edits / reads / runs ===
      const tc = worker.toolCalls
      const tcTotal = tc.edits + tc.reads + tc.runs
      if (tcTotal > 0) {
        const barW = 22
        const barY = MONITOR_Y
        g.setFillStyle({ color: 0x000000, alpha: 0.5 })
        g.roundRect(2, barY, barW, 10, 2)
        g.fill()
        // Stacked bar: edits (green) | reads (blue) | runs (orange)
        const scale = Math.min(1, tcTotal / 20)
        const eW = Math.round((tc.edits / tcTotal) * barW * scale)
        const rW = Math.round((tc.reads / tcTotal) * barW * scale)
        const xW = Math.round((tc.runs / tcTotal) * barW * scale)
        let bx = 3
        if (eW > 0) { g.setFillStyle({ color: 0x22c55e, alpha: 0.8 }); g.rect(bx, barY + 1, eW, 8); g.fill(); bx += eW }
        if (rW > 0) { g.setFillStyle({ color: 0x60a5fa, alpha: 0.8 }); g.rect(bx, barY + 1, rW, 8); g.fill(); bx += rW }
        if (xW > 0) { g.setFillStyle({ color: 0xf97316, alpha: 0.8 }); g.rect(bx, barY + 1, xW, 8); g.fill() }
      }

      // === SKILL BARS (below name plate) ===
      if (worker.skills) {
        const barMaxW = 10
        const barH = 2
        const barGap = 3
        const totalW = SKILL_CATEGORIES.length * (barMaxW + barGap) - barGap
        const barStartX = UNIT_CENTER_X - totalW / 2
        const barBaseY = py + HEAD_SIZE + BODY_H + 26
        SKILL_CATEGORIES.forEach((cat, i) => {
          const level = worker.skills[cat] ?? 0
          const bx = barStartX + i * (barMaxW + barGap)
          g.setFillStyle({ color: 0x000000, alpha: 0.4 })
          g.rect(bx, barBaseY, barMaxW, barH)
          g.fill()
          if (level > 0) {
            g.setFillStyle({ color: SKILL_SPECS[cat].color, alpha: 0.9 })
            g.rect(bx, barBaseY, Math.ceil((level / 10) * barMaxW), barH)
            g.fill()
          }
        })
      }
  }, [color, hairColor, facing, isWorking, isOffduty, isSelected, worker.isClone, worker.id,
     worker.toolCalls, worker.level, worker.skills, glowColor])

  const openContextMenu = useOfficeStore((s) => s.openContextMenu)

  const onPointerDown = useCallback(
    (e: FederatedPointerEvent) => {
      // Right-click → context menu
      if (e.button === 2) {
        e.preventDefault?.()
        const canvas = document.querySelector('canvas')
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          openContextMenu(worker.id, e.global.x + rect.left, e.global.y + rect.top)
        }
        return
      }
      dragRef.current = {
        dragging: true,
        offsetX: e.global.x - worker.position.x,
        offsetY: e.global.y - worker.position.y,
      }
      selectWorker(worker.id)
    },
    [worker.position.x, worker.position.y, worker.id, selectWorker, openContextMenu]
  )

  const nameY = PERSON_Y + HEAD_SIZE + BODY_H + 13

  return (
    <pixiContainer
      x={worker.position.x}
      y={worker.position.y}
      eventMode="static"
      cursor="grab"
      onPointerDown={onPointerDown}
    >
      <pixiGraphics draw={(g: PixiGraphics) => { gfxRef.current = g; drawWorker(g) }} />
      <pixiText
        text={worker.name}
        anchor={{ x: 0.5, y: 0 }}
        x={UNIT_CENTER_X}
        y={nameY}
        style={{ fontSize: 7, fill: isOffduty ? 0x666677 : 0xffffff, fontFamily: 'monospace' }}
      />
      {isOffduty
        ? <pixiText
            text="zzz"
            anchor={{ x: 0.5, y: 1 }}
            x={UNIT_CENTER_X}
            y={BUBBLE_Y}
            style={{ fontSize: 8, fill: 0x8888aa, fontFamily: 'monospace' }}
          />
        : <SpeechBubble text={worker.currentTask} x={UNIT_CENTER_X} y={BUBBLE_Y} />
      }
    </pixiContainer>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const WORKER_CENTER = { x: DESK_W / 2, y: (PERSON_Y + HEAD_SIZE) / 2 + 10 }
