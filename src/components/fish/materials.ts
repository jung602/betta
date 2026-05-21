import * as THREE from 'three'

const _gradBase = new THREE.Color('#a03828')
const _gradMid = new THREE.Color('#6828a8')
const _gradTip = new THREE.Color('#2848d0')
const _gradTmp = new THREE.Color()

export function finGradientColor(t: number): THREE.Color {
  const c = Math.max(0, Math.min(1, t))
  if (c < 0.5) {
    _gradTmp.copy(_gradBase).lerp(_gradMid, c * 2)
  } else {
    _gradTmp.copy(_gradMid).lerp(_gradTip, (c - 0.5) * 2)
  }
  return _gradTmp
}

export const memMat = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  vertexColors: true,
  emissive: '#ff0000',
  emissiveIntensity: 0.5,
  transparent: true,
  opacity: 0.55,
  side: THREE.DoubleSide,
})

export const rayMat = new THREE.LineBasicMaterial({ vertexColors: true })
