import * as THREE from 'three'

export interface FoodPellet {
  id: number
  position: THREE.Vector3
  velocity: THREE.Vector3
  alive: boolean
}

export interface Bounds {
  x: number
  y: number
  z: number
  shape: 'box' | 'cylinder'
  radius: number
}
