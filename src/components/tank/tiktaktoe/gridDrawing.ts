import {
  PAINT_TEXTURE_SIZE,
  applyMarkerStyle,
  makeWobblyLine,
  strokeWobblyPath,
  drawOStroke,
  type UVPoint,
} from '../frostedGlassPaint'
import type { Board } from './tictactoeAi'
import type { GridLayout } from './gridLayout'
import { gridLinesLocal, boardLocalToCanvas, cellLocalRect } from './gridLayout'

export interface TraceDrawAPI {
  traceCtx: CanvasRenderingContext2D
  markTraceDirty: () => void
}

export type OStrokeMap = Record<number, UVPoint[]>

/** 작은 결정적 RNG (seed 기반) */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function layoutSeed(layout: GridLayout) {
  return Math.floor(
    (layout.cx * 1000 + 1) * 73856093 +
      (layout.cy * 1000 + 1) * 19349663 +
      (layout.rotation * 1000 + 1) * 83492791,
  )
}

type WobblyPath = { x: number; y: number }[]

interface HandDrawn {
  grid: WobblyPath[]
  marks: { x: [WobblyPath, WobblyPath]; o: WobblyPath }[]
}

const handCache = new WeakMap<GridLayout, HandDrawn>()

function buildHandDrawn(layout: GridLayout): HandDrawn {
  const rng = mulberry32(layoutSeed(layout))
  const size = PAINT_TEXTURE_SIZE

  const grid = gridLinesLocal(layout).map((ln) => {
    const a = boardLocalToCanvas(layout, ln.x0, ln.y0, size)
    const b = boardLocalToCanvas(layout, ln.x1, ln.y1, size)
    return makeWobblyLine(a.x, a.y, b.x, b.y, rng)
  })

  const marks = []
  for (let i = 0; i < 9; i++) {
    const r = cellLocalRect(layout, i, 0.2)
    // X: 두 대각선
    const tl = boardLocalToCanvas(layout, r.x0, r.yTop, size)
    const br = boardLocalToCanvas(layout, r.x1, r.yBot, size)
    const tr = boardLocalToCanvas(layout, r.x1, r.yTop, size)
    const bl = boardLocalToCanvas(layout, r.x0, r.yBot, size)
    const xDiag1 = makeWobblyLine(tl.x, tl.y, br.x, br.y, rng, 0.06, 5)
    const xDiag2 = makeWobblyLine(tr.x, tr.y, bl.x, bl.y, rng, 0.06, 5)

    // O fallback: 셀 둘레를 따라 흔들리는 원형 경로
    const cxL = (r.x0 + r.x1) / 2
    const cyL = (r.yTop + r.yBot) / 2
    const rad = Math.min(r.x1 - r.x0, r.yTop - r.yBot) / 2
    const oPath: WobblyPath = []
    const segs = 24
    for (let s = 0; s <= segs; s++) {
      const ang = (s / segs) * Math.PI * 2 - Math.PI / 2
      const jitter = 1 + (rng() - 0.5) * 0.16
      const lx = cxL + Math.cos(ang) * rad * jitter
      const ly = cyL + Math.sin(ang) * rad * jitter
      oPath.push(boardLocalToCanvas(layout, lx, ly, size))
    }

    marks.push({ x: [xDiag1, xDiag2] as [WobblyPath, WobblyPath], o: oPath })
  }

  return { grid, marks }
}

function getHandDrawn(layout: GridLayout): HandDrawn {
  let cached = handCache.get(layout)
  if (!cached) {
    cached = buildHandDrawn(layout)
    handCache.set(layout, cached)
  }
  return cached
}

export function getGridLines(layout: GridLayout, size = PAINT_TEXTURE_SIZE) {
  return gridLinesLocal(layout).map((ln) => {
    const a = boardLocalToCanvas(layout, ln.x0, ln.y0, size)
    const b = boardLocalToCanvas(layout, ln.x1, ln.y1, size)
    return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }
  })
}

function strokeGridFull(ctx: CanvasRenderingContext2D, layout: GridLayout) {
  ctx.save()
  applyMarkerStyle(ctx)
  getHandDrawn(layout).grid.forEach((path, idx) => {
    strokeWobblyPath(ctx, path, 1, { seed: idx * 131 })
  })
  ctx.restore()
}

