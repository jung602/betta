import { useRef, useEffect, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react'
import { TANK_MODELS, type TankModelKey } from '../tank'
import { TAIL_PRESETS, type TailPresetKey } from '../fish'
import type { GamePhase } from '../tank/tiktaktoe/useTictactoeGame'
import type { Cell } from '../tank/tiktaktoe/tictactoeAi'
import type { GameSurfaceApi } from '../tank/TankGame'
import { PAINT_TEXTURE_SIZE, type UVPoint } from '../tank/frostedGlassPaint'
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
            // 화면상 비율(rect.aspect = 가로/세로)로 표시 박스를 잡아 패널에 맞춤.
            // 텍스처 크롭(rect.w×rect.h)을 이 박스로 비균등 스케일해 메시와 동일하게 펴짐.
            const aspect = rect.aspect > 0 ? rect.aspect : rect.w / rect.h
            let dw = dst.width * BOARD_FIT
            let dh = dw / aspect
            if (dh > dst.height * BOARD_FIT) {
              dh = dst.height * BOARD_FIT
              dw = dh * aspect
            }
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

const CAROUSEL_ICON_SIZE = 24
const ARROW_FILL = 'rgba(85, 102, 170, 0.9)'

type PickerItem<K extends string> = { key: K; icon: string; label: string }

function GridArrow({
  direction,
  onClick,
  ariaLabel,
}: {
  direction: 'left' | 'right'
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 30,
        height: 30,
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={15}
        height={15}
        viewBox="0 0 16 16"
        style={{
          transform: direction === 'left' ? 'rotate(90deg)' : 'rotate(-90deg)',
        }}
      >
        <polygon points="2,5 14,5 8,12" fill={ARROW_FILL} />
      </svg>
    </button>
  )
}

function OptionCarousel<K extends string>({
  items,
  selected,
  onSelect,
}: {
  items: PickerItem<K>[]
  selected: K
  onSelect: (key: K) => void
}) {
  if (items.length === 0) return null

  const index = Math.max(0, items.findIndex(item => item.key === selected))
  const item = items[index]
  const prev = () => onSelect(items[(index - 1 + items.length) % items.length].key)
  const next = () => onSelect(items[(index + 1) % items.length].key)

  return (
    <div
      role="group"
      aria-label={`${item.label} 선택`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        maxWidth: 320,
      }}
    >
      <GridArrow direction="left" onClick={prev} ariaLabel="이전 옵션" />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          transform: 'translateX(-12px)',
        }}
      >
        <img
          src={item.icon}
          alt=""
          style={{
            width: CAROUSEL_ICON_SIZE,
            height: CAROUSEL_ICON_SIZE,
            flexShrink: 0,
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
        <span
          style={{
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'rgba(85, 102, 170, 1)',
            whiteSpace: 'nowrap',
          }}
        >
          {item.label}
        </span>
      </div>
      <GridArrow direction="right" onClick={next} ariaLabel="다음 옵션" />
    </div>
  )
}

/** 그리드 바 중앙 접기/펼치기 버튼 */
function CollapseToggle({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={collapsed ? '펼치기' : '접기'}
      onClick={onClick}
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 5,
        width: 30,
        height: 30,
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        style={{
          transform: collapsed ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.25s ease',
        }}
      >
        <polygon points="2,5 14,5 8,12" fill="rgba(85, 102, 170, 0.9)" />
      </svg>
    </button>
  )
}

/** 접힌 상태: 원래 높이 바에 게임 상태 텍스트만 */
function StatusBar({ status }: { status: string | null }) {
  return (
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
      {status && (
        <div
          style={{
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'rgba(85, 102, 170, 1)',
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
  const [collapsed, setCollapsed] = useState(false)
  // 세로(가로<세로) 화면이면 게임 진입 시 기본 접힘 — 누르면 펼침
  useEffect(() => {
    if (gameActive) {
      setCollapsed(window.innerHeight > window.innerWidth)
    } else {
      setCollapsed(false)
    }
  }, [gameActive])
  const expanded = gameActive && !collapsed

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 0,
        display: 'flex',
        // 펼침(게임 중 + 미접힘)일 때만 절반 높이로 확대, 그 외엔 원래 64px
        flexGrow: expanded ? 1 : 0,
        flexShrink: expanded ? 1 : 0,
        flexBasis: expanded ? 0 : 64,
        transition: 'flex-grow 0.45s ease, flex-basis 0.45s ease',
        overflow: 'hidden',
      }}
    >
      {gameActive && (
        <CollapseToggle collapsed={collapsed} onClick={() => setCollapsed(c => !c)} />
      )}
      {gameActive ? (
        expanded ? (
          <GamePanel surfaceRef={gameSurfaceRef} status={statusText} />
        ) : (
          <StatusBar status={statusText} />
        )
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
            <OptionCarousel items={TANK_ITEMS} selected={tankModel} onSelect={onTankSelect} />
          ) : openPanel === 'fish' ? (
            <OptionCarousel items={TAIL_ITEMS} selected={tailPreset} onSelect={onTailSelect} />
          ) : null}
        </div>
      )}
    </div>
  )
}
