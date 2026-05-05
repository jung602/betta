import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const MAX_BUBBLES = 40
const SPAWN_INTERVAL = 0.4
const SPAWN_SPREAD_X = 0.15
const SPAWN_SPREAD_Z = 0.15
const SPAWN_Y = -0.85
const CEIL_Y = 0.75

const BUOYANCY_MIN = 0.25
const BUOYANCY_MAX = 0.55
const WOBBLE_AMP = 0.12
const WOBBLE_SPEED = 2.8
const SIZE_MIN = 0.018
const SIZE_MAX = 0.055

interface BubbleData {
  mesh: THREE.Mesh
  vy: number
  wobblePhase: number
  wobbleAmpX: number
  wobbleAmpZ: number
  baseSize: number
  life: number
  decay: number
}

const bubbleMat = new THREE.ShaderMaterial({
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform float uTime;
    void main() {
      float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), 3.0);
      float iri = sin(fresnel * 6.28 + uTime * 0.8) * 0.5 + 0.5;
      vec3 iriColor = mix(vec3(0.65, 0.85, 1.0), vec3(0.85, 0.7, 1.0), iri * 0.3);
      vec3 baseColor = mix(vec3(0.75, 0.9, 1.0), vec3(1.0), fresnel * 0.7);
      vec3 color = mix(baseColor, iriColor, 0.25);
      float highlight = smoothstep(0.4, 0.9, dot(vNormal, normalize(vec3(-0.5, 0.7, 0.5))));
      color += highlight * 0.5;
      float alpha = mix(0.04, 0.35, fresnel) + highlight * 0.2;
      gl_FragColor = vec4(color, alpha);
    }
  `,
  uniforms: { uTime: { value: 0 } },
  transparent: true,
  depthWrite: false,
})

const bubbleGeo = new THREE.SphereGeometry(1, 16, 12)

function createBubble(): BubbleData {
  const mesh = new THREE.Mesh(bubbleGeo, bubbleMat)
  const size = SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN)
  mesh.position.set(
    (Math.random() - 0.5) * SPAWN_SPREAD_X,
    SPAWN_Y,
    (Math.random() - 0.5) * SPAWN_SPREAD_Z,
  )
  mesh.scale.setScalar(size)
  return {
    mesh,
    vy: BUOYANCY_MIN + Math.random() * (BUOYANCY_MAX - BUOYANCY_MIN),
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmpX: (0.6 + Math.random() * 0.8) * WOBBLE_AMP,
    wobbleAmpZ: (0.6 + Math.random() * 0.8) * WOBBLE_AMP,
    baseSize: size,
    life: 1.0,
    decay: 0.06 + Math.random() * 0.08,
  }
}

export default function Bubbles() {
  const groupRef = useRef<THREE.Group>(null)
  const poolRef = useRef<BubbleData[]>([])
  const spawnAccum = useRef(0)
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return

    const dt = Math.min(delta, 0.05)
    timeRef.current += dt
    const t = timeRef.current
    const pool = poolRef.current

    bubbleMat.uniforms.uTime.value = t

    spawnAccum.current += dt
    while (spawnAccum.current >= SPAWN_INTERVAL && pool.length < MAX_BUBBLES) {
      const b = createBubble()
      pool.push(b)
      group.add(b.mesh)
      spawnAccum.current -= SPAWN_INTERVAL

      if (Math.random() < 0.3 && pool.length < MAX_BUBBLES) {
        const extra = createBubble()
        extra.mesh.position.x += (Math.random() - 0.5) * 0.05
        extra.baseSize *= 0.6 + Math.random() * 0.3
        pool.push(extra)
        group.add(extra.mesh)
      }
    }

    for (let i = pool.length - 1; i >= 0; i--) {
      const b = pool[i]
      b.mesh.position.y += b.vy * dt
      b.mesh.position.x += Math.sin(t * WOBBLE_SPEED + b.wobblePhase) * b.wobbleAmpX * dt
      b.mesh.position.z += Math.cos(t * WOBBLE_SPEED * 0.7 + b.wobblePhase + 1.3) * b.wobbleAmpZ * dt
      b.vy += 0.03 * dt
      b.baseSize *= 1.0 + 0.08 * dt

      if (b.mesh.position.y > CEIL_Y) {
        b.life -= b.decay * 4
      }

      const breathe = 1.0 + Math.sin(t * 3.5 + b.wobblePhase) * 0.06
      const s = b.baseSize * breathe * Math.max(b.life, 0)
      b.mesh.scale.setScalar(s)

      if (b.life <= 0 || b.mesh.position.y > CEIL_Y + 0.2) {
        group.remove(b.mesh)
        pool.splice(i, 1)
      }
    }
  })

  return <group ref={groupRef} />
}
