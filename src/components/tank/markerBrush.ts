// 포토샵 마커 브러시(.abr)에서 추출한 결 텍스처를 "패턴"으로 사용해
// 외곽선은 깔끔하고 내부에만 마커 결이 있는 사각(치즐) 마카 획을 재현한다.
// (extract_abr.mjs 로 public/brushes/marker4.png 생성 — 치즐 마커 결)

const TEXTURE_FILE = 'brushes/marker4.png'
const DEFAULT_COLOR = '#1b1b1b'
/** 모든 마커 획(격자·X·O·사용자 드로잉)의 두께(px). 여기 한 곳에서만 관리. */
export const MARKER_BRUSH_WIDTH = 20
// 결의 가장 어두운 부분이 갖는 알파 바닥값. 낮출수록 결(까끌함)이 또렷해진다.
// 0.62=거의 매끈 / 0.5=살짝 결 / 0.35 이하=많이 까끌
const MIN_ALPHA = 0.5

let tintCanvas: HTMLCanvasElement | null = null
let ready = false
let loading = false
const readyCbs: Array<() => void> = []
const patternCache = new WeakMap<CanvasRenderingContext2D, CanvasPattern>()

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** grayscale 결 텍스처(흰=잉크)를 지정 색 + 알파(=휘도, 단 MIN_ALPHA 바닥) 패턴으로 변환 */
export function preloadMarkerBrush(color = DEFAULT_COLOR) {
  if (tintCanvas || loading || typeof window === 'undefined') return
  loading = true
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const cx = c.getContext('2d')!
    cx.drawImage(img, 0, 0)
    const id = cx.getImageData(0, 0, c.width, c.height)
    const d = id.data
    const [r, g, b] = hexToRgb(color)
    for (let i = 0; i < d.length; i += 4) {
      const lum = d[i] / 255 // grayscale: r=g=b
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
      // 결을 은은하게: 어두운 결도 MIN_ALPHA 이상 유지
      d[i + 3] = Math.round((MIN_ALPHA + (1 - MIN_ALPHA) * lum) * 255)
    }
    cx.putImageData(id, 0, 0)
    tintCanvas = c
    ready = true
    loading = false
    readyCbs.splice(0).forEach((cb) => cb())
  }
  img.onerror = () => {
    loading = false
  }
  img.src = `${import.meta.env.BASE_URL}${TEXTURE_FILE}`
}

export function isMarkerBrushReady() {
  return ready
}

export function onMarkerBrushReady(cb: () => void) {
  if (ready) cb()
  else readyCbs.push(cb)
}

function getPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (!tintCanvas) return null
  let pat = patternCache.get(ctx)
  if (!pat) {
    pat = ctx.createPattern(tintCanvas, 'repeat')!
    patternCache.set(ctx, pat)
  }
  return pat
}

/**
 * 마커 결 패턴으로 stroke 스타일을 설정한다. 텍스처가 준비됐으면 true.
 * 호출 후 ctx.stroke()로 깔끔한 외곽 + 내부 결의 마커 획을 그린다.
 */
export function applyMarkerBrushStroke(
  ctx: CanvasRenderingContext2D,
  brushSize = MARKER_BRUSH_WIDTH,
): boolean {
  const pat = getPattern(ctx)
  if (!pat) return false
  ctx.strokeStyle = pat
  ctx.lineWidth = brushSize
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  return true
}
