import { useRef, useMemo, useEffect } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBox, MeshTransmissionMaterial } from '@react-three/drei'
import BettaFish, { TailPresetKey } from './BettaFish'
import Bubbles from './Bubbles'

function useGradientTexture(
  topColor: string,
  bottomColor: string,
  size = 512
) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 0, size)
    gradient.addColorStop(0, topColor)
    gradient.addColorStop(1, bottomColor)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 4, size)
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }, [topColor, bottomColor, size])
}

function useRemapUVsByY(meshRef: React.RefObject<THREE.Mesh | null>, trigger?: unknown) {
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const geo = mesh.geometry
    const pos = geo.attributes.position
    const uv = geo.attributes.uv

    let minY = Infinity, maxY = -Infinity
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    const range = maxY - minY || 1
    for (let i = 0; i < pos.count; i++) {
      const t = 1 - (pos.getY(i) - minY) / range
      uv.setY(i, t)
    }
    uv.needsUpdate = true
  }, [meshRef, trigger])
}

function PlayIcon({ position }: { position: [number, number, number] }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.15, -0.2)
    s.lineTo(-0.15, 0.2)
    s.lineTo(0.2, 0)
    s.closePath()
    return s
  }, [])

  return (
    <mesh position={position}>
      <shapeGeometry args={[shape]} />
      <meshPhysicalMaterial
        color="#ffffff"
        roughness={0.6}
        metalness={0}
        transparent
        opacity={0.92}
      />
    </mesh>
  )
}

function BreadSlice({ position }: { position: [number, number, number] }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.15, 0)
    s.lineTo(-0.15, 0.35)
    s.quadraticCurveTo(-0.15, 0.55, 0, 0.6)
    s.quadraticCurveTo(0.15, 0.55, 0.15, 0.35)
    s.lineTo(0.15, 0)
    s.closePath()
    return s
  }, [])

  const extrudeSettings = useMemo(() => ({
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 8,
  }), [])

  return (
    <mesh position={position} rotation={[0, Math.PI / 2, 0]}>
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <MeshTransmissionMaterial
        color="#c4e4ff"
        roughness={0.5}
        transmission={0.6}
        thickness={0.2}
        chromaticAberration={0.01}
        envMapIntensity={0.1}
      />
    </mesh>
  )
}

function SideLever({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.02, 0.2, 0.08]} />
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.5}
          metalness={0}
          transparent
          opacity={0.88}
        />
      </mesh>
    </group>
  )
}

function FrontDial({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.06, 0.06, 0.02, 32]} />
      <meshPhysicalMaterial
        color="#ffffff"
        roughness={0.5}
        metalness={0}
        transparent
        opacity={0.88}
      />
    </mesh>
  )
}

function SlotTop({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.6, 0.02, 0.15]} />
      <meshPhysicalMaterial
        color="#90c8ff"
        roughness={0.5}
        metalness={0}
        transparent
        opacity={0.5}
      />
    </mesh>
  )
}


export type ShapeType = 'box' | 'sphere'

const BOX_SIZE = { w: 2, h: 2, d: 2 }
const BOX_BOUNDS = { x: BOX_SIZE.w / 2 - 0.4, y: BOX_SIZE.h / 2 - 0.4, z: BOX_SIZE.d / 2 - 0.4 }
const SPHERE_RADIUS = 1.1
const SPHERE_BOUNDS = { x: SPHERE_RADIUS - 0.5, y: SPHERE_RADIUS - 0.5, z: SPHERE_RADIUS - 0.5 }

export default function FrostedGlassBox({ tailPreset, shape = 'box' }: { tailPreset: TailPresetKey; shape?: ShapeType }) {
  const groupRef = useRef<THREE.Group>(null)
  const mainBoxRef = useRef<THREE.Mesh>(null)
  const mainSphereRef = useRef<THREE.Mesh>(null)
  const gradientMap = useGradientTexture('#4a90e8', '#fafafa', 512)

  const mouseTarget = useRef<THREE.Vector3 | null>(null)
  const isHovered = useRef(false)

  const orbBounds = shape === 'sphere' ? SPHERE_BOUNDS : BOX_BOUNDS

  useRemapUVsByY(mainBoxRef, shape)
  useRemapUVsByY(mainSphereRef, shape)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15 + 0.4
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05
    }
  })

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const localPoint = groupRef.current
      ? groupRef.current.worldToLocal(e.point.clone())
      : e.point.clone()
    if (!mouseTarget.current) {
      mouseTarget.current = localPoint
    } else {
      mouseTarget.current.copy(localPoint)
    }
    isHovered.current = true
  }

  const handlePointerLeave = () => {
    isHovered.current = false
  }

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <BettaFish mouseTarget={mouseTarget} isHovered={isHovered} bounds={orbBounds} tailPreset={tailPreset} />
      <Bubbles />

      {shape === 'box' ? (
        <RoundedBox
          ref={mainBoxRef}
          args={[BOX_SIZE.w, BOX_SIZE.h, BOX_SIZE.d]}
          radius={0.15}
          smoothness={8}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <MeshTransmissionMaterial
            map={gradientMap}
            color="#fafafa"
            roughness={0.25}
            transmission={0.9}
            thickness={0.8}
            chromaticAberration={0.01}
            anisotropy={0.1}
            distortion={0.02}
            distortionScale={0.05}
            temporalDistortion={0.02}
            backside
            backsideThickness={0.4}
            samples={12}
            resolution={512}
            envMapIntensity={0.15}
            clearcoat={0}
            clearcoatRoughness={1}
            attenuationColor="#c8e0ff"
            attenuationDistance={2.5}
            ior={1.1}
            metalness={0}
          />
        </RoundedBox>
      ) : (
        <mesh
          ref={mainSphereRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <sphereGeometry args={[SPHERE_RADIUS, 64, 64]} />
          <MeshTransmissionMaterial
            map={gradientMap}
            color="#fafafa"
            roughness={0.3}
            transmission={0.88}
            thickness={0.5}
            chromaticAberration={0.01}
            anisotropy={0.1}
            distortion={0.02}
            distortionScale={0.05}
            temporalDistortion={0.02}
            backside
            backsideThickness={0.4}
            samples={12}
            resolution={512}
            envMapIntensity={0.15}
            clearcoat={0}
            clearcoatRoughness={1}
            attenuationColor="#c8e0ff"
            attenuationDistance={2.5}
            ior={1.1}
            metalness={0}
          />
        </mesh>
      )}

      {/*<BreadSlice position={[0.03, 0.5, 0]} />*/}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0.1, -0.75, 0.1]}
        scale={[1, 0.625, 1]}
      >
        <meshBasicMaterial color="#c0daf0" transparent opacity={0.18} />
      </mesh>
    </group>
  )
}
