import { useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, ContactShadows, OrbitControls } from '@react-three/drei'
import { FrostedGlassBox, type TankModelKey } from './tank'
import { TailPresetSelector, TankSelector } from './ui'
import type { TailPresetKey } from './fish'

export default function Scene() {
  const [tailPreset, setTailPreset] = useState<TailPresetKey>('halfmoon')
  const [tankModel, setTankModel] = useState<TankModelKey>('square')
  const [floorY, setFloorY] = useState(-0.2)

  const handleFloorY = useCallback((y: number) => setFloorY(y), [])

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
          antialias: false,
          alpha: true,
          toneMapping: 3,
          toneMappingExposure: 1.4,
        }}
        shadows
      >
        <color attach="background" args={['#f0f5ff']} />
        <fog attach="fog" args={['#f0f5ff', 10, 10]} />

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

        <FrostedGlassBox key={tankModel} tailPreset={tailPreset} tankModel={tankModel} onFloorY={handleFloorY} />

        <ContactShadows
          position={[0, floorY, 0]}
          opacity={0.3}
          scale={1.25}
          blur={2.5}
          far={0.75}
          color="#6aafe0"
        />

        <Environment preset="city" environmentIntensity={1} />

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

      <div style={{
        position: 'absolute',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}>
        <TankSelector selected={tankModel} onSelect={setTankModel} />
        <TailPresetSelector selected={tailPreset} onSelect={setTailPreset} />
      </div>
    </div>
  )
}
