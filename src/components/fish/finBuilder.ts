import * as THREE from 'three'
import { memMat, rayMat, finGradientColor } from './materials'
import { generateTail } from './tailGeometry'
import { WAVE_K } from './constants'

type TailGeometry = ReturnType<typeof generateTail>

export interface RayBuffer {
  geo: THREE.BufferGeometry
  positions: Float32Array
  original: Float32Array
}

export interface FinState {
  memOrig: Float32Array
  memLive: Float32Array
  memGeo: THREE.BufferGeometry
  memMesh: THREE.Mesh
  rayBufs: RayBuffer[]
  rayLines: THREE.Line[]
  finLen: number
}

/**
 * Builds the membrane mesh and per-ray line buffers for a fin from a generated
 * tail geometry. Colors are baked once based on the radial distance of each
 * vertex so the gradient stays fixed while positions animate.
 */
export function buildFinState(result: TailGeometry, finLen: number): FinState {
  const memOrig = new Float32Array(result.membrane)
  const memLive = new Float32Array(result.membrane)
  const memColors = new Float32Array(memLive.length)
  for (let i = 0; i < memLive.length; i += 3) {
    const r = Math.sqrt(memOrig[i] ** 2 + memOrig[i + 1] ** 2)
    const c = finGradientColor(Math.min(r / finLen, 1))
    memColors[i] = c.r; memColors[i + 1] = c.g; memColors[i + 2] = c.b
  }
  const memGeo = new THREE.BufferGeometry()
  memGeo.setAttribute('position', new THREE.BufferAttribute(memLive, 3))
  memGeo.setAttribute('color', new THREE.BufferAttribute(memColors, 3))
  const memMesh = new THREE.Mesh(memGeo, memMat)

  const rayBufs: RayBuffer[] = []
  const rayLines: THREE.Line[] = []
  for (const ray of result.rays) {
    const positions = new Float32Array(ray.length * 3)
    const original = new Float32Array(ray.length * 3)
    const colors = new Float32Array(ray.length * 3)
    for (let i = 0; i < ray.length; i++) {
      positions[i * 3] = ray[i].x
      positions[i * 3 + 1] = ray[i].y
      positions[i * 3 + 2] = 0
      original[i * 3] = ray[i].x
      original[i * 3 + 1] = ray[i].y
      original[i * 3 + 2] = 0
      const r = Math.sqrt(ray[i].x ** 2 + ray[i].y ** 2)
      const c = finGradientColor(Math.min(r / finLen, 1))
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    rayBufs.push({ geo, positions, original })
    rayLines.push(new THREE.Line(geo, rayMat))
  }

  return { memOrig, memLive, memGeo, memMesh, rayBufs, rayLines, finLen }
}

/**
 * Applies the travelling-wave + bending displacement along the local Z axis for
 * a fin's membrane and rays. `bendCoef` is the precomputed bend term
 * (e.g. angularVelocity * factor); pass 0 for fins that should not bend.
 */
export function animateFinWave(
  fin: FinState,
  amp: number,
  phase: number,
  speedFactor: number,
  bendCoef: number,
) {
  const ampF = amp * (0.5 + 0.6 * speedFactor)
  const { memOrig, memLive, finLen } = fin

  for (let i = 0; i < memLive.length; i += 3) {
    const ox = memOrig[i], oy = memOrig[i + 1]
    const r = Math.sqrt(ox * ox + oy * oy)
    let z = 0
    if (r > 0.01) {
      const tRel = Math.min(r / finLen, 1)
      const p15 = Math.pow(tRel, 1.5)
      z = ampF * p15 * Math.sin(phase - tRel * WAVE_K) - bendCoef * p15
    }
    memLive[i] = ox
    memLive[i + 1] = oy
    memLive[i + 2] = z
  }
  fin.memGeo.attributes.position.needsUpdate = true

  for (const buf of fin.rayBufs) {
    const { positions, original } = buf
    for (let i = 0; i < positions.length; i += 3) {
      const ox = original[i], oy = original[i + 1]
      const r = Math.sqrt(ox * ox + oy * oy)
      let z = 0
      if (r > 0.01) {
        const tRel = Math.min(r / finLen, 1)
        const p15 = Math.pow(tRel, 1.5)
        z = ampF * p15 * Math.sin(phase - tRel * WAVE_K) - bendCoef * p15
      }
      positions[i] = ox
      positions[i + 1] = oy
      positions[i + 2] = z
    }
    buf.geo.attributes.position.needsUpdate = true
  }
}
