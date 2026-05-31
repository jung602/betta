import { useRef, useMemo, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF, MeshTransmissionMaterial } from '@react-three/drei'
import { BettaFish, type TailPresetKey } from '../fish'
import Bubbles from '../effects/Bubbles'
import type { FoodPellet, Bounds } from '../types'
import { useGradientTexture, useRemapUVsByY, remapPlanarUVs } from '../hooks'
import TankGame from './TankGame'
import type { useTictactoeGame } from './tiktaktoe'

type Game = ReturnType<typeof useTictactoeGame>

export const TANK_MODELS = {
  square: { path: 'squaretank.glb', label: 'Square', shape: 'box' as const },
  round:  { path: 'roundtank.glb',  label: 'Round', shape: 'cylinder' as const },
  imac:   { path: 'imactank.glb',   label: 'iMac',  shape: 'box' as const },
}

export type TankModelKey = keyof typeof TANK_MODELS

const BOUNDS_MARGIN = 0.1
const MODEL_SCALE = 1

export interface GlassFrontInfo {
  width: number
  height: number
  /** 드로잉 면의 중심 (어항 로컬). game 메시가 중앙이 아닐 때 베타 타겟 보정에 사용 */
  centerX: number
  centerY: number
  frontZ: number
  /** 모델에 'game' 메시가 있어 그 지오메트리를 드로잉 면으로 쓰는지 */
  hasGameMesh: boolean
  /** 베타가 도달 가능한 면 내 반경(보드를 이 안에 생성). 그룹 로컬 XY */
  reachX: number
  reachY: number
}

interface FrostedGlassBoxProps {
  tailPreset: TailPresetKey
  tankModel: TankModelKey
  onFloorY?: (y: number) => void
  normalScale?: number
  gameMode?: boolean
  game?: Game
  mouseTargetRef?: MutableRefObject<THREE.Vector3 | null>
  isHoveredRef?: MutableRefObject<boolean>
  fishPosRef?: MutableRefObject<THREE.Vector3 | null>
  onGlassFront?: (info: GlassFrontInfo) => void
}

