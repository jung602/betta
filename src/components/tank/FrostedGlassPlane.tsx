import { useMemo, useEffect, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { MeshTransmissionMaterial } from '@react-three/drei'
import { useGradientTexture } from '../hooks'
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
  const gradientMap = useGradientTexture('#0075FE', '#fafafa', 512)
  const planeGeo = useMemo(() => new THREE.PlaneGeometry(width, height), [width, height])

  useEffect(() => {
    return () => {
      planeGeo.dispose()
    }
  }, [planeGeo])

  const {
    paintTexture,
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
        <MeshTransmissionMaterial
          map={gradientMap}
          roughnessMap={paintTexture}
          color="#fafafa"
          roughness={0.3}
          transmission={1}
          thickness={0.1}
          chromaticAberration={0.01}
          anisotropy={0.1}
          distortion={0.02}
          distortionScale={0.05}
          temporalDistortion={0.02}
          backside
          backsideThickness={0.1}
          samples={12}
          resolution={512}
          envMapIntensity={0.15}
          clearcoat={0}
          clearcoatRoughness={1}
          attenuationColor="#c8e0ff"
          attenuationDistance={0.625}
          ior={1.1}
          metalness={0}
        />
      </mesh>

      {showTrace && (
        <mesh geometry={planeGeo} renderOrder={9}>
          <meshBasicMaterial
            map={traceTexture}
            transparent
            opacity={0.72}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      <mesh geometry={planeGeo} renderOrder={10}>
        <meshPhysicalMaterial
          color="#d4eaff"
          transparent
          opacity={0}
          roughness={0.1}
          metalness={0.05}
          envMapIntensity={1}
          clearcoat={1}
          clearcoatRoughness={0.03}
          ior={1.2}
          specularIntensity={1.5}
          reflectivity={0.8}
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  )
}
