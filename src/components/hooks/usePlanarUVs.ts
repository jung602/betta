import * as THREE from 'three'

/** XY 평면 기준으로 UV를 0~1로 리맵 (Blender UV와 무관하게 면 전체에 텍스처 매핑) */
export function remapPlanarUVs(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.clone()
  const pos = g.attributes.position
  if (!pos) return g

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
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

  const uv = new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2)
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(
      i,
      (pos.getX(i) - minX) / rangeX,
      1 - (pos.getY(i) - minY) / rangeY,
    )
  }
  g.setAttribute('uv', uv)
  return g
}
