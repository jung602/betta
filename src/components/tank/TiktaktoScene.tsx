import { useRef, useMemo, useCallback, useLayoutEffect, useEffect, useState } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Environment, useVideoTexture } from '@react-three/drei'
import * as THREE from 'three'
import { BettaFish } from '../fish'
import Bubbles from '../effects/Bubbles'
import type { FoodPellet, Bounds } from '../types'
import FrostedGlassPlane, { type TraceAPI } from './FrostedGlassPlane'
import {
  useTictactoeGame,
  TictactoeOverlay,
  animateGridDraw,
  animateMarkX,
  drawFullBoard,
  strokeToCell,
  isClosedStroke,
  type OStrokeMap,
} from './tiktaktoe'
import { drawOStroke, type UVPoint } from './frostedGlassPaint'

const FOV = 35
const PLANE_Z = 0
const BASE_CAMERA_DISTANCE = 2.2
const FISH_DEPTH = -0.28
const FISH_VISUAL_SCALE = 2.5
const BOUNDS_MARGIN = 0.1
const NORMAL_SCALE = 20
const SCENE_BG = '#eaf2ff'
const BETTA_ARRIVE_DIST = 0.07
const BETTA_MAX_SWIM_MS = 5000
const BETTA_PAUSE_BEFORE_X_MS = 200
const BACKDROP_Z = -0.8

// betta 페이지(FloorPlane)와 동일: 가장자리 페더 + 오퍼시티 0.3 비디오 셰이더
const videoBackdropMat = new THREE.ShaderMaterial({
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

/** bg.mp4를 카메라 정면으로 보는 배경 플레인 (바닥 아님) */
function VideoBackdrop({ width, height, z }: { width: number; height: number; z: number }) {
  const texture = useVideoTexture(`${import.meta.env.BASE_URL}bg.mp4`, {
    loop: true,
    muted: true,
    start: true,
  })
  texture.colorSpace = THREE.SRGBColorSpace

  const mat = useMemo(() => {
    const m = videoBackdropMat.clone()
    m.uniforms.uMap.value = texture
    return m
  }, [texture])

  return (
    <mesh position={[0, 0, z]} material={mat}>
      <planeGeometry args={[width, height]} />
    </mesh>
  )
}

type Game = ReturnType<typeof useTictactoeGame>

function glassSizeFromWindow(fov: number, distance: number, planeZ: number) {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1
  const h = typeof window !== 'undefined' ? window.innerHeight : 1
  const distToPlane = distance - planeZ
  const height = 2 * Math.tan((fov * Math.PI) / 360) * distToPlane
  const width = height * (w / Math.max(h, 1))
  return { width, height }
}

/** 브라우저 비율 변경 시 카메라 aspect·위치를 갱신해 유리가 화면에 가득 차도록 맞춤 */
function FitGlassCamera({ fov, distance, planeZ }: { fov: number; distance: number; planeZ: number }) {
  const { camera, size } = useThree()

  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = fov
    cam.aspect = size.width / Math.max(size.height, 1)
    cam.near = 0.01
    cam.far = 50
    cam.position.set(0, 0, distance)
    cam.lookAt(0, 0, planeZ)
    cam.updateProjectionMatrix()
  }, [camera, size.width, size.height, fov, distance, planeZ])

  return null
}

