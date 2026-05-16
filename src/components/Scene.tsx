import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, ContactShadows, OrbitControls } from '@react-three/drei'
import { FrostedGlassBox } from './tank'
import { TailPresetSelector } from './ui'
import type { TailPresetKey } from './fish'

export default function Scene() {
  const [tailPreset, setTailPreset] = useState<TailPresetKey>('halfmoon')

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(180deg, #eaf2ff 0%, #f0f6ff 50%, #ffffff 100%)',
      position: 'relative',
    }}>
      <Canvas
        camera={{ position: [2, 1.5, 3], fov: 35 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: 3,
          toneMappingExposure: 1.4,
        }}
        shadows
      >
        <color attach="background" args={['#f0f5ff']} />
        <fog attach="fog" args={['#f0f5ff', 8, 20]} />

        <ambientLight intensity={1.0} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={2.0}
          castShadow
          shadow-mapSize={[2048, 2048]}
          color="#ffffff"
        />
        <directionalLight
          position={[-3, 4, -2]}
          intensity={0.6}
          color="#a8d4ff"
        />
        <pointLight position={[0, 2, 3]} intensity={0.8} color="#dceeff" />
        <pointLight position={[-2, 1, 1]} intensity={0.4} color="#b0d4ff" />

        <FrostedGlassBox tailPreset={tailPreset} />

        <ContactShadows
          position={[0, -0.8, 0]}
          opacity={0.3}
          scale={5}
          blur={2.5}
          far={3}
          color="#6aafe0"
        />

        <Environment preset="city" environmentIntensity={1.2} />

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2}
          autoRotate={false}
          dampingFactor={0.05}
          enableDamping
        />
      </Canvas>

      <TailPresetSelector selected={tailPreset} onSelect={setTailPreset} />
    </div>
  )
}
