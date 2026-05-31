import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import type { FoodPellet, Bounds } from '../types'
import { TAIL_PRESETS, type TailPresetKey } from './tailPresets'
import { generateTail } from './tailGeometry'
import { memMat } from './materials'
import { buildFinState, animateFinWave, type FinState } from './finBuilder'
import {
  FISH_SCALE, BODY_SCALE, TAIL_SCALE,
  PECTORAL_SCALE, DORSAL_SCALE, ANAL_SCALE,
  MAX_SPEED, MIN_SPEED, WALL_MARGIN, WALL_STRENGTH,
  ARRIVE_MAX_SPEED, ARRIVE_MAX_FORCE, ARRIVE_RADIUS,
  MAX_HEADING_DELTA, MAX_ANG_VEL,
  WAVE_AMP, WAVE_SPEED, WAVE_K, BODY_WAVE_AMP,
  BODY_RADIUS_X, BODY_RADIUS_Y, BODY_RADIUS_Z,
  BODY_CENTER_X, BODY_CENTER_Y,
  PECTORAL_FIN, PECTORAL_X, PECTORAL_Y, PECTORAL_Z,
  DORSAL_FIN, DORSAL_X, DORSAL_Y,
  ANAL_FIN, ANAL_X, ANAL_Y,
  TAIL_X, TAIL_Y,
  _acc, _desired, _steer, _wall, _tmp,
  _lookMat, _up, _origin, _targetQuat,
  _lerpColor,
} from './constants'

const FISH_BODY_PATH = `${import.meta.env.BASE_URL}3d/fishbody.glb`

interface BettaFishProps {
  mouseTarget: React.RefObject<THREE.Vector3 | null>
  isHovered: React.RefObject<boolean>
  bounds: Bounds
  tailPreset: TailPresetKey
  foodPellets: { current: FoodPellet[] }
  normalScale?: number
  positionRef?: React.MutableRefObject<THREE.Vector3 | null>
}

/** Attaches a fin's membrane mesh and ray lines to a group, disposing on unmount. */
function useAttachFin(ref: React.RefObject<THREE.Group | null>, fin: FinState) {
  useEffect(() => {
    const group = ref.current
    if (!group) return
    group.add(fin.memMesh)
    fin.rayLines.forEach(l => group.add(l))
    return () => {
      group.remove(fin.memMesh)
      fin.rayLines.forEach(l => group.remove(l))
      fin.memGeo.dispose()
      fin.rayBufs.forEach(b => b.geo.dispose())
    }
  }, [ref, fin])
}

