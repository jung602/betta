import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, ContactShadows, OrbitControls, useVideoTexture } from '@react-three/drei'
import * as THREE from 'three'
import { FrostedGlassBox, type TankModelKey, type GlassFrontInfo } from './tank'
import type { GameSurfaceApi } from './tank/TankGame'
import { useTictactoeGame } from './tank/tiktaktoe'
import { Nav, GridBar, type GridBarPanel } from './ui'
import type { TailPresetKey } from './fish'

const SCENE_SURFACE_BORDER = '1.5px solid rgba(158, 158, 158, 0.35)'
const GLOSSY_BUTTON_SHADOW =
  '1px 1px 0px 0px rgba(255, 255, 255, 1), -1px -1px 0px 0px rgba(0, 0, 0, 0.1)'
const GLOSSY_SURFACE_RADIUS = 20

const CAMERA_FOV = 35
/** 평상시 기본 시점 (작을수록 줌인) */
const INITIAL_CAM_POS = new THREE.Vector3(1.4, 1.04, 2.12)
const ORIGIN = new THREE.Vector3(0, 0, 0)
/** 게임 시 어항 프레이밍. 클수록 카메라가 멀어져 줌인이 덜함 */
const GAME_FRAME_SCALE = 1.32

/** 게임 중 OrbitControls 허용 범위 — 아주 살짝만 */
const GAME_ORBIT_AZIMUTH = 0.05
const GAME_ORBIT_POLAR = 0.04
const GAME_ORBIT_ZOOM = 0.2

type OrbitControlsRef = React.ComponentRef<typeof OrbitControls>

function applyGameOrbitLimits(controls: NonNullable<OrbitControlsRef>, camera: THREE.Camera) {
  const offset = new THREE.Vector3().subVectors(camera.position, controls.target)
  const spherical = new THREE.Spherical().setFromVector3(offset)
  controls.minAzimuthAngle = spherical.theta - GAME_ORBIT_AZIMUTH
  controls.maxAzimuthAngle = spherical.theta + GAME_ORBIT_AZIMUTH
  controls.minPolarAngle = Math.max(0.15, spherical.phi - GAME_ORBIT_POLAR)
  controls.maxPolarAngle = Math.min(Math.PI - 0.15, spherical.phi + GAME_ORBIT_POLAR)
  controls.minDistance = Math.max(0.5, spherical.radius - GAME_ORBIT_ZOOM)
  controls.maxDistance = spherical.radius + GAME_ORBIT_ZOOM
  controls.enablePan = false
  controls.enableRotate = true
  controls.enableZoom = true
  controls.autoRotate = false
}

function resetOrbitLimits(controls: NonNullable<OrbitControlsRef>) {
  controls.minAzimuthAngle = -Infinity
  controls.maxAzimuthAngle = Infinity
  controls.minPolarAngle = Math.PI / 4
  controls.maxPolarAngle = Math.PI
  controls.minDistance = 0
  controls.maxDistance = Infinity
  controls.enablePan = true
  controls.enableRotate = true
  controls.enableZoom = true
}

