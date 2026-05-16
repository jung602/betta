import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { FoodPellet, Bounds } from '../types'
import { TAIL_PRESETS, type TailPresetKey } from './tailPresets'
import { generateTail } from './tailGeometry'
import { memMat, rayMat } from './materials'
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
  _acc, _desired, _steer, _wall, _tmp,
  _lookMat, _up, _origin, _targetQuat,
  _baseBodyEmissive, _baseMemEmissive, _glowEmissive, _lerpColor,
} from './constants'

interface BettaFishProps {
  mouseTarget: React.RefObject<THREE.Vector3 | null>
  isHovered: React.RefObject<boolean>
  bounds: Bounds
  tailPreset: TailPresetKey
  foodPellets: { current: FoodPellet[] }
}

export default function BettaFish({ mouseTarget, isHovered, bounds, tailPreset, foodPellets }: BettaFishProps) {
  const fishOriginRef = useRef<THREE.Group>(null)
  const tailGroupRef = useRef<THREE.Group>(null)
  const eyeGroupRef = useRef<THREE.Group>(null)
  const pectoralLeftRef = useRef<THREE.Group>(null)
  const pectoralRightRef = useRef<THREE.Group>(null)
  const pectoralWrapRef = useRef<THREE.Group>(null)
  const dorsalRef = useRef<THREE.Group>(null)
  const analRef = useRef<THREE.Group>(null)

  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const glowRef = useRef(0)

  const pos = useRef(new THREE.Vector3(0, 0, 0))
  const vel = useRef(new THREE.Vector3(0.2, 0, 0.15).setLength(MIN_SPEED))
  const prevHeading = useRef(Math.atan2(0.2, 0.15))
  const smoothAngVel = useRef(0)
  const wavePhase = useRef(0)

  const bodyState = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 20, 14)
    const posAttr = geo.attributes.position as THREE.BufferAttribute
    const original = new Float32Array(posAttr.count * 3)
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i) * BODY_RADIUS_X + BODY_CENTER_X
      const y = posAttr.getY(i) * BODY_RADIUS_Y + BODY_CENTER_Y
      const z = posAttr.getZ(i) * BODY_RADIUS_Z
      posAttr.setXYZ(i, x, y, z)
      original[i * 3] = x
      original[i * 3 + 1] = y
      original[i * 3 + 2] = z
    }
    posAttr.needsUpdate = true
    geo.computeVertexNormals()
    return { geo, original }
  }, [])

  const pectoralState = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = generateTail(PECTORAL_FIN as any)

    function makeSide() {
      const memOrig = new Float32Array(result.membrane)
      const memLive = new Float32Array(result.membrane)
      const memGeo = new THREE.BufferGeometry()
      memGeo.setAttribute('position', new THREE.BufferAttribute(memLive, 3))
      const memMesh = new THREE.Mesh(memGeo, memMat)

      const rayBufs: { geo: THREE.BufferGeometry; positions: Float32Array; original: Float32Array }[] = []
      const rayLines: THREE.Line[] = []
      for (const ray of result.rays) {
        const positions = new Float32Array(ray.length * 3)
        const original = new Float32Array(ray.length * 3)
        for (let i = 0; i < ray.length; i++) {
          positions[i * 3] = ray[i].x
          positions[i * 3 + 1] = ray[i].y
          positions[i * 3 + 2] = 0
          original[i * 3] = ray[i].x
          original[i * 3 + 1] = ray[i].y
          original[i * 3 + 2] = 0
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        rayBufs.push({ geo, positions, original })
        rayLines.push(new THREE.Line(geo, rayMat))
      }
      return { memOrig, memLive, memGeo, memMesh, rayBufs, rayLines }
    }

    return { left: makeSide(), right: makeSide(), finLen: PECTORAL_FIN.length }
  }, [])

  const dorsalState = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = generateTail(DORSAL_FIN as any)
    const memOrig = new Float32Array(result.membrane)
    const memLive = new Float32Array(result.membrane)
    const memGeo = new THREE.BufferGeometry()
    memGeo.setAttribute('position', new THREE.BufferAttribute(memLive, 3))
    const memMesh = new THREE.Mesh(memGeo, memMat)
    const rayBufs: { geo: THREE.BufferGeometry; positions: Float32Array; original: Float32Array }[] = []
    const rayLines: THREE.Line[] = []
    for (const ray of result.rays) {
      const positions = new Float32Array(ray.length * 3)
      const original = new Float32Array(ray.length * 3)
      for (let i = 0; i < ray.length; i++) {
        positions[i * 3] = ray[i].x
        positions[i * 3 + 1] = ray[i].y
        positions[i * 3 + 2] = 0
        original[i * 3] = ray[i].x
        original[i * 3 + 1] = ray[i].y
        original[i * 3 + 2] = 0
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      rayBufs.push({ geo, positions, original })
      rayLines.push(new THREE.Line(geo, rayMat))
    }
    return { memOrig, memLive, memGeo, memMesh, rayBufs, rayLines, finLen: DORSAL_FIN.length }
  }, [])

  const analState = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = generateTail(ANAL_FIN as any)
    const memOrig = new Float32Array(result.membrane)
    const memLive = new Float32Array(result.membrane)
    const memGeo = new THREE.BufferGeometry()
    memGeo.setAttribute('position', new THREE.BufferAttribute(memLive, 3))
    const memMesh = new THREE.Mesh(memGeo, memMat)
    const rayBufs: { geo: THREE.BufferGeometry; positions: Float32Array; original: Float32Array }[] = []
    const rayLines: THREE.Line[] = []
    for (const ray of result.rays) {
      const positions = new Float32Array(ray.length * 3)
      const original = new Float32Array(ray.length * 3)
      for (let i = 0; i < ray.length; i++) {
        positions[i * 3] = ray[i].x
        positions[i * 3 + 1] = ray[i].y
        positions[i * 3 + 2] = 0
        original[i * 3] = ray[i].x
        original[i * 3 + 1] = ray[i].y
        original[i * 3 + 2] = 0
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      rayBufs.push({ geo, positions, original })
      rayLines.push(new THREE.Line(geo, rayMat))
    }
    return { memOrig, memLive, memGeo, memMesh, rayBufs, rayLines, finLen: ANAL_FIN.length }
  }, [])

  const preset = TAIL_PRESETS[tailPreset]

  const tailState = useMemo(() => {
    const result = generateTail(preset)

    const memOriginal = new Float32Array(result.membrane)
    const memLive = new Float32Array(result.membrane)
    const memGeo = new THREE.BufferGeometry()
    memGeo.setAttribute('position', new THREE.BufferAttribute(memLive, 3))
    const memMesh = new THREE.Mesh(memGeo, memMat)

    const rayBufs: { geo: THREE.BufferGeometry; positions: Float32Array; original: Float32Array }[] = []
    const rayLines: THREE.Line[] = []

    for (const ray of result.rays) {
      const positions = new Float32Array(ray.length * 3)
      const original = new Float32Array(ray.length * 3)
      for (let i = 0; i < ray.length; i++) {
        positions[i * 3] = ray[i].x
        positions[i * 3 + 1] = ray[i].y
        positions[i * 3 + 2] = 0
        original[i * 3] = ray[i].x
        original[i * 3 + 1] = ray[i].y
        original[i * 3 + 2] = 0
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      rayBufs.push({ geo, positions, original })
      rayLines.push(new THREE.Line(geo, rayMat))
    }

    return { memOriginal, memLive, memGeo, memMesh, rayBufs, rayLines, tailLen: preset.length }
  }, [preset])

  useEffect(() => {
    const group = tailGroupRef.current
    if (!group) return
    group.add(tailState.memMesh)
    tailState.rayLines.forEach(l => group.add(l))
    return () => {
      group.remove(tailState.memMesh)
      tailState.rayLines.forEach(l => group.remove(l))
      tailState.memGeo.dispose()
      tailState.rayBufs.forEach(b => b.geo.dispose())
    }
  }, [tailState])

  useEffect(() => {
    const left = pectoralLeftRef.current
    const right = pectoralRightRef.current
    if (!left || !right) return
    left.add(pectoralState.left.memMesh)
    pectoralState.left.rayLines.forEach(l => left.add(l))
    right.add(pectoralState.right.memMesh)
    pectoralState.right.rayLines.forEach(l => right.add(l))
    return () => {
      left.remove(pectoralState.left.memMesh)
      pectoralState.left.rayLines.forEach(l => left.remove(l))
      right.remove(pectoralState.right.memMesh)
      pectoralState.right.rayLines.forEach(l => right.remove(l))
      for (const s of [pectoralState.left, pectoralState.right]) {
        s.memGeo.dispose()
        s.rayBufs.forEach(b => b.geo.dispose())
      }
    }
  }, [pectoralState])

  useEffect(() => {
    const group = dorsalRef.current
    if (!group) return
    group.add(dorsalState.memMesh)
    dorsalState.rayLines.forEach(l => group.add(l))
    return () => {
      group.remove(dorsalState.memMesh)
      dorsalState.rayLines.forEach(l => group.remove(l))
      dorsalState.memGeo.dispose()
      dorsalState.rayBufs.forEach(b => b.geo.dispose())
    }
  }, [dorsalState])

  useEffect(() => {
    const group = analRef.current
    if (!group) return
    group.add(analState.memMesh)
    analState.rayLines.forEach(l => group.add(l))
    return () => {
      group.remove(analState.memMesh)
      analState.rayLines.forEach(l => group.remove(l))
      analState.memGeo.dispose()
      analState.rayBufs.forEach(b => b.geo.dispose())
    }
  }, [analState])

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
        if (nearestDist < 0.25) {
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
      if (dist < 0.08) {
        vel.current.multiplyScalar(0.8)
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
      _acc.x += Math.sin(t * 0.42) * 0.004 + Math.sin(t * 1.13 + 1.5) * 0.003
      _acc.y += Math.sin(t * 0.35 + 2) * 0.002
      _acc.z += Math.sin(t * 0.55 + 1.2) * 0.004 + Math.sin(t * 0.95 + 2.5) * 0.003
    }

    _wall.set(0, 0, 0)
    const px = pos.current.x, py = pos.current.y, pz = pos.current.z
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
    pos.current.x = THREE.MathUtils.clamp(pos.current.x, -bounds.x, bounds.x)
    pos.current.y = THREE.MathUtils.clamp(pos.current.y, -bounds.y, bounds.y)
    pos.current.z = THREE.MathUtils.clamp(pos.current.z, -bounds.z, bounds.z)

    fishOriginRef.current.position.copy(pos.current)
    if (vel.current.length() > 0.04) {
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
    const pecWaveAmp = 0.15
    const pecFinLen = pectoralState.finLen

    for (const side of [pectoralState.left, pectoralState.right]) {
      for (let i = 0; i < side.memLive.length; i += 3) {
        const ox = side.memOrig[i], oy = side.memOrig[i + 1]
        const r = Math.sqrt(ox * ox + oy * oy)
        let z = 0
        if (r > 0.01) {
          const tRel = Math.min(r / pecFinLen, 1.0)
          const p15 = Math.pow(tRel, 1.5)
          z = pecWaveAmp * (0.5 + 0.6 * speedFactor) * p15 * Math.sin(pecPhase - tRel * WAVE_K)
        }
        side.memLive[i] = ox
        side.memLive[i + 1] = oy
        side.memLive[i + 2] = z
      }
      side.memGeo.attributes.position.needsUpdate = true

      for (const buf of side.rayBufs) {
        for (let i = 0; i < buf.positions.length; i += 3) {
          const ox = buf.original[i], oy = buf.original[i + 1]
          const r = Math.sqrt(ox * ox + oy * oy)
          let z = 0
          if (r > 0.01) {
            const tRel = Math.min(r / pecFinLen, 1.0)
            const p15 = Math.pow(tRel, 1.5)
            z = pecWaveAmp * (0.5 + 0.6 * speedFactor) * p15 * Math.sin(pecPhase - tRel * WAVE_K)
          }
          buf.positions[i] = ox
          buf.positions[i + 1] = oy
          buf.positions[i + 2] = z
        }
        buf.geo.attributes.position.needsUpdate = true
      }
    }

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

    const daWaveAmp = 0.18
    for (const finState of [dorsalState, analState]) {
      for (let i = 0; i < finState.memLive.length; i += 3) {
        const ox = finState.memOrig[i], oy = finState.memOrig[i + 1]
        const r = Math.sqrt(ox * ox + oy * oy)
        let z = 0
        if (r > 0.01) {
          const tRel = Math.min(r / finState.finLen, 1.0)
          const p15 = Math.pow(tRel, 1.5)
          z = daWaveAmp * (0.5 + 0.6 * speedFactor) * p15 * Math.sin(wp - tRel * WAVE_K)
            - angV * 2.0 * p15
        }
        finState.memLive[i] = ox
        finState.memLive[i + 1] = oy
        finState.memLive[i + 2] = z
      }
      finState.memGeo.attributes.position.needsUpdate = true

      for (const buf of finState.rayBufs) {
        for (let i = 0; i < buf.positions.length; i += 3) {
          const ox = buf.original[i], oy = buf.original[i + 1]
          const r = Math.sqrt(ox * ox + oy * oy)
          let z = 0
          if (r > 0.01) {
            const tRel = Math.min(r / finState.finLen, 1.0)
            const p15 = Math.pow(tRel, 1.5)
            z = daWaveAmp * (0.5 + 0.6 * speedFactor) * p15 * Math.sin(wp - tRel * WAVE_K)
              - angV * 2.0 * p15
          }
          buf.positions[i] = ox
          buf.positions[i + 1] = oy
          buf.positions[i + 2] = z
        }
        buf.geo.attributes.position.needsUpdate = true
      }
    }

    const { memOriginal, memLive, memGeo, rayBufs, tailLen } = tailState

    for (let i = 0; i < memLive.length; i += 3) {
      const ox = memOriginal[i], oy = memOriginal[i + 1]
      const r = Math.sqrt(ox * ox + oy * oy)
      let z = 0
      if (r > 0.01) {
        const tRel = Math.min(r / tailLen, 1.0)
        const p15 = Math.pow(tRel, 1.5)
        z = WAVE_AMP * (0.5 + 0.6 * speedFactor) * p15 * Math.sin(wp - tRel * WAVE_K)
          - angV * 4.5 * p15
      }
      memLive[i] = ox
      memLive[i + 1] = oy
      memLive[i + 2] = z
    }
    memGeo.attributes.position.needsUpdate = true

    for (const buf of rayBufs) {
      for (let i = 0; i < buf.positions.length; i += 3) {
        const ox = buf.original[i], oy = buf.original[i + 1]
        const r = Math.sqrt(ox * ox + oy * oy)
        let z = 0
        if (r > 0.01) {
          const tRel = Math.min(r / tailLen, 1.0)
          const p15 = Math.pow(tRel, 1.5)
          z = WAVE_AMP * (0.5 + 0.6 * speedFactor) * p15 * Math.sin(wp - tRel * WAVE_K)
            - angV * 4.5 * p15
        }
        buf.positions[i] = ox
        buf.positions[i + 1] = oy
        buf.positions[i + 2] = z
      }
      buf.geo.attributes.position.needsUpdate = true
    }

    if (glowRef.current > 0) {
      glowRef.current = Math.max(0, glowRef.current - dt * 0.7)
    }
    const glow = glowRef.current
    if (bodyMatRef.current) {
      bodyMatRef.current.emissiveIntensity = 1.0 + glow * 7.0
      _lerpColor.copy(_baseBodyEmissive).lerp(_glowEmissive, glow)
      bodyMatRef.current.emissive.copy(_lerpColor)
    }
    memMat.emissiveIntensity = 0.5 + glow * 7.0
    _lerpColor.copy(_baseMemEmissive).lerp(_glowEmissive, glow)
    memMat.emissive.copy(_lerpColor)
  })

  return (
    <group ref={fishOriginRef}>
      <group rotation={[0, Math.PI / 2, 0]} scale={FISH_SCALE}>
        <group scale={BODY_SCALE}>
          <mesh geometry={bodyState.geo}>
            <meshStandardMaterial
              ref={bodyMatRef}
              color="#c04030"
              emissive="#802018"
              emissiveIntensity={1}
            />
          </mesh>
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
        <group ref={tailGroupRef} scale={TAIL_SCALE} />
      </group>
    </group>
  )
}
