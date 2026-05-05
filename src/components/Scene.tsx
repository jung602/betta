import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, ContactShadows, OrbitControls } from '@react-three/drei'
import FrostedGlassBox, { ShapeType } from './FrostedGlassBox'
import { TAIL_PRESETS, TailPresetKey } from './BettaFish'

const presetKeys = Object.keys(TAIL_PRESETS) as TailPresetKey[]

export default function Scene() {
  const [tailPreset, setTailPreset] = useState<TailPresetKey>('halfmoon')
  const [shape, setShape] = useState<ShapeType>('box')

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

        <FrostedGlassBox tailPreset={tailPreset} shape={shape} />

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
        <div style={{ display: 'flex', gap: 6 }}>
          {(['box', 'sphere'] as ShapeType[]).map(s => (
            <button
              key={s}
              onClick={() => setShape(s)}
              style={{
                padding: '7px 18px',
                fontSize: 13,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif',
                fontWeight: shape === s ? 500 : 400,
                background: shape === s ? 'rgba(74, 144, 232, 0.12)' : 'rgba(255,255,255,0.7)',
                color: shape === s ? '#4a90e8' : '#445',
                border: shape === s ? '1px solid rgba(74, 144, 232, 0.35)' : '1px solid rgba(0,0,0,0.1)',
                borderRadius: 999,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.15s ease',
              }}
            >
              {s === 'box' ? '박스' : '스피어'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {presetKeys.map(key => (
            <button
              key={key}
              onClick={() => setTailPreset(key)}
              style={{
                padding: '7px 16px',
                fontSize: 13,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif',
                fontWeight: tailPreset === key ? 500 : 400,
                background: tailPreset === key ? 'rgba(192, 64, 48, 0.12)' : 'rgba(255,255,255,0.7)',
                color: tailPreset === key ? '#c04030' : '#445',
                border: tailPreset === key ? '1px solid rgba(192, 64, 48, 0.35)' : '1px solid rgba(0,0,0,0.1)',
                borderRadius: 999,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.15s ease',
              }}
            >
              {TAIL_PRESETS[key].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