export default function FrostedGlassBox({
  tailPreset,
  tankModel,
  onFloorY,
  normalScale,
  gameMode = false,
  game,
  mouseTargetRef,
  isHoveredRef,
  fishPosRef,
  onGlassFront,
}: FrostedGlassBoxProps) {
  const groupRef = useRef<THREE.Group>(null)
  const waterRef = useRef<THREE.Mesh>(null)
  const glassRef = useRef<THREE.Mesh>(null)
  const gradientMap = useGradientTexture('#0075FE', '#fafafa', 512)

  const internalMouseTarget = useRef<THREE.Vector3 | null>(null)
  const internalIsHovered = useRef(false)
  const internalFishPos = useRef<THREE.Vector3 | null>(null)
  const mouseTarget = mouseTargetRef ?? internalMouseTarget
  const isHovered = isHoveredRef ?? internalIsHovered
  const foodPelletsRef = useRef<FoodPellet[]>([])

  const glbPath = `${import.meta.env.BASE_URL}${TANK_MODELS[tankModel].path}`
  const { scene } = useGLTF(glbPath)

  const { waterGeo, glassGeo, gameGeo, otherScene, floorY } = useMemo<{
    waterGeo: THREE.BufferGeometry | null
    glassGeo: THREE.BufferGeometry | null
    gameGeo: THREE.BufferGeometry | null
    otherScene: THREE.Object3D
    floorY: number
  }>(() => {
    let water: THREE.BufferGeometry | null = null
    let glass: THREE.BufferGeometry | null = null
    let gameSurface: THREE.BufferGeometry | null = null
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
        } else if (mesh.name === 'game') {
          gameSurface = mesh.geometry.clone()
          gameSurface.applyMatrix4(mesh.matrixWorld)
          gameSurface.scale(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE)
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
    if (gameSurface) {
      (gameSurface as THREE.BufferGeometry).computeBoundingBox()
      fullBox.union((gameSurface as THREE.BufferGeometry).boundingBox!)
    }

    const center = new THREE.Vector3()
    if (!fullBox.isEmpty()) {
      fullBox.getCenter(center)
      ;(water as THREE.BufferGeometry | null)?.translate(-center.x, -center.y, -center.z)
      if (glass) (glass as THREE.BufferGeometry).translate(-center.x, -center.y, -center.z)
      if (gameSurface) (gameSurface as THREE.BufferGeometry).translate(-center.x, -center.y, -center.z)
      cloned.position.set(-center.x, -center.y, -center.z)
    }

    // game 면: 중심을 원점으로 맞춘 뒤 XY 바운딩박스 기준 UV 0~1 리맵
    if (gameSurface) {
      const g = gameSurface as THREE.BufferGeometry
      g.computeBoundingBox()
      const gb = g.boundingBox!
      g.translate(-(gb.max.x + gb.min.x) / 2, -(gb.max.y + gb.min.y) / 2, 0)
      gameSurface = remapPlanarUVs(g)
    }

    const computedFloorY = fullBox.isEmpty() ? -0.2 : fullBox.min.y - center.y

    return { waterGeo: water, glassGeo: glass, gameGeo: gameSurface, otherScene: cloned, floorY: computedFloorY }
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

  // 우선순위: 'game' 메시 → glass → water. game 메시가 있으면 그 면/UV를 드로잉에 사용
  const glassFront = useMemo<GlassFrontInfo | null>(() => {
    const geo = gameGeo ?? glassGeo ?? waterGeo
    if (!geo) return null
    geo.computeBoundingBox()
    const b = geo.boundingBox!
    // 도달영역: 베타 bounds에서 살짝 안쪽(보드가 무조건 도달 가능하도록). TankGame 측면 마진과 동일.
    const reachMargin = 0.03
    const reachX = (orbBounds.shape === 'cylinder' ? orbBounds.radius : orbBounds.x) - reachMargin
    const reachY = orbBounds.y - reachMargin
    return {
      width: b.max.x - b.min.x,
      height: b.max.y - b.min.y,
      centerX: (b.max.x + b.min.x) / 2,
      centerY: (b.max.y + b.min.y) / 2,
      frontZ: b.max.z,
      hasGameMesh: !!gameGeo,
      reachX: Math.max(reachX, 0.05),
      reachY: Math.max(reachY, 0.05),
    }
  }, [gameGeo, glassGeo, waterGeo, orbBounds])

  useEffect(() => {
    if (glassFront) onGlassFront?.(glassFront)
  }, [glassFront, onGlassFront])

  // 게임 진입 시 마우스 추적 상태 초기화(포인터로 끌려가지 않도록)
  useEffect(() => {
    if (gameMode) isHovered.current = false
  }, [gameMode, isHovered])

  useRemapUVsByY(waterRef, waterGeo)
  useRemapUVsByY(glassRef, glassGeo)

  useFrame((state) => {
    const g = groupRef.current
    if (!g) return
    if (gameMode) {
      // 게임 중에는 정면(rotation 0)으로 고정해 격자가 카메라와 정렬되도록
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0, 0.12)
      g.position.y = THREE.MathUtils.lerp(g.position.y, 0, 0.12)
    } else {
      g.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15 + 0.4
      g.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.0125
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
    // 게임 중에는 마우스 추적을 끄고 게임 로직이 베타를 제어
    if (gameMode) return
    updateMouseTarget(e)
  }

  const handlePointerLeave = () => {
    if (gameMode) return
    isHovered.current = false
  }

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <BettaFish mouseTarget={mouseTarget} isHovered={isHovered} bounds={orbBounds} tailPreset={tailPreset} foodPellets={foodPelletsRef} normalScale={normalScale} positionRef={fishPosRef ?? internalFishPos} />
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
            opacity={0.05}
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

      {gameMode && game && glassFront && (
        <TankGame
          game={game}
          geometry={gameGeo ?? undefined}
          width={glassFront.width}
          height={glassFront.height}
          offsetX={glassFront.hasGameMesh ? glassFront.centerX : 0}
          offsetY={glassFront.hasGameMesh ? glassFront.centerY : 0}
          frontZ={glassFront.frontZ}
          bounds={orbBounds}
          position={glassFront.hasGameMesh ? [0, 0, 0] : [0, 0, glassFront.frontZ + 0.01]}
          mouseTarget={mouseTarget}
          isHovered={isHovered}
          fishPosRef={fishPosRef ?? internalFishPos}
        />
      )}
    </group>
  )
}

Object.values(TANK_MODELS).forEach(m => {
  useGLTF.preload(`${import.meta.env.BASE_URL}${m.path}`)
})
