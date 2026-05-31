import { useMemo, useEffect, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import {
  useFrostedGlassPaint,
  createGlassPointerHandlers,
  type UVPoint,
} from './frostedGlassPaint'

export interface TraceAPI {
  traceCtx: CanvasRenderingContext2D
  markTraceDirty: () => void
  resetTrace: () => void
  resetPaint: () => void
}

interface FrostedGlassPlaneProps {
  width: number
  height: number
  /** 외부 지오메트리(모델의 'game' 메시). 주어지면 PlaneGeometry 대신 사용하고 UV도 그대로 사용 */
  geometry?: THREE.BufferGeometry
  position?: [number, number, number]
  showTrace?: boolean
  paintMode?: 'free' | 'game'
  onDrawStart?: () => void
  onDrawEnd?: () => void
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void
  onPointerLeave?: () => void
  onTraceReady?: (api: TraceAPI) => void
  onStrokeStart?: () => void
  onStrokePoint?: (point: UVPoint) => void
  onStrokeEnd?: (points: UVPoint[]) => void
}

export default function FrostedGlassPlane({
  width,
  height,
  geometry,
  position = [0, 0, 0],
  showTrace = true,
  paintMode = 'free',
  onDrawStart,
  onDrawEnd,
  onPointerMove,
  onPointerLeave,
  onTraceReady,
  onStrokeStart,
  onStrokePoint,
  onStrokeEnd,
}: FrostedGlassPlaneProps) {
  const fallbackGeo = useMemo(() => (geometry ? null : new THREE.PlaneGeometry(width, height)), [geometry, width, height])
  const planeGeo = geometry ?? fallbackGeo!

  useEffect(() => {
    return () => {
      fallbackGeo?.dispose()
    }
  }, [fallbackGeo])

  const {
    traceTexture,
    traceCtx,
    isDrawingRef,
    paintAtUV,
    resetPaint,
    resetTrace,
    markTraceDirty,
    startDrawing,
    stopDrawing,
  } = useFrostedGlassPaint({ onDrawStart, onDrawEnd })

  useEffect(() => {
    onTraceReady?.({ traceCtx, markTraceDirty, resetTrace, resetPaint })
  }, [onTraceReady, traceCtx, markTraceDirty, resetTrace, resetPaint])

  const strokeRef = useRef<UVPoint[]>([])
  const isStrokingRef = useRef(false)

  const gamePointerHandlers = useMemo(() => {
    if (paintMode !== 'game') return null
    return {
      onPointerDown: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        onPointerMove?.(e)
        if (!e.uv) return
        isStrokingRef.current = true
        strokeRef.current = [{ u: e.uv.x, v: e.uv.y }]
        onStrokeStart?.()
        onStrokePoint?.({ u: e.uv.x, v: e.uv.y })
      },
      onPointerMove: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        onPointerMove?.(e)
        if (!isStrokingRef.current || !e.uv) return
        const p = { u: e.uv.x, v: e.uv.y }
        strokeRef.current.push(p)
        onStrokePoint?.(p)
      },
      onPointerUp: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        if (!isStrokingRef.current) return
        isStrokingRef.current = false
        onStrokeEnd?.(strokeRef.current)
        strokeRef.current = []
      },
      onPointerLeave: () => {
        if (isStrokingRef.current) {
          isStrokingRef.current = false
          onStrokeEnd?.(strokeRef.current)
          strokeRef.current = []
        }
        onPointerLeave?.()
      },
    }
  }, [paintMode, onPointerMove, onPointerLeave, onStrokeStart, onStrokePoint, onStrokeEnd])

  const freePointerHandlers = useMemo(
    () =>
      createGlassPointerHandlers({
        isDrawingRef,
        paintAtUV,
        resetPaint,
        startDrawing,
        stopDrawing,
        paintMode: 'free',
        onPointerMove,
        onPointerLeave,
      }),
    [isDrawingRef, paintAtUV, resetPaint, startDrawing, stopDrawing, onPointerMove, onPointerLeave],
  )

  const pointerHandlers = gamePointerHandlers ?? freePointerHandlers

  return (
    <group position={position}>
      <mesh geometry={planeGeo} {...pointerHandlers}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {showTrace && (
        <mesh geometry={planeGeo} renderOrder={9}>
          <meshBasicMaterial
            map={traceTexture}
            transparent
            opacity={1}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  )
}