export default function BettaFish({ mouseTarget, isHovered, bounds, tailPreset, foodPellets, normalScale = 1, positionRef }: BettaFishProps) {
  const fishOriginRef = useRef<THREE.Group>(null)
  const tailGroupRef = useRef<THREE.Group>(null)
  const eyeGroupRef = useRef<THREE.Group>(null)
  const pectoralLeftRef = useRef<THREE.Group>(null)
  const pectoralRightRef = useRef<THREE.Group>(null)
  const pectoralWrapRef = useRef<THREE.Group>(null)
  const dorsalRef = useRef<THREE.Group>(null)
  const analRef = useRef<THREE.Group>(null)

  const glowRef = useRef(0)

  const pos = useRef(new THREE.Vector3(0, 0, 0))
  const vel = useRef(new THREE.Vector3(0.2, 0, 0.15).setLength(MIN_SPEED))
  const prevHeading = useRef(Math.atan2(0.2, 0.15))
  const smoothAngVel = useRef(0)
  const wavePhase = useRef(0)

  const { scene: fishBodyScene } = useGLTF(FISH_BODY_PATH)

  const bodyState = useMemo(() => {
    let srcGeo: THREE.BufferGeometry | null = null
    let normalMap: THREE.Texture | null = null
    let normalScale = 2
    let origMat: THREE.Material | null = null
    fishBodyScene.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh && !srcGeo) {
        srcGeo = mesh.geometry.clone()
        const mat = mesh.material as THREE.MeshStandardMaterial
        // glb 원본 머티리얼 그대로 사용
        origMat = Array.isArray(mesh.material)
          ? mesh.material[0].clone()
          : (mesh.material as THREE.Material).clone()
        if (mat?.normalMap) {
          normalMap = mat.normalMap
          if (mat.normalScale) normalScale = mat.normalScale.x
        }
      }
    })
    if (!srcGeo) throw new Error('No mesh found in fishbody.glb')
    const geo = srcGeo as THREE.BufferGeometry

    const posAttr = geo.attributes.position as THREE.BufferAttribute
    geo.computeBoundingBox()
    const box = geo.boundingBox!

    const original = new Float32Array(posAttr.count * 3)
    const colors = new Float32Array(posAttr.count * 3)

    const headColor = new THREE.Color('#6B1510')
    const midColor = new THREE.Color('#c04030')
    const tailColor = new THREE.Color('#e86850')
    const bellyTint = new THREE.Color('#d4a090')
    const tmpColor = new THREE.Color()

    const minX = BODY_CENTER_X - BODY_RADIUS_X
    const rangeX = BODY_RADIUS_X * 2
    const minY = BODY_CENTER_Y - BODY_RADIUS_Y
    const rangeY = BODY_RADIUS_Y * 2

    const srcRangeZ = box.max.z - box.min.z
    const srcRangeY = box.max.y - box.min.y
    const srcRangeX = box.max.x - box.min.x

    for (let i = 0; i < posAttr.count; i++) {
      const srcX = posAttr.getX(i)
      const srcY = posAttr.getY(i)
      const srcZ = posAttr.getZ(i)

      const tz = (srcZ - box.min.z) / srcRangeZ
      const ty = (srcY - box.min.y) / srcRangeY
      const tx = (srcX - box.min.x) / srcRangeX

      const x = minX + tz * rangeX
      const y = minY + ty * rangeY
      const z = -BODY_RADIUS_Z + tx * BODY_RADIUS_Z * 2

      posAttr.setXYZ(i, x, y, z)
      original[i * 3] = x
      original[i * 3 + 1] = y
      original[i * 3 + 2] = z

      if (tz < 0.5) {
        tmpColor.copy(headColor).lerp(midColor, tz * 2)
      } else {
        tmpColor.copy(midColor).lerp(tailColor, (tz - 0.5) * 2)
      }

      const bellyFactor = Math.pow(1 - ty, 2) * 0.25
      tmpColor.lerp(bellyTint, bellyFactor)

      colors[i * 3] = tmpColor.r
      colors[i * 3 + 1] = tmpColor.g
      colors[i * 3 + 2] = tmpColor.b
    }

    posAttr.needsUpdate = true

    const idx = geo.index
    if (idx) {
      const arr = idx.array as Uint16Array | Uint32Array
      for (let i = 0; i < arr.length; i += 3) {
        const tmp = arr[i + 1]
        arr[i + 1] = arr[i + 2]
        arr[i + 2] = tmp
      }
      idx.needsUpdate = true
    }

    const originalColors = new Float32Array(colors)
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    if (geo.attributes.uv && geo.index) {
      geo.computeTangents()
    }
    return { geo, original, originalColors, normalMap, normalScale, material: origMat }
  }, [fishBodyScene])

  const pectoralState = useMemo(() => {
    const result = generateTail(PECTORAL_FIN)
    return {
      left: buildFinState(result, PECTORAL_FIN.length),
      right: buildFinState(result, PECTORAL_FIN.length),
    }
  }, [])

  const dorsalState = useMemo(() => buildFinState(generateTail(DORSAL_FIN), DORSAL_FIN.length), [])

  const analState = useMemo(() => buildFinState(generateTail(ANAL_FIN), ANAL_FIN.length), [])

  const preset = TAIL_PRESETS[tailPreset]

  const tailState = useMemo(() => buildFinState(generateTail(preset), preset.length), [preset])

  useAttachFin(tailGroupRef, tailState)
  useAttachFin(pectoralLeftRef, pectoralState.left)
  useAttachFin(pectoralRightRef, pectoralState.right)
  useAttachFin(dorsalRef, dorsalState)
  useAttachFin(analRef, analState)

  useEffect(() => {
    return () => { bodyState.geo.dispose() }
  }, [bodyState])

  useFrame((state, delta) => {
    if (!fishOriginRef.current) return
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime

    _acc.set(0, 0, 0)

    let seekingFood = false
    const pellets = foodPellets.current
    if (pellets.length > 0) {
      let nearestDist = Infinity
      let nearestPellet: FoodPellet | null = null
      for (const p of pellets) {
        if (!p.alive) continue
        const d = _tmp.copy(p.position).sub(pos.current).length()
        if (d < nearestDist) {
          nearestDist = d
          nearestPellet = p
        }
      }
      if (nearestPellet) {
        seekingFood = true
        if (nearestDist < 0.0625) {
          nearestPellet.alive = false
          glowRef.current = 1.0
        } else {
          _desired.copy(nearestPellet.position).sub(pos.current)
          const dist = _desired.length()
          const speed = dist < ARRIVE_RADIUS
            ? (dist / ARRIVE_RADIUS) * ARRIVE_MAX_SPEED * 1.2
            : ARRIVE_MAX_SPEED * 1.2
          _desired.normalize().multiplyScalar(speed)
          _steer.copy(_desired).sub(vel.current)
          if (_steer.length() > ARRIVE_MAX_FORCE * 1.5) _steer.setLength(ARRIVE_MAX_FORCE * 1.5)
          _acc.add(_steer)
        }
      }
    }

    if (!seekingFood && isHovered.current && mouseTarget.current) {
      _desired.copy(mouseTarget.current).sub(pos.current)
      const dist = _desired.length()
      if (dist < 0.02) {
        vel.current.multiplyScalar(0.8)
        // 제자리에서도 자연스럽게 미세하게 떠다니도록(꼬리·지느러미 흔들림 유지)
        _acc.x += Math.sin(t * 1.7) * 0.0006
        _acc.y += Math.sin(t * 1.1 + 1.5) * 0.0006
        _acc.z += Math.sin(t * 1.3 + 0.7) * 0.0006
      } else {
        const speed = dist < ARRIVE_RADIUS
          ? (dist / ARRIVE_RADIUS) * ARRIVE_MAX_SPEED
          : ARRIVE_MAX_SPEED
        _desired.normalize().multiplyScalar(speed)
        _steer.copy(_desired).sub(vel.current)
        if (_steer.length() > ARRIVE_MAX_FORCE) _steer.setLength(ARRIVE_MAX_FORCE)
        _acc.add(_steer)
        if (dist < ARRIVE_RADIUS) {
          vel.current.multiplyScalar(0.95)
        }
      }
    } else if (!seekingFood) {
      _acc.x += Math.sin(t * 0.42) * 0.001 + Math.sin(t * 1.13 + 1.5) * 0.00075
      _acc.y += Math.sin(t * 0.35 + 2) * 0.0005
      _acc.z += Math.sin(t * 0.55 + 1.2) * 0.001 + Math.sin(t * 0.95 + 2.5) * 0.00075
    }

    _wall.set(0, 0, 0)
    const px = pos.current.x, py = pos.current.y, pz = pos.current.z

    if (bounds.shape === 'cylinder') {
      const distXZ = Math.sqrt(px * px + pz * pz)
      const dRadial = bounds.radius - distXZ
      if (dRadial < WALL_MARGIN && distXZ > 0.001) {
        const f = 1 - dRadial / WALL_MARGIN
        const pushStrength = WALL_STRENGTH * f * f
        _wall.x -= (px / distXZ) * pushStrength
        _wall.z -= (pz / distXZ) * pushStrength
      }
      const dUp = bounds.y - py
      const dDown = bounds.y + py
      if (dUp < WALL_MARGIN) {
        const f = 1 - dUp / WALL_MARGIN
        _wall.y -= WALL_STRENGTH * f * f
      }
      if (dDown < WALL_MARGIN) {
        const f = 1 - dDown / WALL_MARGIN
        _wall.y += WALL_STRENGTH * f * f
      }
    } else {
      const axes: [number, number, 'x' | 'y' | 'z'][] = [
        [px, bounds.x, 'x'], [py, bounds.y, 'y'], [pz, bounds.z, 'z'],
      ]
      for (const [p, b, axis] of axes) {
        const dPos = b - p
        const dNeg = b + p
        if (dPos < WALL_MARGIN) {
          const f = 1 - dPos / WALL_MARGIN
          _wall[axis] -= WALL_STRENGTH * f * f
        }
        if (dNeg < WALL_MARGIN) {
          const f = 1 - dNeg / WALL_MARGIN
          _wall[axis] += WALL_STRENGTH * f * f
        }
      }
    }
    _acc.add(_wall)

    vel.current.add(_acc)

    if (isHovered.current) {
      vel.current.clampLength(0, ARRIVE_MAX_SPEED)
    } else {
      const spd = vel.current.length()
      if (spd > MAX_SPEED) vel.current.setLength(MAX_SPEED)
      else if (spd < MIN_SPEED) vel.current.setLength(MIN_SPEED)
    }

    pos.current.add(_tmp.copy(vel.current).multiplyScalar(dt))

    if (bounds.shape === 'cylinder') {
      const distXZ = Math.sqrt(pos.current.x * pos.current.x + pos.current.z * pos.current.z)
      if (distXZ > bounds.radius) {
        const scale = bounds.radius / distXZ
        pos.current.x *= scale
        pos.current.z *= scale
      }
      pos.current.y = THREE.MathUtils.clamp(pos.current.y, -bounds.y, bounds.y)
    } else {
      pos.current.x = THREE.MathUtils.clamp(pos.current.x, -bounds.x, bounds.x)
      pos.current.y = THREE.MathUtils.clamp(pos.current.y, -bounds.y, bounds.y)
      pos.current.z = THREE.MathUtils.clamp(pos.current.z, -bounds.z, bounds.z)
    }

    fishOriginRef.current.position.copy(pos.current)
    if (positionRef) positionRef.current = pos.current
    if (vel.current.length() > 0.01) {
      _lookMat.lookAt(vel.current, _origin, _up)
      _targetQuat.setFromRotationMatrix(_lookMat)
      fishOriginRef.current.quaternion.slerp(_targetQuat, Math.min(dt * 6, 1))
    }

    const heading = Math.atan2(vel.current.x, vel.current.z)
    let hd = heading - prevHeading.current
    if (hd > Math.PI) hd -= 2 * Math.PI
    if (hd < -Math.PI) hd += 2 * Math.PI
    hd = THREE.MathUtils.clamp(hd, -MAX_HEADING_DELTA, MAX_HEADING_DELTA)
    const dtNorm = dt > 0 ? 0.016 / dt : 1
    smoothAngVel.current = smoothAngVel.current * 0.92 + hd * dtNorm * 0.08
    smoothAngVel.current = THREE.MathUtils.clamp(smoothAngVel.current, -MAX_ANG_VEL, MAX_ANG_VEL)
    prevHeading.current = heading

    const speedFactor = Math.max(vel.current.length() / MAX_SPEED, 0.15)
    wavePhase.current += dt * WAVE_SPEED * (0.7 + 0.5 * speedFactor)

    const wp = wavePhase.current
    const angV = smoothAngVel.current
    const bodyLen = BODY_RADIUS_X * 2

    const bodyPos = bodyState.geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < bodyPos.count; i++) {
      const ox = bodyState.original[i * 3]
      const oy = bodyState.original[i * 3 + 1]
      const oz = bodyState.original[i * 3 + 2]
      const tVal = (ox - (BODY_CENTER_X - BODY_RADIUS_X)) / bodyLen
      const t15 = Math.pow(tVal, 1.5)
      const wave = BODY_WAVE_AMP * speedFactor * t15 * Math.sin(wp - tVal * WAVE_K)
      const bend = -angV * 2.0 * t15
      bodyPos.setXYZ(i, ox, oy, oz + wave + bend)
    }
    bodyPos.needsUpdate = true
    bodyState.geo.computeVertexNormals()

    if (eyeGroupRef.current) {
      const eyeT = (BODY_CENTER_X - 0.48 - (BODY_CENTER_X - BODY_RADIUS_X)) / bodyLen
      const eyeT15 = Math.pow(Math.max(eyeT, 0), 1.5)
      const eyeZ = BODY_WAVE_AMP * speedFactor * eyeT15 * Math.sin(wp - eyeT * WAVE_K)
        - angV * 2.0 * eyeT15
      eyeGroupRef.current.position.z = eyeZ
    }

    if (pectoralWrapRef.current) {
      const pecT = (PECTORAL_X - (BODY_CENTER_X - BODY_RADIUS_X)) / bodyLen
      const pecT15 = Math.pow(Math.max(pecT, 0), 1.5)
      const pecZ = BODY_WAVE_AMP * speedFactor * pecT15 * Math.sin(wp - pecT * WAVE_K)
        - angV * 2.0 * pecT15
      pectoralWrapRef.current.position.z = pecZ
    }

    const pecPhase = wp * 1.5 + Math.PI * 0.7
    animateFinWave(pectoralState.left, 0.15, pecPhase, speedFactor, 0)
    animateFinWave(pectoralState.right, 0.15, pecPhase, speedFactor, 0)

    if (dorsalRef.current) {
      const dT = (DORSAL_X - (BODY_CENTER_X - BODY_RADIUS_X)) / bodyLen
      const dT15 = Math.pow(Math.max(dT, 0), 1.5)
      dorsalRef.current.position.z = BODY_WAVE_AMP * speedFactor * dT15 * Math.sin(wp - dT * WAVE_K)
        - angV * 2.0 * dT15
    }
    if (analRef.current) {
      const aT = (ANAL_X - (BODY_CENTER_X - BODY_RADIUS_X)) / bodyLen
      const aT15 = Math.pow(Math.max(aT, 0), 1.5)
      analRef.current.position.z = BODY_WAVE_AMP * speedFactor * aT15 * Math.sin(wp - aT * WAVE_K)
        - angV * 2.0 * aT15
    }

    const daBend = angV * 2.0
    animateFinWave(dorsalState, 0.18, wp, speedFactor, daBend)
    animateFinWave(analState, 0.18, wp, speedFactor, daBend)

    animateFinWave(tailState, WAVE_AMP, wp, speedFactor, angV * 4.5)

    if (glowRef.current > 0) {
      glowRef.current = Math.max(0, glowRef.current - dt * 0.7)
    }
    const glow = glowRef.current

    const colorAttr = bodyState.geo.attributes.color as THREE.BufferAttribute
    const hsl = { h: 0, s: 0, l: 0 }
    for (let i = 0; i < colorAttr.count; i++) {
      const ri = bodyState.originalColors[i * 3]
      const gi = bodyState.originalColors[i * 3 + 1]
      const bi = bodyState.originalColors[i * 3 + 2]
      if (glow > 0.001) {
        _lerpColor.setRGB(ri, gi, bi)
        _lerpColor.getHSL(hsl)
        hsl.s = Math.min(1, hsl.s + glow * 0.5)
        _lerpColor.setHSL(hsl.h, hsl.s, hsl.l)
        colorAttr.setXYZ(i, _lerpColor.r, _lerpColor.g, _lerpColor.b)
      } else {
        colorAttr.setXYZ(i, ri, gi, bi)
      }
    }
    colorAttr.needsUpdate = true

    memMat.emissiveIntensity = 0.5 + (glow > 0.001 ? glow * 1.5 : 0)
  })

  return (
    <group ref={fishOriginRef}>
      <group rotation={[0, Math.PI / 2, 0]} scale={FISH_SCALE}>
        <group scale={BODY_SCALE}>
          <mesh geometry={bodyState.geo} material={bodyState.material ?? undefined} />
          <group ref={eyeGroupRef}>
            {[1, -1].map(sign => (
              <mesh key={sign} position={[BODY_CENTER_X - 0.48, 0.08, 0.14 * sign]}>
                <sphereGeometry args={[0.04, 10, 10]} />
                <meshBasicMaterial color="#111111" />
              </mesh>
            ))}
          </group>
          <group ref={pectoralWrapRef}>
            <group ref={pectoralLeftRef} position={[PECTORAL_X, PECTORAL_Y, PECTORAL_Z]} rotation={[0, -Math.PI / 5, 0]} scale={PECTORAL_SCALE} />
            <group ref={pectoralRightRef} position={[PECTORAL_X, PECTORAL_Y, -PECTORAL_Z]} rotation={[0, Math.PI / 5, 0]} scale={PECTORAL_SCALE} />
          </group>
          <group ref={dorsalRef} position={[DORSAL_X, DORSAL_Y, 0]} rotation={[0, 0, Math.PI * 0.25]} scale={DORSAL_SCALE} />
          <group ref={analRef} position={[ANAL_X, ANAL_Y, 0]} rotation={[0, Math.PI, -Math.PI * 0.5]} scale={ANAL_SCALE} />
        </group>
        <group ref={tailGroupRef} position={[TAIL_X, TAIL_Y, 0]} scale={TAIL_SCALE} />
      </group>
    </group>
  )
}

useGLTF.preload(FISH_BODY_PATH)