/** 게임 진입 시 어항 정면으로 줌인, 도착 후 OrbitControls를 아주 좁게만 허용. 종료 시 원위치 복귀 */
function CameraRig({
  active,
  glassFront,
  controlsRef,
  onArrive,
}: {
  active: boolean
  glassFront: GlassFrontInfo | null
  controlsRef: React.RefObject<OrbitControlsRef | null>
  onArrive: () => void
}) {
  const { camera, size } = useThree()
  const gameViewReadyRef = useRef(false)
  const returningRef = useRef(false)
  const prevActiveRef = useRef(false)

  const gamePos = useMemo(() => {
    if (!glassFront) return null
    const half = (CAMERA_FOV * Math.PI) / 360
    const aspect = size.width / Math.max(size.height, 1)
    const dH = glassFront.height / 2 / Math.tan(half)
    const dW = glassFront.width / 2 / (Math.tan(half) * aspect)
    const dist = Math.max(dH, dW) * GAME_FRAME_SCALE + glassFront.frontZ
    return new THREE.Vector3(0, 0, dist)
  }, [glassFront, size.width, size.height])

  useEffect(() => {
    const controls = controlsRef.current
    if (active) {
      gameViewReadyRef.current = false
      returningRef.current = false
      if (controls) {
        controls.autoRotate = false
        controls.enabled = false
      }
    } else if (prevActiveRef.current) {
      gameViewReadyRef.current = false
      returningRef.current = true
      if (controls) {
        controls.enabled = false
        controls.autoRotate = false
        resetOrbitLimits(controls)
      }
    }
    prevActiveRef.current = active
  }, [active, controlsRef])

  useFrame(() => {
    const controls = controlsRef.current

    if (active && gamePos && !gameViewReadyRef.current) {
      camera.position.lerp(gamePos, 0.08)
      if (controls) {
        controls.target.lerp(ORIGIN, 0.08)
        controls.update()
      } else {
        camera.lookAt(ORIGIN)
      }
      if (camera.position.distanceTo(gamePos) < 0.02) {
        gameViewReadyRef.current = true
        if (controls) {
          applyGameOrbitLimits(controls, camera)
          controls.enabled = true
        }
        onArrive()
      }
      return
    }

    if (returningRef.current) {
      camera.position.lerp(INITIAL_CAM_POS, 0.08)
      if (controls) {
        controls.target.lerp(ORIGIN, 0.08)
        controls.update()
      } else {
        camera.lookAt(ORIGIN)
      }
      if (camera.position.distanceTo(INITIAL_CAM_POS) < 0.02) {
        returningRef.current = false
        if (controls) {
          resetOrbitLimits(controls)
          controls.enabled = true
          controls.autoRotate = true
        }
      }
    }
    // idle / 게임 중(도착 후): CameraRig은 카메라를 건드리지 않음
  })

  return null
}

