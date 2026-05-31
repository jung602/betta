import { useRef, useMemo, useEffect } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF, MeshTransmissionMaterial } from '@react-three/drei'
import { BettaFish, type TailPresetKey } from '../fish'
import Bubbles from '../effects/Bubbles'
import type { FoodPellet, Bounds } from '../types'
import { useGradientTexture, useRemapUVsByY } from '../hooks'

export const TANK_MODELS = {
  square: { path: 'squaretank.glb', label: 'Square', shape: 'box' as const },
  round:  { path: 'roundtank.glb',  label: 'Round', shape: 'cylinder' as const },
  imac:   { path: 'imactank.glb',   label: 'iMac',  shape: 'box' as const },
}

export type TankModelKey = keyof typeof TANK_MODELS

const BOUNDS_MARGIN = 0.1
const MODEL_SCALE = 1

interface FrostedGlassBoxProps {
  tailPreset: TailPresetKey
  tankModel: TankModelKey
  onFloorY?: (y: number) => void
  normalScale?: number
}

export default function FrostedGlassBox({ tailPreset, tankModel, onFloorY, normalScale }: FrostedGlassBoxProps) {
  const groupRef = useRef<THREE.Group>(null)
  const waterRef = useRef<THREE.Mesh>(null)
  const glassRef = useRef<THREE.Mesh>(null)
  const gradientMap = useGradientTexture('#0075FE', '#fafafa', 512)

  const mouseTarget = useRef<THREE.Vector3 | null>(null)
  const isHovered = useRef(false)
  const foodPelletsRef = useRef<FoodPellet[]>([])

  const glbPath = `${import.meta.env.BASE_URL}${TANK_MODELS[tankModel].path}`
  const { scene } = useGLTF(glbPath)

  const { waterGeo, glassGeo, otherScene, floorY } = useMemo<{
    waterGeo: THREE.BufferGeometry | null
    glassGeo: THREE.BufferGeometry | null
    otherScene: THREE.Object3D
    floorY: number
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

    const fullBox = new THREE.Box3()
    cloned.updateMatrixWorld(true)
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.geometry.computeBoundingBox()
        const meshBox = mesh.geometry.boundingBox!.clone()
        meshBox.applyMatrix4(mesh.matrixWorld)
        fullBox.union(meshBox)
      }
    })
    if (water) {
      (water as THREE.BufferGeometry).computeBoundingBox()
      fullBox.union((water as THREE.BufferGeometry).boundingBox!)
    }
    if (glass) {
      (glass as THREE.BufferGeometry).computeBoundingBox()
      fullBox.union((glass as THREE.BufferGeometry).boundingBox!)
    }

    const center = new THREE.Vector3()
    if (!fullBox.isEmpty()) {
      fullBox.getCenter(center)
      ;(water as THREE.BufferGeometry | null)?.translate(-center.x, -center.y, -center.z)
      if (glass) (glass as THREE.BufferGeometry).translate(-center.x, -center.y, -center.z)
      cloned.position.set(-center.x, -center.y, -center.z)
    }

    const computedFloorY = fullBox.isEmpty() ? -0.2 : fullBox.min.y - center.y

    return { waterGeo: water, glassGeo: glass, otherScene: cloned, floorY: computedFloorY }
  }, [scene])

  useEffect(() => {
    onFloorY?.(floorY)
  }, [floorY, onFloorY])

  const tankShape = TANK_MODELS[tankModel].shape

  const orbBounds: Bounds = useMemo(() => {
    const geo = waterGeo ?? glassGeo
    if (!geo) return { x: 0.6, y: 0.6, z: 0.6, shape: tankShape, radius: 0.6 }
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    const hx = Math.min(Math.abs(box.min.x), Math.abs(box.max.x)) - BOUNDS_MARGIN
    const hy = Math.min(Math.abs(box.min.y), Math.abs(box.max.y)) - BOUNDS_MARGIN
    const hz = Math.min(Math.abs(box.min.z), Math.abs(box.max.z)) - BOUNDS_MARGIN
    const radius = tankShape === 'cylinder' ? Math.min(hx, hz) : Math.min(hx, hz)
    return { x: hx, y: hy, z: hz, shape: tankShape, radius }
  }, [waterGeo, glassGeo, tankShape])

  useRemapUVsByY(waterRef, waterGeo)
  useRemapUVsByY(glassRef, glassGeo)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15 + 0.4
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.0125
    }
  })

  const updateMouseTarget = (e: ThreeEvent<PointerEvent>) => {
    const localPoint = groupRef.current
      ? groupRef.current.worldToLocal(e.point.clone())
      : e.point.clone()
    const shrink = 0.7
    localPoint.x *= shrink
    localPoint.y *= shrink
    localPoint.z *= shrink
    if (!mouseTarget.current) {
      mouseTarget.current = localPoint
    } else {
      mouseTarget.current.copy(localPoint)
    }
    isHovered.current = true
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    updateMouseTarget(e)
  }

  const handlePointerLeave = () => {
    isHovered.current = false
  }

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <BettaFish mouseTarget={mouseTarget} isHovered={isHovered} bounds={orbBounds} tailPreset={tailPreset} foodPellets={foodPelletsRef} normalScale={normalScale} />
      <Bubbles />

      <primitive object={otherScene} />

      {waterGeo && (
        <mesh
          ref={waterRef}
          geometry={waterGeo}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <MeshTransmissionMaterial
            map={gradientMap}
            color="#fafafa"
            roughness={0.2}
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
      )}
    </group>
  )
}

Object.values(TANK_MODELS).forEach(m => {
  useGLTF.preload(`${import.meta.env.BASE_URL}${m.path}`)
})
