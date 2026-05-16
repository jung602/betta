import { useRef, useMemo } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF, MeshTransmissionMaterial } from '@react-three/drei'
import { BettaFish, type TailPresetKey } from '../fish'
import Bubbles from '../effects/Bubbles'
import FishFood from '../effects/FishFood'
import type { FoodPellet, Bounds } from '../types'
import { useGradientTexture, useRemapUVsByY } from '../hooks'

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

  const orbBounds: Bounds = useMemo(() => {
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
