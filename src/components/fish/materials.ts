import * as THREE from 'three'

export const memMat = new THREE.MeshStandardMaterial({
  color: '#e2604f',
  emissive: '#a03020',
  emissiveIntensity: 0.5,
  transparent: true,
  opacity: 0.55,
  side: THREE.DoubleSide,
})

export const rayMat = new THREE.LineBasicMaterial({ color: 0x862828 })
