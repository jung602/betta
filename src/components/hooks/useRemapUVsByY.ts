import { useEffect } from 'react'
import * as THREE from 'three'

export function useRemapUVsByY(
  meshRef: React.RefObject<THREE.Mesh | null>,
  geo?: THREE.BufferGeometry | null
) {
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const geom = mesh.geometry
    const pos = geom.attributes.position
    if (!pos) return

    let uv = geom.attributes.uv as THREE.BufferAttribute | undefined
    if (!uv) {
      uv = new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2)
      geom.setAttribute('uv', uv)
    }

    let minY = Infinity, maxY = -Infinity
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    const range = maxY - minY || 1
    for (let i = 0; i < pos.count; i++) {
      const t = 1 - (pos.getY(i) - minY) / range
      uv.setX(i, 0.5)
      uv.setY(i, t)
    }
    uv.needsUpdate = true
  }, [meshRef, geo])
}
