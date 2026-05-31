import { useRef, useEffect, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react'
import { TANK_MODELS, type TankModelKey } from '../tank'
import { TAIL_PRESETS, type TailPresetKey } from '../fish'
import type { GamePhase } from '../tank/tiktaktoe/useTictactoeGame'
import type { Cell } from '../tank/tiktaktoe/tictactoeAi'
import type { GameSurfaceApi } from '../tank/TankGame'
import { PAINT_TEXTURE_SIZE, type UVPoint } from '../tank/frostedGlassPaint'
import { GlossyGlow, GlossyHighlight } from './glossySurface'

const FONT =
  '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif'

const BASE = import.meta.env.BASE_URL

export const GRID_BAR_SURFACE = {
  border: '1.5px solid rgba(158, 158, 158, 0.35)',
  borderRadius: 20,
  boxShadow:
    '1px 1px 0px 0px rgba(255, 255, 255, 1), -1px -1px 0px 0px rgba(0, 0, 0, 0.1)',
  backgroundColor: '#eee',
  backgroundImage: `
    linear-gradient(rgba(158, 158, 158, 0.22) 1px, transparent 1px),
    linear-gradient(90deg, rgba(158, 158, 158, 0.22) 1px, transparent 1px)
  `,
  backgroundSize: '16px 16px',
} as const

const TANK_ICONS: Record<TankModelKey, string> = {
  square: 'icon/square.png',
  round: 'icon/tank.png',
  imac: 'icon/imac.png',
}

const TAIL_ICONS: Record<TailPresetKey, string> = {
  plakat: 'plakat.png',
  delta: 'delta.png',
  halfmoon: 'halfmoon.png',
  crowntail: 'crowntail.png',
  rosetail: 'rosetail.png',
  veiltail: 'veiltail.png',
  doubletail: 'doubletail.png',
}

const HIDDEN_TAIL: TailPresetKey[] = ['delta', 'halfmoon']

const TANK_ITEMS = (Object.keys(TANK_MODELS) as TankModelKey[]).map(key => ({
  key,
  icon: `${BASE}${TANK_ICONS[key]}`,
  label: TANK_MODELS[key].label,
}))

const TAIL_ITEMS = (Object.keys(TAIL_PRESETS) as TailPresetKey[])
  .filter(k => !HIDDEN_TAIL.includes(k))
  .map(key => ({
    key,
    icon: `${BASE}icon/${TAIL_ICONS[key]}`,
    label: TAIL_PRESETS[key].label,
  }))

const OPTION_SIZE = 46

function gameBarMessage(phase: GamePhase, winner: Cell, isDraw: boolean): string | null {
  switch (phase) {
    case 'animating':
      return 'DRAWING GRID...'
    case 'userTurn':
      return 'YOUR TURN'
    case 'bettaMoving':
      return "BETTA'S TURN"
    case 'ended':
      if (isDraw) return 'DRAW'
      if (winner === 'O') return 'YOU WIN'
      if (winner === 'X') return 'FISH WINS'
      return null
    default:
      return null
  }
}

function BarOptionButton({
  icon,
  label,
  selected,
  onSelect,
}: {
  icon: string
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onSelect}
      style={{
        position: 'relative',
        width: OPTION_SIZE,
        height: OPTION_SIZE,
        flexShrink: 0,
        borderRadius: '50%',
        border: 'none',
        backgroundColor: selected ? 'rgba(150, 222, 245, 1)' : 'rgba(224, 224, 224, 1)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        overflow: 'hidden',
        boxShadow: '1px 1px 0px 0px rgba(255, 255, 255, 1), 0px -1px 0px 0px rgba(0, 0, 0, 0.2)',
      }}
    >
      <GlossyHighlight variant="circle" theme="fafafa" />
      <GlossyGlow variant="circle" theme="fafafa" />
      <img
        src={icon}
        alt=""
        style={{
          position: 'absolute',
          zIndex: 2,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 30,
          height: 30,
          objectFit: 'contain',
          pointerEvents: 'none',
          filter: selected ? 'none' : 'grayscale(0.3) opacity(0.85)',
        }}
      />
    </button>
  )
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
/** 보드를 패널 안에 그릴 때 가장자리 여백 비율 */
const BOARD_FIT = 0.9

type Xform = { dx: number; dy: number; dw: number; dh: number; sx: number; sy: number; sw: number; sh: number }

/**
 * 게임 중 가운데 큰 격자 화면. 어항 유리 트레이스의 '보드 영역'만 잘라 패널 한가운데에
 * 상하반전(어항 유리와 같은 방향)으로 미러링한다. 여기에 드래그하면 어항에 그린 것과
 * 동일하게 게임에 입력된다. (어항 어디에 보드가 떠 있어도 패널엔 항상 가운데)
 */
function GamePanel({
  surfaceRef,
  status,
}: {
  surfaceRef?: MutableRefObject<GameSurfaceApi | null>
  status: string | null
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const xformRef = useRef<Xform | null>(null)
  const strokeRef = useRef<UVPoint[]>([])
  const drawingRef = useRef(false)

  // 백킹 캔버스 해상도를 표시 박스에 맞춤(가로세로 비율 보존)
  useEffect(() => {
    const el = canvasRef.current
    const wrap = wrapRef.current
    if (!el || !wrap) return
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      el.width = Math.max(1, Math.round(r.width * dpr))
      el.height = Math.max(1, Math.round(r.height * dpr))
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  // 보드 영역만 가운데·상하반전으로 미러링
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const dst = canvasRef.current
      const api = surfaceRef?.current
      if (dst) {
        const ctx = dst.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, dst.width, dst.height)
          const src = api?.traceCanvas
          const rect = api?.getBoardRect?.()
          if (src && rect && rect.w > 0 && rect.h > 0) {
            const scale = Math.min(dst.width / rect.w, dst.height / rect.h) * BOARD_FIT
            const dw = rect.w * scale
            const dh = rect.h * scale
            const dx = (dst.width - dw) / 2
            const dy = (dst.height - dh) / 2
            xformRef.current = { dx, dy, dw, dh, sx: rect.x, sy: rect.y, sw: rect.w, sh: rect.h }
            ctx.save()
            ctx.translate(dx, dy + dh)
            ctx.scale(1, -1) // 상하반전(어항 유리와 동일 방향)
            ctx.drawImage(src, rect.x, rect.y, rect.w, rect.h, 0, 0, dw, dh)
            ctx.restore()
          } else {
            xformRef.current = null
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [surfaceRef])

  // 패널 포인터 → 트레이스 UV (가운데 정렬 + 상하반전 역변환)
  const toUV = (e: ReactPointerEvent): UVPoint | null => {
    const el = canvasRef.current
    const xf = xformRef.current
    if (!el || !xf) return null
    const r = el.getBoundingClientRect()
    const dpr = el.width / r.width
    const px = (e.clientX - r.left) * dpr
    const py = (e.clientY - r.top) * dpr
    const fx = (px - xf.dx) / xf.dw
    const fyDisp = (py - xf.dy) / xf.dh
    const cx = xf.sx + clamp01(fx) * xf.sw
    const cy = xf.sy + (1 - clamp01(fyDisp)) * xf.sh // 반전 역변환
    return { u: clamp01(cx / PAINT_TEXTURE_SIZE), v: clamp01(1 - cy / PAINT_TEXTURE_SIZE) }
  }

  const onDown = (e: ReactPointerEvent) => {
    const api = surfaceRef?.current
    const p = toUV(e)
    if (!api || !p) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    strokeRef.current = [p]
    api.beginStroke()
    api.addPoint(p)
  }
  const onMove = (e: ReactPointerEvent) => {
    if (!drawingRef.current) return
    const api = surfaceRef?.current
    const p = toUV(e)
    if (!api || !p) return
    strokeRef.current.push(p)
    api.addPoint(p)
  }
  const onUp = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    surfaceRef?.current?.endStroke(strokeRef.current)
    strokeRef.current = []
  }

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        width: '100%',
        ...GRID_BAR_SURFACE,
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
      />
      {status && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'rgba(85, 102, 170, 1)',
            pointerEvents: 'none',
          }}
        >
          {status}
        </div>
      )}
    </div>
  )
}