function drawCellMark(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  i: number,
  mark: 'O' | 'X',
  oStrokes: OStrokeMap | undefined,
  xProgress: number,
) {
  const hand = getHandDrawn(layout).marks[i]
  ctx.save()
  applyMarkerStyle(ctx)
  if (mark === 'X') {
    const t1 = Math.max(0, Math.min(1, xProgress / 0.5))
    const t2 = Math.max(0, Math.min(1, (xProgress - 0.5) / 0.5))
    strokeWobblyPath(ctx, hand.x[0], t1, { seed: 100 + i * 7 })
    if (t2 > 0) strokeWobblyPath(ctx, hand.x[1], t2, { seed: 200 + i * 7 })
  } else {
    const userStroke = oStrokes?.[i]
    ctx.restore()
    if (userStroke && userStroke.length >= 2) {
      drawOStroke(ctx, userStroke)
    } else {
      ctx.save()
      applyMarkerStyle(ctx)
      strokeWobblyPath(ctx, hand.o, 1, { seed: 300 + i * 7 })
      ctx.restore()
    }
    return
  }
  ctx.restore()
}

/** 격자(완성) + 보드 마크 전체를 trace 캔버스에 다시 그린다. */
export function drawFullBoard(
  api: TraceDrawAPI,
  layout: GridLayout,
  board: Board,
  options?: { animatingXCell?: number; xProgress?: number; oStrokes?: OStrokeMap },
) {
  const { traceCtx: ctx, markTraceDirty } = api
  ctx.clearRect(0, 0, PAINT_TEXTURE_SIZE, PAINT_TEXTURE_SIZE)
  strokeGridFull(ctx, layout)

  const animCell = options?.animatingXCell ?? -1
  const xProgress = options?.xProgress ?? 1

  for (let i = 0; i < 9; i++) {
    if (board[i] === 'O') {
      drawCellMark(ctx, layout, i, 'O', options?.oStrokes, 1)
    } else if (board[i] === 'X') {
      drawCellMark(ctx, layout, i, 'X', options?.oStrokes, i === animCell ? xProgress : 1)
    }
  }
  markTraceDirty()
}

export function animateGridDraw(
  api: TraceDrawAPI,
  layout: GridLayout,
  onComplete: () => void,
  lineDurationMs = 260,
) {
  const lines = getHandDrawn(layout).grid
  const { traceCtx: ctx, markTraceDirty } = api
  let lineIndex = 0
  let lineStart = performance.now()
  let raf = 0

  const easeOut = (t: number) => 1 - Math.pow(1 - t, 2)

  const tick = (now: number) => {
    const elapsed = now - lineStart
    const progress = easeOut(Math.min(elapsed / lineDurationMs, 1))

    ctx.clearRect(0, 0, PAINT_TEXTURE_SIZE, PAINT_TEXTURE_SIZE)
    ctx.save()
    applyMarkerStyle(ctx)
    for (let i = 0; i < lineIndex; i++) {
      strokeWobblyPath(ctx, lines[i], 1, { seed: i * 131 })
    }
    if (lineIndex < lines.length) {
      strokeWobblyPath(ctx, lines[lineIndex], progress, { seed: lineIndex * 131 })
    }
    ctx.restore()
    markTraceDirty()

    if (elapsed >= lineDurationMs) {
      lineIndex++
      lineStart = now
      if (lineIndex >= lines.length) {
        onComplete()
        return
      }
    }
    raf = requestAnimationFrame(tick)
  }

  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

/** 한 칸에 X를 0→1로 그리는 애니메이션. */
export function animateMarkX(
  api: TraceDrawAPI,
  layout: GridLayout,
  board: Board,
  cellIndex: number,
  onComplete: () => void,
  oStrokes?: OStrokeMap,
  durationMs = 420,
) {
  const start = performance.now()
  let raf = 0

  const tick = (now: number) => {
    const progress = Math.min((now - start) / durationMs, 1)
    drawFullBoard(api, layout, board, { animatingXCell: cellIndex, xProgress: progress, oStrokes })
    if (progress >= 1) {
      onComplete()
      return
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}
