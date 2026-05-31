import { useRef, useMemo, useEffect, useCallback } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { preloadMarkerBrush, applyMarkerBrushStroke } from './markerBrush'

// 마커 브러시 결 텍스처 미리 로드 (window 있을 때만)
preloadMarkerBrush()

export const PAINT_TEXTURE_SIZE = 1024
export const BRUSH_RADIUS_PX = 28

export function createPaintTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = PAINT_TEXTURE_SIZE
  canvas.height = PAINT_TEXTURE_SIZE
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PAINT_TEXTURE_SIZE, PAINT_TEXTURE_SIZE)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  return { canvas, ctx, texture }
}

export function createTraceTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = PAINT_TEXTURE_SIZE
  canvas.height = PAINT_TEXTURE_SIZE
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, PAINT_TEXTURE_SIZE, PAINT_TEXTURE_SIZE)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  return { canvas, ctx, texture }
}

export function paintClearStroke(
  ctx: CanvasRenderingContext2D,
  u: number,
  v: number,
  size = PAINT_TEXTURE_SIZE,
  radius = BRUSH_RADIUS_PX,
) {
  const x = u * size
  const y = (1 - v) * size
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, '#000000')
  gradient.addColorStop(1, '#ffffff')

  ctx.save()
  ctx.globalCompositeOperation = 'darken'
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function paintTraceStroke(
  ctx: CanvasRenderingContext2D,
  u: number,
  v: number,
  size = PAINT_TEXTURE_SIZE,
  radius = BRUSH_RADIUS_PX,
) {
  const x = u * size
  const y = (1 - v) * size
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 1)')
  gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.6)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function resetPaintCanvas(ctx: CanvasRenderingContext2D, size = PAINT_TEXTURE_SIZE) {
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
}

export function resetTraceCanvas(ctx: CanvasRenderingContext2D, size = PAINT_TEXTURE_SIZE) {
  ctx.clearRect(0, 0, size, size)
}

export interface UVPoint {
  u: number
  v: number
}

export const MARKER_COLOR = '#1b1b1b'
export const MARKER_WIDTH = 6

export function applyMarkerStyle(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = MARKER_COLOR
  ctx.lineWidth = MARKER_WIDTH
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

export function uvToCanvasPx(u: number, v: number, size = PAINT_TEXTURE_SIZE) {
  return { x: u * size, y: (1 - v) * size }
}

/** 마커 손그림 느낌: 직선을 살짝 흔들리는 다중 세그먼트로 변환 (seed로 안정적) */
export function makeWobblyLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rng: () => number,
  overshootRatio = 0.05,
  wobble = MARKER_WIDTH * 3,
) {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1
  const dx = (x1 - x0) / len
  const dy = (y1 - y0) / len
  const px = -dy
  const py = dx
  const over0 = len * overshootRatio * (0.6 + rng() * 0.8)
  const over1 = len * overshootRatio * (0.6 + rng() * 0.8)
  const segs = Math.max(6, Math.floor(len / 45))
  const startT = -over0
  const endT = len + over1

  const pts: { x: number; y: number }[] = []
  for (let i = 0; i <= segs; i++) {
    const f = i / segs
    const t = startT + (endT - startT) * f
    // 양 끝은 흔들림 약하게(붓이 안정), 가운데서 강하게
    const taper = Math.sin(f * Math.PI)
    const off = (rng() - 0.5) * wobble * taper
    pts.push({ x: x0 + dx * t + px * off, y: y0 + dy * t + py * off })
  }
  return pts
}

/** 점 배열을 progress(0~1)만큼 부드러운 곡선으로 그림. 마커 결 패턴이 있으면 그 스타일로 stroke. */
export function strokeWobblyPath(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  progress = 1,
  opts?: { brushSize?: number; seed?: number },
) {
  if (pts.length < 2) return
  applyMarkerBrushStroke(ctx, opts?.brushSize)
  const t = Math.max(0, Math.min(1, progress))
  const last = 1 + (pts.length - 1) * t
  const count = Math.max(2, Math.min(pts.length, Math.ceil(last)))

  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < count - 1; i++) {
    const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 }
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mid.x, mid.y)
  }
  const end = pts[count - 1]
  ctx.lineTo(end.x, end.y)
  ctx.stroke()
}

export function drawOStroke(
  ctx: CanvasRenderingContext2D,
  points: UVPoint[],
  size = PAINT_TEXTURE_SIZE,
) {
  if (points.length < 2) return
  ctx.save()
  applyMarkerStyle(ctx)
  applyMarkerBrushStroke(ctx)
  ctx.beginPath()
  const first = uvToCanvasPx(points[0].u, points[0].v, size)
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < points.length - 1; i++) {
    const a = uvToCanvasPx(points[i].u, points[i].v, size)
    const b = uvToCanvasPx(points[i + 1].u, points[i + 1].v, size)
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2)
  }
  const lastP = uvToCanvasPx(points[points.length - 1].u, points[points.length - 1].v, size)
  ctx.lineTo(lastP.x, lastP.y)
  ctx.stroke()
  ctx.restore()
}