function TiktaktoContent({ game, width, height }: { game: Game; width: number; height: number }) {
  const mouseTarget = useRef<THREE.Vector3 | null>(null)
  const isHovered = useRef(false)
  const fishPosRef = useRef<THREE.Vector3 | null>(null)
  const foodPelletsRef = useRef<FoodPellet[]>([])

  const traceApiRef = useRef<TraceAPI | null>(null)
  const phaseRef = useRef(game.phase)
  phaseRef.current = game.phase

  const arrivedRef = useRef(false)
  const swimStartRef = useRef(0)
  const liveStrokeRef = useRef<UVPoint[]>([])
  const oStrokesRef = useRef<OStrokeMap>({})

  const orbBounds: Bounds = useMemo(
    () => ({
      x: (width / 2 - BOUNDS_MARGIN) / FISH_VISUAL_SCALE,
      y: (height / 2 - BOUNDS_MARGIN) / FISH_VISUAL_SCALE,
      z: 0.18 / FISH_VISUAL_SCALE,
      shape: 'box',
      radius: (Math.min(width, height) / 2 - BOUNDS_MARGIN) / FISH_VISUAL_SCALE,
    }),
    [width, height],
  )

  // 베타가 특정 칸으로 헤엄치도록 타겟 지정 (게임 중 베타 턴에만 사용)
  const setTargetLocal = useCallback((x: number, y: number) => {
    if (!mouseTarget.current) mouseTarget.current = new THREE.Vector3(x, y, 0)
    else mouseTarget.current.set(x, y, 0)
    isHovered.current = true
  }, [])

  const handleTraceReady = useCallback((api: TraceAPI) => {
    traceApiRef.current = api
  }, [])

  const handleStrokeStart = useCallback(() => {
    liveStrokeRef.current = []
  }, [])

  // 라이브 미리보기도 최종과 동일한 drawOStroke로 매번 새로 그려 처음부터 같은 텍스처 유지
  const handleStrokePoint = useCallback(
    (p: UVPoint) => {
      if (phaseRef.current !== 'userTurn') return
      const api = traceApiRef.current
      const layout = game.gridLayout
      if (!api || !layout) return
      liveStrokeRef.current.push(p)
      drawFullBoard(api, layout, game.board, { oStrokes: oStrokesRef.current })
      if (liveStrokeRef.current.length >= 2) drawOStroke(api.traceCtx, liveStrokeRef.current)
      api.markTraceDirty()
    },
    [game],
  )

  const handleStrokeEnd = useCallback((points: UVPoint[]) => {
    liveStrokeRef.current = []
    const api = traceApiRef.current
    const layout = game.gridLayout
    if (phaseRef.current !== 'userTurn' || !api || !layout) return

    const cell = strokeToCell(points, layout)
    const valid = cell >= 0 && game.board[cell] === '' && isClosedStroke(points)

    if (valid) {
      // 사용자가 그린 획을 그대로 보존
      oStrokesRef.current[cell] = points.slice()
      game.placeO(cell)
    } else {
      // 무효한 그림은 보드 상태로 되돌려 지운다
      drawFullBoard(api, layout, game.board, { oStrokes: oStrokesRef.current })
    }
  }, [game])

  // 격자 그리기 애니메이션
  useEffect(() => {
    if (game.phase !== 'animating' || !game.gridLayout) return
    const api = traceApiRef.current
    if (!api) return
    oStrokesRef.current = {}
    api.resetPaint()
    const cancel = animateGridDraw(api, game.gridLayout, () => game.onGridAnimationComplete())
    return cancel
  }, [game.phase, game.gridLayout, game])

  // 보드 상태가 바뀌면 격자+마크 다시 그림
  useEffect(() => {
    if (!game.gridLayout) return
    const api = traceApiRef.current
    if (!api) return
    if (game.phase === 'userTurn' || game.phase === 'ended') {
      drawFullBoard(api, game.gridLayout, game.board, { oStrokes: oStrokesRef.current })
    }
  }, [game.phase, game.board, game.gridLayout])

  // 베타 이동 목표 설정 (베타 턴이 아니면 자유 유영)
  useEffect(() => {
    if (game.phase === 'bettaMoving' && game.bettaTargetCell !== null && game.gridLayout) {
      const c = game.gridLayout.cellWorldCenters[game.bettaTargetCell]
      setTargetLocal(c.x, c.y)
      arrivedRef.current = false
      swimStartRef.current = performance.now()
    } else {
      isHovered.current = false
    }
  }, [game.phase, game.bettaTargetCell, game.gridLayout, setTargetLocal])

  // 자유 모드(idle)일 때 김 닦기 위해 커서 추적, 게임 중엔 위 로직이 타겟 제어
  useFrame(() => {
    if (game.phase !== 'bettaMoving' || arrivedRef.current) return
    const layout = game.gridLayout
    const cellIdx = game.bettaTargetCell
    const api = traceApiRef.current
    if (cellIdx === null || !layout || !api) return

    const target = layout.cellWorldCenters[cellIdx]
    const fp = fishPosRef.current
    const elapsed = performance.now() - swimStartRef.current
    const dist = fp ? Math.hypot(fp.x - target.x, fp.y - target.y) : Infinity

    if (dist < BETTA_ARRIVE_DIST || elapsed > BETTA_MAX_SWIM_MS) {
      arrivedRef.current = true
      // 1) 타겟을 칸 중앙에 유지(isHovered=true) → 그 자리에 자연스럽게 머무름(꼬리는 계속 흔들림)
      setTargetLocal(target.x, target.y)
      const boardWithX = [...game.board]
      boardWithX[cellIdx] = 'X'
      // 2) 0.2초 뒤 X를 그리기 시작, 3) 다 그린 뒤 completeBettaMove로 베타 이동 재개
      window.setTimeout(() => {
        animateMarkX(api, layout, boardWithX, cellIdx, () => game.completeBettaMove(), oStrokesRef.current)
      }, BETTA_PAUSE_BEFORE_X_MS)
    }
  })

  const paintMode = game.phase === 'idle' ? 'free' : 'game'

  return (
    <>
      <FitGlassCamera fov={FOV} distance={BASE_CAMERA_DISTANCE} planeZ={PLANE_Z} />
      <color attach="background" args={[SCENE_BG]} />
      <fog attach="fog" args={[SCENE_BG, 4, 10]} />

      <directionalLight position={[5, 8, 5]} intensity={1.0} color="#ffffff" />
      <directionalLight position={[-3, 4, -2]} intensity={0.8} color="#a8d4ff" />
      <pointLight position={[0, 2, 3]} intensity={0.8} color="#dceeff" />
      <pointLight position={[-2, 1, 1]} intensity={0.4} color="#b0d4ff" />

      <Environment preset="city" environmentIntensity={1} />

      <VideoBackdrop
        width={(width * (BASE_CAMERA_DISTANCE - BACKDROP_Z)) / (BASE_CAMERA_DISTANCE - PLANE_Z)}
        height={(height * (BASE_CAMERA_DISTANCE - BACKDROP_Z)) / (BASE_CAMERA_DISTANCE - PLANE_Z)}
        z={BACKDROP_Z}
      />

      <group position={[0, 0, FISH_DEPTH]} scale={FISH_VISUAL_SCALE}>
        <BettaFish
          mouseTarget={mouseTarget}
          isHovered={isHovered}
          bounds={orbBounds}
          tailPreset="rosetail"
          foodPellets={foodPelletsRef}
          normalScale={NORMAL_SCALE}
          positionRef={fishPosRef}
        />
        <Bubbles />
      </group>

      <FrostedGlassPlane
        width={width}
        height={height}
        position={[0, 0, PLANE_Z]}
        paintMode={paintMode}
        onTraceReady={handleTraceReady}
        onStrokeStart={handleStrokeStart}
        onStrokePoint={handleStrokePoint}
        onStrokeEnd={handleStrokeEnd}
      />
    </>
  )
}

export default function TiktaktoScene() {
  const [glass, setGlass] = useState(() => glassSizeFromWindow(FOV, BASE_CAMERA_DISTANCE, PLANE_Z))

  useEffect(() => {
    const onResize = () => setGlass(glassSizeFromWindow(FOV, BASE_CAMERA_DISTANCE, PLANE_Z))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const game = useTictactoeGame(glass.width, glass.height, FISH_VISUAL_SCALE)

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: SCENE_BG,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, BASE_CAMERA_DISTANCE], fov: FOV, near: 0.01, far: 50 }}
        resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
        style={{ width: '100%', height: '100%', display: 'block' }}
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.4,
        }}
      >
        <TiktaktoContent game={game} width={glass.width} height={glass.height} />
      </Canvas>

      <TictactoeOverlay
        phase={game.phase}
        statusMessage={game.statusMessage}
        onStart={game.startGame}
        onReset={game.resetToIdle}
      />
    </div>
  )
}
