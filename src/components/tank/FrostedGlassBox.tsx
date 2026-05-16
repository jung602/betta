import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF, MeshTransmissionMaterial } from '@react-three/drei'
import { BettaFish, type TailPresetKey } from '../fish'
import Bubbles from '../effects/Bubbles'
import FishFood from '../effects/FishFood'
import type { FoodPellet, Bounds } from '../types'
import { useGradientTexture, useRemapUVsByY } from '../hooks'

const PIXELS_PER_UNIT = 1000

function VideoBackdrop({ bounds }: { bounds: Bounds }) {
  const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null)
  const [size, setSize] = useState<[number, number] | null>(null)

  useEffect(() => {
    const video = document.createElement('video')
    video.src = `${import.meta.env.BASE_URL}test2.mp4`
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = true
    video.playsInline = true

    const onMeta = () => {
      setSize([video.videoWidth / PIXELS_PER_UNIT, video.videoHeight / PIXELS_PER_UNIT])
      video.play()
    }
    video.addEventListener('loadedmetadata', onMeta)

    const texture = new THREE.VideoTexture(video)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.colorSpace = THREE.SRGBColorSpace
    setVideoTexture(texture)

    return () => {
      video.removeEventListener('loadedmetadata', onMeta)
      video.pause()
      video.src = ''
      texture.dispose()
    }
  }, [])

  if (!videoTexture || !size) return null

  return (
    <mesh position={[0, 0.1, -bounds.z - 0.5]}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={videoTexture} toneMapped={false} />
    </mesh>
  )
}

export const TANK_MODELS = {
  square: { path: 'squaretank.glb', label: '사각 탱크', shape: 'box' as const },
  round:  { path: 'roundtank.glb',  label: '원형 탱크', shape: 'cylinder' as const },
}

export type TankModelKey = keyof typeof TANK_MODELS

const BOUNDS_MARGIN = 0.1
const MODEL_SCALE = 1

interface FrostedGlassBoxProps {
  tailPreset: TailPresetKey
  tankModel: TankModelKey
  onFloorY?: (y: number) => void
}

export default function FrostedGlassBox({ tailPreset, tankModel, onFloorY }: FrostedGlassBoxProps) {
  const groupRef = useRef<THREE.Group>(null)
  const waterRef = useRef<THREE.Mesh>(null)
  const glassRef = useRef<THREE.Mesh>(null)
  const gradientMap = useGradientTexture('#4a90e8', '#fafafa', 512)

  const mouseTarget = useRef<THREE.Vector3 | null>(null)
  const isHovered = useRef(false)
  const foodPelletsRef = useRef<FoodPellet[]>([])
  const nextFoodIdRef = useRef(0)

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

    const refGeo = (water as THREE.BufferGeometry | null) ?? (glass as THREE.BufferGeometry | null)
    let centerOffset = new THREE.Vector3()
    if (refGeo) {
      refGeo.computeBoundingBox()
      const center = new THREE.Vector3()
      refGeo.boundingBox!.getCenter(center)
      centerOffset = center.clone()
      ;(water as THREE.BufferGeometry | null)?.translate(-center.x, -center.y, -center.z)
      if (glass && glass !== refGeo) (glass as THREE.BufferGeometry).translate(-center.x, -center.y, -center.z)
      cloned.position.set(-center.x, -center.y, -center.z)
    }

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
      const waterBox = (water as THREE.BufferGeometry).boundingBox ?? new THREE.Box3()
      fullBox.union(waterBox)
    }
    if (glass) {
      const glassBox = new THREE.Box3()
      ;(glass as THREE.BufferGeometry).computeBoundingBox()
      glassBox.copy((glass as THREE.BufferGeometry).boundingBox!)
      fullBox.union(glassBox)
    }

    const computedFloorY = fullBox.isEmpty() ? -0.2 : fullBox.min.y

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
    const hx = (box.max.x - box.min.x) / 2 - BOUNDS_MARGIN
    const hy = (box.max.y - box.min.y) / 2 - BOUNDS_MARGIN
    const hz = (box.max.z - box.min.z) / 2 - BOUNDS_MARGIN
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

    const count = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      foodPelletsRef.current.push({
        id: nextFoodIdRef.current++,
        position: new THREE.Vector3(
          THREE.MathUtils.clamp(localPoint.x + (Math.random() - 0.5) * 0.02, -bx, bx),
          THREE.MathUtils.clamp(localPoint.y + (Math.random() - 0.5) * 0.01, -by, by),
          THREE.MathUtils.clamp(localPoint.z + (Math.random() - 0.5) * 0.02, -bz, bz),
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          -0.0075 - Math.random() * 0.0075,
          (Math.random() - 0.5) * 0.01,
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

      <VideoBackdrop bounds={orbBounds} />

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
            opacity={0.2}
            roughness={0.1}
            metalness={0.05}
            envMapIntensity={1}
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

Object.values(TANK_MODELS).forEach(m => {
  useGLTF.preload(`${import.meta.env.BASE_URL}${m.path}`)
})
