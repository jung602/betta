import { PAINT_TEXTURE_SIZE, type UVPoint } from '../frostedGlassPaint'

export interface CellBounds {
  u0: number
  v0: number
  u1: number
  v1: number
}

export interface GridLayout {
  planeWidth: number
  planeHeight: number
  cx: number // 보드 중심 (world)
  cy: number
  half: number // 보드 절반 크기 (world)
  rotation: number // 라디안
  cellWorldCenters: { x: number; y: number }[] // 베타용 (fishVisualScale 역보정)
}

function rotate(x: number, y: number, theta: number) {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return { x: x * c - y * s, y: x * s + y * c }
}

export function boardLocalToWorld(layout: GridLayout, lx: number, ly: number) {
  const r = rotate(lx, ly, layout.rotation)
  return { x: r.x + layout.cx, y: r.y + layout.cy }
}

export function worldToCanvas(layout: GridLayout, wx: number, wy: number, size = PAINT_TEXTURE_SIZE) {
  const u = wx / layout.planeWidth + 0.5
  const v = wy / layout.planeHeight + 0.5
  return { x: u * size, y: (1 - v) * size }
}

export function boardLocalToCanvas(layout: GridLayout, lx: number, ly: number, size = PAINT_TEXTURE_SIZE) {
  const w = boardLocalToWorld(layout, lx, ly)
  return worldToCanvas(layout, w.x, w.y, size)
}

/** UV 점이 어느 칸인지 (회전 역보정). 보드 밖이면 -1 */
export function uvToCellIndex(layout: GridLayout, u: number, v: number): number {
  const wx = (u - 0.5) * layout.planeWidth
  const wy = (v - 0.5) * layout.planeHeight
  const dx = wx - layout.cx
  const dy = wy - layout.cy
  const local = rotate(dx, dy, -layout.rotation)
  const { half } = layout
  if (Math.abs(local.x) > half || Math.abs(local.y) > half) return -1
  const step = (2 * half) / 3
  const col = Math.min(2, Math.max(0, Math.floor((local.x + half) / step)))
  const row = Math.min(2, Math.max(0, Math.floor((half - local.y) / step)))
  return row * 3 + col
}

/** 칸의 로컬 사각형 (패딩 적용 가능) */
export function cellLocalRect(layout: GridLayout, i: number, padRatio = 0) {
  const { half } = layout
  const step = (2 * half) / 3
  const col = i % 3
  const row = Math.floor(i / 3)
  const pad = step * padRatio
  const x0 = -half + col * step + pad
  const x1 = -half + (col + 1) * step - pad
  const yTop = half - row * step - pad
  const yBot = half - (row + 1) * step + pad
  return { x0, x1, yTop, yBot }
}

/** 격자 '#' 4선의 로컬 좌표 끝점 */
export function gridLinesLocal(layout: GridLayout) {
  const { half } = layout
  const inner = half / 3
  return [
    { x0: -inner, y0: half, x1: -inner, y1: -half },
    { x0: inner, y0: half, x1: inner, y1: -half },
    { x0: -half, y0: inner, x1: half, y1: inner },
    { x0: -half, y0: -inner, x1: half, y1: -inner },
  ]
}

/** 스트로크 점들이 가장 많이 머문 칸 */
export function strokeToCell(points: UVPoint[], layout: GridLayout): number {
  if (points.length === 0) return -1
  const counts = new Array(9).fill(0)
  for (const p of points) {
    const c = uvToCellIndex(layout, p.u, p.v)
    if (c >= 0) counts[c]++
  }
  let best = -1
  let bestCount = 0
  for (let i = 0; i < 9; i++) {
    if (counts[i] > bestCount) {
      bestCount = counts[i]
      best = i
    }
  }
  return bestCount >= Math.max(3, points.length * 0.35) ? best : -1
}

/** 느슨한 O 판정: 충분한 점 + 대략 닫힌 곡선 */
export function isClosedStroke(points: UVPoint[]): boolean {
  if (points.length < 6) return false
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  for (const p of points) {
    minU = Math.min(minU, p.u)
    maxU = Math.max(maxU, p.u)
    minV = Math.min(minV, p.v)
    maxV = Math.max(maxV, p.v)
  }
  const bboxW = maxU - minU
  const bboxH = maxV - minV
  const diag = Math.hypot(bboxW, bboxH)
  if (diag < 0.01) return false
  const first = points[0]
  const last = points[points.length - 1]
  const closeDist = Math.hypot(first.u - last.u, first.v - last.v)
  return closeDist < diag * 0.6
}

export function createRandomGridLayout(
  planeWidth: number,
  planeHeight: number,
  fishVisualScale: number,
): GridLayout {
  const minDim = Math.min(planeWidth, planeHeight)
  const boardSize = minDim * (0.45 + Math.random() * 0.2)
  const half = boardSize / 2
  const cx = (Math.random() - 0.5) * planeWidth * 0.28
  const cy = (Math.random() - 0.5) * planeHeight * 0.28
  const rotation = (Math.random() - 0.5) * 0.32 // ±~9도

  const layout: GridLayout = {
    planeWidth,
    planeHeight,
    cx,
    cy,
    half,
    rotation,
    cellWorldCenters: [],
  }

  const step = (2 * half) / 3
  for (let i = 0; i < 9; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const lx = -half + (col + 0.5) * step
    const ly = half - (row + 0.5) * step
    const w = boardLocalToWorld(layout, lx, ly)
    layout.cellWorldCenters.push({ x: w.x / fishVisualScale, y: w.y / fishVisualScale })
  }

  return layout
}
