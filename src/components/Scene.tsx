import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, ContactShadows, OrbitControls, useGLTF, useVideoTexture } from '@react-three/drei'
import * as THREE from 'three'
import { FrostedGlassBox, type TankModelKey, type GlassFrontInfo } from './tank'
import { useTictactoeGame } from './tank/tiktaktoe'
import { TailPresetSelector, TankSelector } from './ui'
import type { TailPresetKey } from './fish'

type AccordionTab = 'tail' | 'tank' | null

const CAMERA_FOV = 35
const INITIAL_CAM_POS = new THREE.Vector3(2, 1.5, 3)
const ORIGIN = new THREE.Vector3(0, 0, 0)

type OrbitControlsRef = React.ComponentRef<typeof OrbitControls>

/** 게임 진입 시 어항 정면으로 줌인·잠금, 종료 시 원위치 복귀시키는 카메라 리그 */
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
  const arrivedRef = useRef(false)

  const desired = useMemo(() => {
    if (!active || !glassFront) return INITIAL_CAM_POS.clone()
    const half = (CAMERA_FOV * Math.PI) / 360
    const aspect = size.width / Math.max(size.height, 1)
    const dH = glassFront.height / 2 / Math.tan(half)
    const dW = glassFront.width / 2 / (Math.tan(half) * aspect)
    const dist = Math.max(dH, dW) * 1.15 + glassFront.frontZ
    return new THREE.Vector3(0, 0, dist)
  }, [active, glassFront, size.width, size.height])

  useEffect(() => {
    arrivedRef.current = false
    const controls = controlsRef.current
    if (controls && active) {
      controls.autoRotate = false
      controls.enabled = false
    }
  }, [active, controlsRef])

  useFrame(() => {
    const controls = controlsRef.current
    camera.position.lerp(desired, 0.08)
    if (controls) {
      controls.target.lerp(ORIGIN, 0.08)
      controls.update()
    } else {
      camera.lookAt(ORIGIN)
    }
    const d = camera.position.distanceTo(desired)
    if (active && !arrivedRef.current && d < 0.02) {
      arrivedRef.current = true
      onArrive()
    }
    if (!active && controls && d < 0.02 && !controls.enabled) {
      controls.enabled = true
      controls.autoRotate = true
    }
  })

  return null
}

const DEPO_PATH = `${import.meta.env.BASE_URL}milkydepofish.glb`

function DepoFish({ floorY, scale = 0.55, rotation = [0, Math.PI / 3.5, 0] }: { floorY: number; scale?: number; rotation?: [number, number, number] }) {
  const { scene } = useGLTF(DEPO_PATH)
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(c)
    const offsetY = -box.min.y
    c.position.y = offsetY
    return c
  }, [scene])

  return (
    <group position={[-0.5, -0.5, -0]} scale={scale} rotation={rotation}>
      <primitive object={cloned} />
    </group>
  )
}

