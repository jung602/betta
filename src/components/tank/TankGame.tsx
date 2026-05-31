import { useRef, useCallback, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import FrostedGlassPlane, { type TraceAPI } from './FrostedGlassPlane'
import type { BufferGeometry } from 'three'
import {
  useTictactoeGame,
  animateGridDraw,
  animateMarkX,
  drawFullBoard,
  strokeToCell,
  isClosedStroke,
  type OStrokeMap,
} from './tiktaktoe'
import { drawOStroke, type UVPoint } from './frostedGlassPaint'
import { boardLocalToCanvas, type GridLayout } from './tiktaktoe/gridLayout'
import type { Bounds } from '../types'

/** 보드(격자) 전체가 차지하는 트레이스 캔버스 픽셀 사각형(회전 포함 bbox + 여백) */
function boardCanvasRect(layout: GridLayout | null) {
  if (!layout) return null
  const { halfX, halfY } = layout
  const corners: [number, number][] = [
    [-halfX, -halfY],
    [halfX, -halfY],
    [halfX, halfY],
    [-halfX, halfY],
  ]
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
  for (const [lx, ly] of corners) {
    const p = boardLocalToCanvas(layout, lx, ly)
    if (p.x < minx) minx = p.x
    if (p.x > maxx) maxx = p.x
    if (p.y < miny) miny = p.y
    if (p.y > maxy) maxy = p.y
  }
  const padX = (maxx - minx) * 0.08
  const padY = (maxy - miny) * 0.08
  const w = maxx - minx + 2 * padX
  const h = maxy - miny + 2 * padY
  // 텍스처 픽셀 비율(w:h)을 메시 매핑(planeWidth/planeHeight)으로 보정한 화면상 가로/세로 비율.
  // worldToCanvas가 축마다 다른 정규화를 쓰므로, 메시에 입히면 이 비율로 펴진다.
  const aspect = h > 0 ? (w * layout.planeWidth) / (h * layout.planeHeight) : 1
  return { x: minx - padX, y: miny - padY, w, h, aspect }
}

const BETTA_ARRIVE_DIST = 0.06
const BETTA_PAUSE_BEFORE_X_MS = 200
// 그리기 면(앞 유리)에서 살짝 안쪽으로 물려 물고기 몸이 유리를 뚫지 않도록
const BETTA_GLASS_BACKOFF = 0.05
// 상하/좌우(x,y) 여유: 작게 둬서 베타가 칸 끝까지 닿게(작은 어항에서 중간열에 갇히지 않도록)
const BETTA_LATERAL_MARGIN = 0.01
// 앞 유리(z) 관통 방지용 깊이 여유(box 어항). 코 길이만큼 충분히
const BETTA_FRONT_MARGIN = 0.08

type Game = ReturnType<typeof useTictactoeGame>

/** 외부(격자 패널)에서 트레이스 미러링 + 그리기를 할 수 있게 노출하는 핸들 */
export interface GameSurfaceApi {
  /** 격자/O/X가 그려지는 1024² 트레이스 캔버스(미러 소스) */
  traceCanvas: HTMLCanvasElement
  /** 보드 영역의 트레이스 캔버스 픽셀 사각형(패널 가운데 정렬용). aspect=화면상 가로/세로 비율. 없으면 null */
  getBoardRect: () => { x: number; y: number; w: number; h: number; aspect: number } | null
  beginStroke: () => void
  addPoint: (p: UVPoint) => void
  endStroke: (points: UVPoint[]) => void
}

interface TankGameProps {
  game: Game
  width: number
  height: number
  /** 모델의 'game' 메시 지오메트리(있으면 평면 대신 이 면 + 작성된 UV 사용) */
  geometry?: BufferGeometry
  /** 드로잉 면 중심(어항 로컬). 베타 타겟을 이 중심으로 보정 */
  offsetX?: number
  offsetY?: number
  /** 드로잉 면(앞 유리)의 z(어항 로컬). 베타가 X를 그릴 때 이 깊이로 헤엄치도록 */
  frontZ?: number
  /** 베타 유영 경계. 타겟을 이 안으로 클램프해 어항 밖으로 안 나가게 */
  bounds: Bounds
  position?: [number, number, number]
  mouseTarget: MutableRefObject<THREE.Vector3 | null>
  isHovered: MutableRefObject<boolean>
  fishPosRef: MutableRefObject<THREE.Vector3 | null>
  /** 유리에 스트로크 그리는 중인지 알림(true=시작, false=끝). 그리는 동안 카메라 회전 막는 용도 */
  onDrawingChange?: (drawing: boolean) => void
  /** 격자 패널이 트레이스 미러링/그리기를 할 수 있게 핸들을 받는 ref */
  gameSurfaceRef?: MutableRefObject<GameSurfaceApi | null>
}

/**
 * 어항 글래스 정면에 겹쳐지는 틱택토 게임.
 * BettaFish/배경/카메라는 렌더하지 않고, 어항의 베타를 전달받은 ref로 제어한다.
 * 좌표는 fishVisualScale=1 기준이라 cellWorldCenters가 곧 어항 그룹 로컬 좌표가 된다.
 */
export default function TankGame({
  game,
  width,
  height,
  geometry,
  offsetX = 0,
  offsetY = 0,
  frontZ = 0,
  bounds,
  position = [0, 0, 0],
  mouseTarget,
  isHovered,
  fishPosRef,
  onDrawingChange,
  gameSurfaceRef,
}: TankGameProps) {
  const traceApiRef = useRef<TraceAPI | null>(null)
  const phaseRef = useRef(game.phase)
  phaseRef.current = game.phase

  const arrivedRef = useRef(false)
  const liveStrokeRef = useRef<UVPoint[]>([])
  const oStrokesRef = useRef<OStrokeMap>({})

  // 베타가 특정 칸으로 헤엄치도록 타겟 지정 (게임 중 베타 턴에만 사용)
  // cellWorldCenters는 면 중심 기준 0,0이므로 offset으로 어항 로컬 좌표로 보정
  const setTargetLocal = useCallback(
    (x: number, y: number) => {
      let tx = x + offsetX
      let ty = y + offsetY
      // 앞 유리 쪽으로 최대한 붙이되, 몸이 유리/벽을 뚫지 않는 깊이(z)를 경계 안에서 계산.
      // z를 충분히 안쪽으로 두면 베타가 정면(+z)을 보지 않고 측면으로 서서 유리를 안 뚫는다.
      const lat = BETTA_LATERAL_MARGIN
      const frontTz = frontZ - BETTA_GLASS_BACKOFF
      let tz: number
      if (bounds.shape === 'cylinder') {
        // 반경 제약은 XZ평면. x를 클램프한 뒤 남는 만큼만 z 허용(자동으로 곡면 안쪽 깊이)
        const r = Math.max(bounds.radius - lat, 0.02)
        tx = THREE.MathUtils.clamp(tx, -r, r)
        ty = THREE.MathUtils.clamp(ty, -(bounds.y - lat), bounds.y - lat)
        const zMax = Math.sqrt(Math.max(0, r * r - tx * tx))
        tz = Math.min(frontTz, zMax)
      } else {
        tx = THREE.MathUtils.clamp(tx, -(bounds.x - lat), bounds.x - lat)
        ty = THREE.MathUtils.clamp(ty, -(bounds.y - lat), bounds.y - lat)
        // z만 앞 유리 관통 방지용으로 넉넉히 안쪽
        tz = Math.min(frontTz, bounds.z - BETTA_FRONT_MARGIN)
      }
      if (!mouseTarget.current) mouseTarget.current = new THREE.Vector3(tx, ty, tz)
      else mouseTarget.current.set(tx, ty, tz)
      isHovered.current = true
    },
    [mouseTarget, isHovered, offsetX, offsetY, frontZ, bounds],
  )

  // game 메시는 remapPlanarUVs로 V축이 뒤집혀 있어(위=v0), 격자/X를 찍는 worldToCanvas(위=v1)와
  // 규약이 반대다. 그래서 X는 메시상 -wy에 그려진다. 베타가 X 위치와 맞으려면 타겟 Y를 반전해야 한다.
  // (PlaneGeometry fallback인 squaretank는 규약이 같아 반전 불필요 → geometry 유무로 분기)
  const cellTarget = useCallback(
    (cellIdx: number): { x: number; y: number } | null => {
      const layout = game.gridLayout
      if (!layout) return null
      const c = layout.cellWorldCenters[cellIdx]
      if (!c) return null
      return { x: c.x, y: geometry ? -c.y : c.y }
    },
    [game.gridLayout, geometry],
  )

  // 스트로크 핸들러는 매 렌더 최신값으로 ref에 보관(클로저가 최신 game 상태를 보도록)
  const handlersRef = useRef<{
    start: () => void
    point: (p: UVPoint) => void
    end: (pts: UVPoint[]) => void
    rect: () => { x: number; y: number; w: number; h: number; aspect: number } | null
  } | null>(null)

  const handleTraceReady = useCallback(
    (api: TraceAPI) => {
      traceApiRef.current = api
      if (gameSurfaceRef) {
        gameSurfaceRef.current = {
          traceCanvas: api.traceCtx.canvas,
          getBoardRect: () => handlersRef.current?.rect() ?? null,
          beginStroke: () => handlersRef.current?.start(),
          addPoint: (p) => handlersRef.current?.point(p),
          endStroke: (pts) => handlersRef.current?.end(pts),
        }
      }
    },
    [gameSurfaceRef],
  )

  useEffect(() => {
    return () => {
      if (gameSurfaceRef) gameSurfaceRef.current = null
    }
  }, [gameSurfaceRef])

  const handleStrokeStart = useCallback(() => {
    onDrawingChange?.(true)
    liveStrokeRef.current = []
  }, [onDrawingChange])

  const handleStrokePoint = useCallback(
    (p: UVPoint) => {
      if (phaseRef.current !== 'userTurn') return
      const api = traceApiRef.current
      const layout = game.gridLayout
      if (!api || !layout) return
      liveStrokeRef.current.push(p)
      drawFullBoard(api, layout, game.board, { oStrokes: oStrokesRef.current })
      if (liveStrokeRef.current.length >= 2) drawOStroke(api.traceCtx, liveStrokeRef.current)
      api.markTraceDirty()
    },
    [game],
  )

  const handleStrokeEnd = useCallback(
    (points: UVPoint[]) => {
      onDrawingChange?.(false)
      liveStrokeRef.current = []
      const api = traceApiRef.current
      const layout = game.gridLayout
      if (phaseRef.current !== 'userTurn' || !api || !layout) return

      const cell = strokeToCell(points, layout)
      const valid = cell >= 0 && game.board[cell] === '' && isClosedStroke(points)

      if (valid) {
        oStrokesRef.current[cell] = points.slice()
        game.placeO(cell)
      } else {
        drawFullBoard(api, layout, game.board, { oStrokes: oStrokesRef.current })
      }
    },
    [game, onDrawingChange],
  )

  handlersRef.current = {
    start: handleStrokeStart,
    point: handleStrokePoint,
    end: handleStrokeEnd,
    rect: () => boardCanvasRect(game.gridLayout),
  }

  // 격자 그리기 애니메이션
  useEffect(() => {
    if (game.phase !== 'animating' || !game.gridLayout) return
    const api = traceApiRef.current
    if (!api) return
    oStrokesRef.current = {}
    api.resetPaint()
    const cancel = animateGridDraw(api, game.gridLayout, () => game.onGridAnimationComplete())
    return cancel
  }, [game.phase, game.gridLayout, game])

  // 보드 상태가 바뀌면 격자+마크 다시 그림
  useEffect(() => {
    if (!game.gridLayout) return
    const api = traceApiRef.current
    if (!api) return
    if (game.phase === 'userTurn' || game.phase === 'ended') {
      drawFullBoard(api, game.gridLayout, game.board, { oStrokes: oStrokesRef.current })
    }
  }, [game.phase, game.board, game.gridLayout])

  // 베타 이동 목표 설정
  useEffect(() => {
    if (game.phase === 'bettaMoving' && game.bettaTargetCell !== null && game.gridLayout) {
      const c = cellTarget(game.bettaTargetCell)
      if (c) setTargetLocal(c.x, c.y)
      arrivedRef.current = false
    } else {
      isHovered.current = false
    }
  }, [game.phase, game.bettaTargetCell, game.gridLayout, setTargetLocal, isHovered, cellTarget])

  useFrame(() => {
    if (game.phase !== 'bettaMoving' || arrivedRef.current) return
    const layout = game.gridLayout
    const cellIdx = game.bettaTargetCell
    const api = traceApiRef.current
    if (cellIdx === null || !layout || !api) return

    const fp = fishPosRef.current
    const dest = mouseTarget.current
    if (!fp || !dest) return
    // 실제 목적지(클램프된 mouseTarget)와의 XY 거리. 도착해야만 X를 그린다(시간 제한 없음).
    const dist = Math.hypot(fp.x - dest.x, fp.y - dest.y)

    if (dist < BETTA_ARRIVE_DIST) {
      arrivedRef.current = true
      const boardWithX = [...game.board]
      boardWithX[cellIdx] = 'X'
      window.setTimeout(() => {
        animateMarkX(api, layout, boardWithX, cellIdx, () => game.completeBettaMove(), oStrokesRef.current)
      }, BETTA_PAUSE_BEFORE_X_MS)
    }
  })

  const paintMode = game.phase === 'idle' ? 'free' : 'game'

  return (
    <FrostedGlassPlane
      width={width}
      height={height}
      geometry={geometry}
      position={position}
      paintMode={paintMode}
      onTraceReady={handleTraceReady}
      onStrokeStart={handleStrokeStart}
      onStrokePoint={handleStrokePoint}
      onStrokeEnd={handleStrokeEnd}
    />
  )
}
