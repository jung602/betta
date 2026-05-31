import { PAINT_TEXTURE_SIZE, type UVPoint } from '../frostedGlassPaint'

export interface GridLayout {
  planeWidth: number
  planeHeight: number
  cx: number // 보드 중심 (world)
  cy: number
  halfX: number // 보드 가로 절반 크기 (world)
  halfY: number // 보드 세로 절반 크기 (world)
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
  const { halfX, halfY } = layout
  if (Math.abs(local.x) > halfX || Math.abs(local.y) > halfY) return -1
  const stepX = (2 * halfX) / 3
  const stepY = (2 * halfY) / 3
  const col = Math.min(2, Math.max(0, Math.floor((local.x + halfX) / stepX)))
  const row = Math.min(2, Math.max(0, Math.floor((halfY - local.y) / stepY)))
  return row * 3 + col
}

/** 칸의 로컬 사각형 (패딩 적용 가능) */
export function cellLocalRect(layout: GridLayout, i: number, padRatio = 0) {
  const { halfX, halfY } = layout
  const stepX = (2 * halfX) / 3
  const stepY = (2 * halfY) / 3
  const col = i % 3
  const row = Math.floor(i / 3)
  const padX = stepX * padRatio
  const padY = stepY * padRatio
  const x0 = -halfX + col * stepX + padX
  const x1 = -halfX + (col + 1) * stepX - padX
  const yTop = halfY - row * stepY - padY
  const yBot = halfY - (row + 1) * stepY + padY
  return { x0, x1, yTop, yBot }
}

/** 격자 '#' 4선의 로컬 좌표 끝점 */
export function gridLinesLocal(layout: GridLayout) {
  const { halfX, halfY } = layout
  const innerX = halfX / 3
  const innerY = halfY / 3
  return [
    { x0: -innerX, y0: halfY, x1: -innerX, y1: -halfY },
    { x0: innerX, y0: halfY, x1: innerX, y1: -halfY },
    { x0: -halfX, y0: innerY, x1: halfX, y1: innerY },
    { x0: -halfX, y0: -innerY, x1: halfX, y1: -innerY },
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
  /** 베타가 도달 가능한 면 내 반경(반-폭/반-높이). 보드 전체가 이 안에 들어오도록 제한 */
  reach?: { x: number; y: number },
): GridLayout {
  // 보드는 game 메시(그리기 면) 기준으로 가로·세로를 꽉 채운다(직사각형 칸).
  // game 메시가 물보다 작으므로 칸들은 자동으로 베타 도달영역 안. reach는 안전장치로만 사용.
  const reachX = reach ? Math.max(reach.x, 0.05) : planeWidth / 2
  const reachY = reach ? Math.max(reach.y, 0.05) : planeHeight / 2
  const CELL_SPREAD = (2 / 3) * 1.2 // 셀 중심이 보드 중심에서 벗어나는 비율(+회전 여유)
  const sizeFactor = 0.5 + Math.random() * 0.1
  // 칸을 정사각형으로: 월드에서 가로·세로 반-크기를 동일하게(짧은 변 기준).
  // worldToCanvas가 planeWidth/planeHeight로 각각 정규화하므로 텍스처엔 비율 보정되어 그려지고,
  // 직사각형 메시에 입혀질 때 다시 펴져 화면상 정사각형 칸이 된다.
  const half = (Math.min(planeWidth, planeHeight) / 2) * sizeFactor
  const halfX = half
  const halfY = half
  const cellReachX = CELL_SPREAD * halfX
  const cellReachY = CELL_SPREAD * halfY
  // 중심 이동 범위: 보드 외곽이 그리기 면 안 + (안전) 셀 중심이 도달영역 안
  const cxRange = Math.max(0, Math.min(planeWidth / 2 - halfX, reachX - cellReachX))
  const cyRange = Math.max(0, Math.min(planeHeight / 2 - halfY, reachY - cellReachY))
  const cx = (Math.random() - 0.5) * 2 * cxRange
  const cy = (Math.random() - 0.5) * 2 * cyRange
  const rotation = (Math.random() - 0.5) * 0.32 // ±~9도

  const layout: GridLayout = {
    planeWidth,
    planeHeight,
    cx,
    cy,
    halfX,
    halfY,
    rotation,
    cellWorldCenters: [],
  }

  const stepX = (2 * halfX) / 3
  const stepY = (2 * halfY) / 3
  for (let i = 0; i < 9; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const lx = -halfX + (col + 0.5) * stepX
    const ly = halfY - (row + 0.5) * stepY
    const w = boardLocalToWorld(layout, lx, ly)
    layout.cellWorldCenters.push({ x: w.x / fishVisualScale, y: w.y / fishVisualScale })
  }

  return layout
}