const floorMat = new THREE.ShaderMaterial({
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D uMap;
    uniform float uOpacity;
    uniform float uFeather;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(uMap, vUv);
      float dx = smoothstep(0.0, uFeather, vUv.x) * smoothstep(0.0, uFeather, 1.0 - vUv.x);
      float dy = smoothstep(0.0, uFeather, vUv.y) * smoothstep(0.0, uFeather, 1.0 - vUv.y);
      float fade = dx * dy;
      gl_FragColor = vec4(tex.rgb, tex.a * fade * uOpacity);
    }
  `,
  uniforms: {
    uMap: { value: null },
    uOpacity: { value: 0.3 },
    uFeather: { value: 0.5 },
  },
  transparent: true,
  depthWrite: false,
})

function FloorPlane({ y }: { y: number }) {
  const texture = useVideoTexture(`${import.meta.env.BASE_URL}bg.mp4`, {
    loop: true,
    muted: true,
    start: true,
  })
  texture.colorSpace = THREE.SRGBColorSpace

  const video = texture.image as HTMLVideoElement | undefined
  const aspect = video ? video.videoWidth / video.videoHeight : 1
  const height = 2

  const mat = useMemo(() => {
    const m = floorMat.clone()
    m.uniforms.uMap.value = texture
    return m
  }, [texture])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y - 0.03, 0]} material={mat}>
      <planeGeometry args={[height * aspect, height]} />
    </mesh>
  )
}

export default function Scene() {
  const [tailPreset, setTailPreset] = useState<TailPresetKey>('rosetail')
  const [tankModel, setTankModel] = useState<TankModelKey>('round')
  const [floorY, setFloorY] = useState(-0.2)
  const [normalScale] = useState(20)
  const [gameActive, setGameActive] = useState(false)
  const [openPanel, setOpenPanel] = useState<GridBarPanel>(null)
  const [glassFront, setGlassFront] = useState<GlassFrontInfo | null>(null)

  const controlsRef = useRef<OrbitControlsRef>(null)
  const mouseTargetRef = useRef<THREE.Vector3 | null>(null)
  const isHoveredRef = useRef(false)
  const fishPosRef = useRef<THREE.Vector3 | null>(null)
  const gameSurfaceRef = useRef<GameSurfaceApi | null>(null)

  const game = useTictactoeGame(
    glassFront?.width ?? 0,
    glassFront?.height ?? 0,
    1,
    glassFront?.reachX ?? 0,
    glassFront?.reachY ?? 0,
  )

  const handleFloorY = useCallback((y: number) => setFloorY(y), [])

  const handleGlassFront = useCallback((info: GlassFrontInfo) => setGlassFront(info), [])

  // 유리에 그리는 동안엔 카메라 회전 잠금(드래그가 회전 대신 그리기만 하도록). 빈 공간 드래그·줌은 유지.
  const handleDrawingChange = useCallback((drawing: boolean) => {
    const c = controlsRef.current
    if (c) c.enableRotate = !drawing
  }, [])

  const handleStartGame = useCallback(() => {
    if (!glassFront) return
    setOpenPanel(null)
    setGameActive(true)
  }, [glassFront])

  // 카메라 줌인 완료 시 게임 시작
  const handleArrive = useCallback(() => {
    if (game.phase === 'idle') game.startGame()
  }, [game])

  const handleEndGame = useCallback(() => {
    game.resetToIdle()
    setGameActive(false)
    setOpenPanel(null)
  }, [game])

  const togglePanel = useCallback((panel: 'tank' | 'fish') => {
    setOpenPanel(prev => (prev === panel ? null : panel))
  }, [])

  const handleTankSelect = useCallback((key: TankModelKey) => {
    setTankModel(key)
  }, [])

  const handleTailSelect = useCallback((key: TailPresetKey) => {
    setTailPreset(key)
  }, [])

  return (
    <div className="app-shell">
      <Canvas
        camera={{ position: [1.4, 1.04, 2.12], fov: 35 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: 3,
          toneMappingExposure: 1.4,
        }}
        shadows
        style={{
          // 게임 중엔 GridBar가 자라며 이 캔버스를 자연스럽게 절반으로 밀어냄
          flex: 1,
          minHeight: 0,
          width: '100%',
          border: SCENE_SURFACE_BORDER,
          borderRadius: GLOSSY_SURFACE_RADIUS,
          overflow: 'hidden',
          boxShadow: GLOSSY_BUTTON_SHADOW,
        }}
      >
        <color attach="background" args={['#f0f5ff']} />
        <fog attach="fog" args={['#f0f5ff', 6, 14]} />

        <directionalLight
          position={[5, 8, 5]}
          intensity={1.0}
          castShadow
          shadow-mapSize={[2048, 2048]}
          color="#ffffff"
        />
       
        {/* 어항 아래에서 위로 비추는 조명 */}
        <group position={[0, floorY - 1, 0]}>
          <spotLight
            angle={1}
            penumbra={1}
            intensity={0.3}
            color="#0086E8"
            distance={5}
            decay={3}
            castShadow
          >
          </spotLight>
        </group>

        <FrostedGlassBox
          key={tankModel}
          tailPreset={tailPreset}
          tankModel={tankModel}
          onFloorY={handleFloorY}
          normalScale={normalScale}
          gameMode={gameActive}
          game={game}
          mouseTargetRef={mouseTargetRef}
          isHoveredRef={isHoveredRef}
          fishPosRef={fishPosRef}
          onGlassFront={handleGlassFront}
          onDrawingChange={handleDrawingChange}
          gameSurfaceRef={gameSurfaceRef}
        />
        <FloorPlane y={floorY} />

        <ContactShadows
          position={[0, floorY, 0]}
          opacity={0.3}
          scale={1.25}
          blur={2.5}
          far={0.75}
          color="#6aafe0"
        />




        <Environment preset="city" environmentIntensity={1} />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={!gameActive}
          enableZoom={true}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1}
          autoRotate={!gameActive}
          autoRotateSpeed={0.5}
          dampingFactor={0.05}
          enableDamping
          rotateSpeed={gameActive ? 0.35 : 1}
          zoomSpeed={gameActive ? 0.4 : 1}
        />

        <CameraRig
          active={gameActive}
          glassFront={glassFront}
          controlsRef={controlsRef}
          onArrive={handleArrive}
        />
      </Canvas>

      <GridBar
        openPanel={openPanel}
        gameActive={gameActive}
        gamePhase={game.phase}
        winner={game.winner}
        isDraw={game.isDraw}
        tankModel={tankModel}
        tailPreset={tailPreset}
        onTankSelect={handleTankSelect}
        onTailSelect={handleTailSelect}
        gameSurfaceRef={gameSurfaceRef}
      />

      <Nav
        gameActive={gameActive}
        openPanel={openPanel}
        onTogglePanel={togglePanel}
        canStartGame={!!glassFront}
        onStartGame={handleStartGame}
        onEndGame={handleEndGame}
      />
    </div>
  )
}