export type GridBarPanel = 'tank' | 'fish' | null

interface GridBarProps {
  openPanel: GridBarPanel
  gameActive: boolean
  gamePhase: GamePhase
  winner: Cell
  isDraw: boolean
  tankModel: TankModelKey
  tailPreset: TailPresetKey
  onTankSelect: (key: TankModelKey) => void
  onTailSelect: (key: TailPresetKey) => void
  gameSurfaceRef?: MutableRefObject<GameSurfaceApi | null>
}

export default function GridBar({
  openPanel,
  gameActive,
  gamePhase,
  winner,
  isDraw,
  tankModel,
  tailPreset,
  onTankSelect,
  onTailSelect,
  gameSurfaceRef,
}: GridBarProps) {
  const statusText = gameActive ? gameBarMessage(gamePhase, winner, isDraw) : null

  return (
    <div
      style={{
        width: '100%',
        minHeight: 0,
        display: 'flex',
        // 게임 시작/종료 시 높이 자연스럽게 전환(어항 1/2 ↔ 격자 패널 확대)
        flexGrow: gameActive ? 1 : 0,
        flexShrink: gameActive ? 1 : 0,
        flexBasis: gameActive ? 0 : 80,
        transition: 'flex-grow 0.45s ease, flex-basis 0.45s ease',
        overflow: 'hidden',
      }}
    >
      {gameActive ? (
        <GamePanel surfaceRef={gameSurfaceRef} status={statusText} />
      ) : (
        <div
          style={{
            flex: 1,
            width: '100%',
            ...GRID_BAR_SURFACE,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
          }}
        >
          {openPanel === 'tank' ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                width: '100%',
                overflowX: 'auto',
              }}
            >
              {TANK_ITEMS.map(item => (
                <BarOptionButton
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  selected={tankModel === item.key}
                  onSelect={() => onTankSelect(item.key)}
                />
              ))}
            </div>
          ) : openPanel === 'fish' ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                width: '100%',
                overflowX: 'auto',
              }}
            >
              {TAIL_ITEMS.map(item => (
                <BarOptionButton
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  selected={tailPreset === item.key}
                  onSelect={() => onTailSelect(item.key)}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
