import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export interface FoodPellet {
  id: number
  position: THREE.Vector3
  velocity: THREE.Vector3
  alive: boolean
}

const FLOOR_Y = -0.85

const foodGeo = new THREE.SphereGeometry(0.02, 8, 6)
const foodMat = new THREE.MeshStandardMaterial({
  color: '#c8924a',
  emissive: '#6b4420',
  emissiveIntensity: 0.2,
  roughness: 0.8,
})

interface FishFoodProps {
  pelletsRef: { current: FoodPellet[] }
  bounds: { x: number; y: number; z: number }
}

export default function FishFood({ pelletsRef, bounds }: FishFoodProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshMapRef = useRef(new Map<number, THREE.Mesh>())

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return

    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    const pellets = pelletsRef.current
    const meshMap = meshMapRef.current

    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i]
      if (!p.alive) {
        const mesh = meshMap.get(p.id)
        if (mesh) {
          group.remove(mesh)
          meshMap.delete(p.id)
        }
        pellets.splice(i, 1)
        continue
      }

      p.velocity.y = Math.max(p.velocity.y - 0.08 * dt, -0.2)
      p.velocity.x *= 1 - 0.5 * dt
      p.velocity.z *= 1 - 0.5 * dt

      p.position.addScaledVector(p.velocity, dt)
      p.position.x += Math.sin(t * 2.5 + p.id * 1.7) * 0.03 * dt
      p.position.z += Math.cos(t * 2.0 + p.id * 2.3) * 0.03 * dt

      p.position.x = THREE.MathUtils.clamp(p.position.x, -bounds.x, bounds.x)
      p.position.y = THREE.MathUtils.clamp(p.position.y, -bounds.y, bounds.y)
      p.position.z = THREE.MathUtils.clamp(p.position.z, -bounds.z, bounds.z)

      if (p.position.y <= -bounds.y) {
        p.velocity.set(0, 0, 0)
      }

      let mesh = meshMap.get(p.id)
      if (!mesh) {
        mesh = new THREE.Mesh(foodGeo, foodMat)
        meshMap.set(p.id, mesh)
        group.add(mesh)
      }
      mesh.position.copy(p.position)
    }
  })

  return <group ref={groupRef} />
}