interface UseFrostedGlassPaintOptions {
  onDrawStart?: () => void
  onDrawEnd?: () => void
}

export function useFrostedGlassPaint(options: UseFrostedGlassPaintOptions = {}) {
  const { onDrawStart, onDrawEnd } = options
  const paintResources = useMemo(() => createPaintTexture(), [])
  const traceResources = useMemo(() => createTraceTexture(), [])
  const { ctx: paintCtx, texture: paintTexture } = paintResources
  const { ctx: traceCtx, texture: traceTexture } = traceResources
  const isDrawingRef = useRef(false)
  const freePrevRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    return () => {
      paintTexture.dispose()
      traceTexture.dispose()
    }
  }, [paintTexture, traceTexture])

  const paintAtUV = useCallback((u: number, v: number) => {
    // 김 닦기(roughness)
    paintClearStroke(paintCtx, u, v)
    // 마커 자국: 게임과 동일한 패턴 + 두께로 연속 스트로크
    const cur = uvToCanvasPx(u, v)
    const prev = freePrevRef.current
    traceCtx.save()
    applyMarkerStyle(traceCtx)
    applyMarkerBrushStroke(traceCtx)
    traceCtx.beginPath()
    traceCtx.moveTo(prev ? prev.x : cur.x, prev ? prev.y : cur.y)
    traceCtx.lineTo(cur.x, cur.y)
    traceCtx.stroke()
    traceCtx.restore()
    freePrevRef.current = cur
    paintTexture.needsUpdate = true
    traceTexture.needsUpdate = true
  }, [paintCtx, paintTexture, traceCtx, traceTexture])

  const resetPaint = useCallback(() => {
    resetPaintCanvas(paintCtx)
    resetTraceCanvas(traceCtx)
    paintTexture.needsUpdate = true
    traceTexture.needsUpdate = true
  }, [paintCtx, paintTexture, traceCtx, traceTexture])

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    freePrevRef.current = null
    onDrawEnd?.()
  }, [onDrawEnd])

  const startDrawing = useCallback(() => {
    if (isDrawingRef.current) return
    isDrawingRef.current = true
    freePrevRef.current = null
    onDrawStart?.()
  }, [onDrawStart])

  useEffect(() => {
    const handlePointerUp = () => stopDrawing()
    window.addEventListener('pointerup', handlePointerUp)
    return () => window.removeEventListener('pointerup', handlePointerUp)
  }, [stopDrawing])

  return {
    paintTexture,
    traceTexture,
    paintCtx,
    traceCtx,
    isDrawingRef,
    paintAtUV,
    resetPaint,
    resetTrace: useCallback(() => {
      resetTraceCanvas(traceCtx)
      traceTexture.needsUpdate = true
    }, [traceCtx, traceTexture]),
    markTraceDirty: useCallback(() => {
      traceTexture.needsUpdate = true
    }, [traceTexture]),
    startDrawing,
    stopDrawing,
  }
}

interface CreateGlassPointerHandlersOptions {
  isDrawingRef: React.RefObject<boolean>
  paintAtUV: (u: number, v: number) => void
  resetPaint: () => void
  startDrawing: () => void
  stopDrawing: () => void
  paintMode?: 'free' | 'game'
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void
  onPointerUp?: (e: ThreeEvent<PointerEvent>) => void
  onPointerLeave?: () => void
}

export function createGlassPointerHandlers({
  isDrawingRef,
  paintAtUV,
  resetPaint,
  startDrawing,
  stopDrawing,
  paintMode = 'free',
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
}: CreateGlassPointerHandlersOptions) {
  const isFreeMode = paintMode === 'free'

  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      onPointerMove?.(e)
      onPointerDown?.(e)
      if (isFreeMode) {
        startDrawing()
        if (e.uv) paintAtUV(e.uv.x, e.uv.y)
      }
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      onPointerMove?.(e)
      if (isFreeMode && isDrawingRef.current && e.uv) {
        paintAtUV(e.uv.x, e.uv.y)
      }
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      onPointerUp?.(e)
      if (isFreeMode) stopDrawing()
    },
    onPointerLeave: () => {
      if (isFreeMode) stopDrawing()
      onPointerLeave?.()
    },
    onDoubleClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      if (isFreeMode) resetPaint()
    },
  }
}
