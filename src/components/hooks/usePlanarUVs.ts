import { useEffect } from 'react'
import * as THREE from 'three'

export function usePlanarUVs(
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

    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1

    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) - minX) / rangeX
      const v = 1 - (pos.getY(i) - minY) / rangeY
      uv.setXY(i, u, v)
    }
    uv.needsUpdate = true
  }, [meshRef, geo])
}
