import { useRef, useMemo, useEffect } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF, MeshTransmissionMaterial } from '@react-three/drei'
import BettaFish, { TailPresetKey } from './BettaFish'
import Bubbles from './Bubbles'
import FishFood, { FoodPellet } from './FishFood'

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

function useRemapUVsByY(meshRef: React.RefObject<THREE.Mesh | null>, geo?: THREE.BufferGeometry | null) {
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const geom = mesh.geometry
    const pos = geom.attributes.position
    if (!pos) return

    let uv = geom.attributes.uv as THREE.BufferAttribute | undefined
    if (!uv) {
      uv = new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2)
      geom.setAttribute('uv', uv)
    }

    let minY = Infinity, maxY = -Infinity
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    const range = maxY - minY || 1
    for (let i = 0; i < pos.count; i++) {
      const t = 1 - (pos.getY(i) - minY) / range
      uv.setX(i, 0.5)
      uv.setY(i, t)
    }
    uv.needsUpdate = true
  }, [meshRef, geo])
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

const BOUNDS_MARGIN = 0.4
const MODEL_SCALE = 4

export default function FrostedGlassBox({ tailPreset }: { tailPreset: TailPresetKey }) {
  const groupRef = useRef<THREE.Group>(null)
  const waterRef = useRef<THREE.Mesh>(null)
  const glassRef = useRef<THREE.Mesh>(null)
  const gradientMap = useGradientTexture('#4a90e8', '#fafafa', 512)

  const mouseTarget = useRef<THREE.Vector3 | null>(null)
  const isHovered = useRef(false)
  const foodPelletsRef = useRef<FoodPellet[]>([])
  const nextFoodIdRef = useRef(0)

  const { scene } = useGLTF(`${import.meta.env.BASE_URL}squaretank.glb`)

  const { waterGeo, glassGeo, otherScene } = useMemo<{
    waterGeo: THREE.BufferGeometry | null
    glassGeo: THREE.BufferGeometry | null
    otherScene: THREE.Object3D
  }>(() => {
    let water: THREE.BufferGeometry | null = null
    let glass: THREE.BufferGeometry | null = null
    const cloned = scene.clone(true)
    cloned.updateMatrixWorld(true)
    const toRemove: THREE.Object3D[] = []

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (mesh.name === 'water') {
          water = mesh.geometry.clone()
          water.applyMatrix4(mesh.matrixWorld)
          water.scale(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)
          toRemove.push(mesh)
        } else if (mesh.name === 'glass') {
          glass = mesh.geometry.clone()
          glass.applyMatrix4(mesh.matrixWorld)
          glass.scale(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)
          toRemove.push(mesh)
        }
      }
    })

    toRemove.forEach((obj) => obj.parent?.remove(obj))
    cloned.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)

    const refGeo = (water as THREE.BufferGeometry | null) ?? (glass as THREE.BufferGeometry | null)
    if (refGeo) {
      refGeo.computeBoundingBox()
      const center = new THREE.Vector3()
      refGeo.boundingBox!.getCenter(center)
      ;(water as THREE.BufferGeometry | null)?.translate(-center.x, -center.y, -center.z)
      if (glass && glass !== refGeo) (glass as THREE.BufferGeometry).translate(-center.x, -center.y, -center.z)
      cloned.position.set(-center.x, -center.y, -center.z)
    }

    return { waterGeo: water, glassGeo: glass, otherScene: cloned }
  }, [scene])

  const orbBounds = useMemo(() => {
    const geo = waterGeo ?? glassGeo
    if (!geo) return { x: 0.6, y: 0.6, z: 0.6 }
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    return {
      x: (box.max.x - box.min.x) / 2 - BOUNDS_MARGIN,
      y: (box.max.y - box.min.y) / 2 - BOUNDS_MARGIN,
      z: (box.max.z - box.min.z) / 2 - BOUNDS_MARGIN,
    }
  }, [waterGeo, glassGeo])

  useRemapUVsByY(waterRef, waterGeo)
  useRemapUVsByY(glassRef, glassGeo)

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

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const localPoint = groupRef.current
      ? groupRef.current.worldToLocal(e.point.clone())
      : e.point.clone()

    const { x: bx, y: by, z: bz } = orbBounds
    const shrink = 0.7

    const count = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      foodPelletsRef.current.push({
        id: nextFoodIdRef.current++,
        position: new THREE.Vector3(
          THREE.MathUtils.clamp(localPoint.x * shrink + (Math.random() - 0.5) * 0.1, -bx, bx),
          THREE.MathUtils.clamp(localPoint.y * shrink + (Math.random() - 0.5) * 0.06, -by, by),
          THREE.MathUtils.clamp(localPoint.z * shrink + (Math.random() - 0.5) * 0.1, -bz, bz),
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.04,
          -0.03 - Math.random() * 0.03,
          (Math.random() - 0.5) * 0.04,
        ),
        alive: true,
      })
    }
    while (foodPelletsRef.current.length > 30) {
      foodPelletsRef.current[0].alive = false
      foodPelletsRef.current.shift()
    }
  }

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <BettaFish mouseTarget={mouseTarget} isHovered={isHovered} bounds={orbBounds} tailPreset={tailPreset} foodPellets={foodPelletsRef} />
      <FishFood pelletsRef={foodPelletsRef} bounds={orbBounds} />
      <Bubbles />

      <primitive object={otherScene} />

      {waterGeo && (
        <mesh
          ref={waterRef}
          geometry={waterGeo}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
        >
          <MeshTransmissionMaterial
            map={gradientMap}
            color="#fafafa"
            roughness={0.25}
            transmission={0.9}
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

      {glassGeo && (
        <mesh
          ref={glassRef}
          geometry={glassGeo}
          renderOrder={10}
        >
          <meshPhysicalMaterial
            color="#d4eaff"
            transparent
            opacity={0.18}
            roughness={0.08}
            metalness={0.05}
            envMapIntensity={1.2}
            clearcoat={1}
            clearcoatRoughness={0.03}
            ior={1.52}
            specularIntensity={1.5}
            reflectivity={0.8}
            depthWrite={false}
            side={THREE.FrontSide}
          />
        </mesh>
      )}
    </group>
  )
}

useGLTF.preload(`${import.meta.env.BASE_URL}squaretank.glb`)