useGLTF.preload(DEPO_PATH)

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
  const height = 7

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
  const [openTab, setOpenTab] = useState<AccordionTab>(null)
  const [showMilky] = useState(false)

  const [gameActive, setGameActive] = useState(false)
  const [glassFront, setGlassFront] = useState<GlassFrontInfo | null>(null)

  const controlsRef = useRef<OrbitControlsRef>(null)
  const mouseTargetRef = useRef<THREE.Vector3 | null>(null)
  const isHoveredRef = useRef(false)
  const fishPosRef = useRef<THREE.Vector3 | null>(null)

  const game = useTictactoeGame(
    glassFront?.width ?? 0,
    glassFront?.height ?? 0,
    1,
    glassFront?.reachX ?? 0,
    glassFront?.reachY ?? 0,
  )

  const handleFloorY = useCallback((y: number) => setFloorY(y), [])

  const handleGlassFront = useCallback((info: GlassFrontInfo) => setGlassFront(info), [])

  const handleStartGame = useCallback(() => {
    if (!glassFront) return
    setGameActive(true)
  }, [glassFront])

  // 카메라 줌인 완료 시 게임 시작
  const handleArrive = useCallback(() => {
    if (game.phase === 'idle') game.startGame()
  }, [game])

  const handleRestart = useCallback(() => {
    game.startGame()
  }, [game])

  const handleEndGame = useCallback(() => {
    game.resetToIdle()
    setGameActive(false)
  }, [game])

  const toggleTab = useCallback((tab: AccordionTab) => {
    setOpenTab(prev => prev === tab ? null : tab)
  }, [])

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(180deg, #eaf2ff 0%, #f0f6ff 50%, #ffffff 100%)',
      position: 'relative',
    }}>
      <Canvas
        camera={{ position: [2, 1.5, 3], fov: 35 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: 3,
          toneMappingExposure: 1.4,
        }}
        shadows
        style={{ position: 'relative', zIndex: 1 }}
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
        <directionalLight
          position={[-3, 4, -2]}
          intensity={1}
          color="#a8d4ff"
        />
        <pointLight position={[0, 2, 3]} intensity={0.8} color="#dceeff" />
        <pointLight position={[-2, 1, 1]} intensity={0.4} color="#b0d4ff" />

        <group position={showMilky ? [0.5, 0, 0] : [0, 0, 0]}>
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
          />
        </group>
        {showMilky && <DepoFish floorY={floorY} />}
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
          enablePan={true}
          enableZoom={true}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1}
          autoRotate={true}
          autoRotateSpeed={0.5}
          dampingFactor={0.05}
          enableDamping
        />

        <CameraRig
          active={gameActive}
          glassFront={glassFront}
          controlsRef={controlsRef}
          onArrive={handleArrive}
        />
      </Canvas>

      {/* Milky 버튼 임시 숨김
      <div style={{
        position: 'absolute',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2,
      }}>
        <button
          onClick={() => setShowMilky(prev => !prev)}
          style={{
            padding: '8px 20px',
            fontSize: 13,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif',
            fontWeight: 500,
            background: showMilky ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)',
            color: '#333',
            border: showMilky ? '1.5px solid rgba(100,160,255,0.6)' : '1.5px solid rgba(0,0,0,0.1)',
            borderRadius: 20,
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            transition: 'all 0.25s ease',
            boxShadow: showMilky ? '0 2px 12px rgba(100,160,255,0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          {showMilky ? 'Milky ON' : 'Milky OFF'}
        </button>
      </div>
      */}

      {!gameActive && (
      <div style={{
        position: 'absolute',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 8,
        zIndex: 2,
      }}>
        {([
          { key: 'tail' as const, icon: `${import.meta.env.BASE_URL}fish.png`, label: 'FISH' },
          { key: 'tank' as const, icon: `${import.meta.env.BASE_URL}tank.png`, label: 'TANK' },
        ]).map(({ key, icon, label }) => (
          <div key={key} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ position: 'absolute', left: 40, top: 40 }}>
              {key === 'tail' && (
                <TailPresetSelector selected={tailPreset} onSelect={setTailPreset} visible={openTab === 'tail'} />
              )}
              {key === 'tank' && (
                <TankSelector selected={tankModel} onSelect={setTankModel} visible={openTab === 'tank'} />
              )}
            </div>

            <button
              onClick={() => toggleTab(key)}
              style={{
                position: 'relative',
                width: 80,
                height: 80,
                padding: 0,
                background: 'transparent',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                transition: 'all 0.2s ease',
                overflow: 'hidden',
                zIndex: 1,
              }}
            >
              <img
                src={`${import.meta.env.BASE_URL}button.png`}
                alt=""
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  opacity: openTab === key ? 0.9 : 0.7,
                  transition: 'opacity 0.2s ease',
                }}
              />
              <img
                src={icon}
                alt=""
                style={{
                  position: 'relative',
                  zIndex: 1,
                  top: 2,
                  width: 42,
                  height: 42,
                  objectFit: 'contain',
                  pointerEvents: 'none',
                  filter: openTab === key ? 'none' : 'grayscale(0.3) opacity(1)',
                  transition: 'filter 0.2s ease',
                }}
              />
            </button>
            <span style={{
              fontSize: 10,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif',
              fontWeight: openTab === key ? 600 : 400,
              color: openTab === key ? '#333' : '#888',
              letterSpacing: '0.5px',
              transition: 'all 0.2s ease',
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>
      )}

      {!gameActive && (
        <div style={{
          position: 'absolute',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2,
        }}>
          <button
            type="button"
            onClick={handleStartGame}
            disabled={!glassFront}
            style={{
              padding: '10px 24px',
              fontSize: 14,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.75)',
              color: '#223',
              border: '1.5px solid rgba(100,160,255,0.45)',
              borderRadius: 24,
              cursor: glassFront ? 'pointer' : 'not-allowed',
              opacity: glassFront ? 1 : 0.5,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 4px 16px rgba(100,160,255,0.2)',
            }}
          >
            베타랑 게임하기
          </button>
        </div>
      )}

      {gameActive && (
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 40,
          gap: 12,
        }}>
          <p style={{
            margin: 0,
            padding: '10px 20px',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: '#334',
            boxShadow: '0 2px 12px rgba(100,160,255,0.15)',
          }}>
            {game.statusMessage}
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            {game.phase === 'ended' && (
              <button
                type="button"
                onClick={handleRestart}
                style={{
                  pointerEvents: 'auto',
                  padding: '10px 22px',
                  fontSize: 14,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif',
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.75)',
                  color: '#223',
                  border: '1.5px solid rgba(100,160,255,0.45)',
                  borderRadius: 24,
                  cursor: 'pointer',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: '0 4px 16px rgba(100,160,255,0.2)',
                }}
              >
                다시하기
              </button>
            )}
            <button
              type="button"
              onClick={handleEndGame}
              style={{
                pointerEvents: 'auto',
                padding: '10px 22px',
                fontSize: 14,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif',
                fontWeight: 600,
                background: 'rgba(255,255,255,0.6)',
                color: '#445',
                border: '1.5px solid rgba(0,0,0,0.1)',
                borderRadius: 24,
                cursor: 'pointer',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              }}
            >
              끝내기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
