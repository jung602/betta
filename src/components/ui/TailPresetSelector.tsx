import { TAIL_PRESETS, type TailPresetKey } from '../fish'

const presetKeys = (Object.keys(TAIL_PRESETS) as TailPresetKey[]).filter(k => k !== 'delta' && k !== 'halfmoon')

const TAIL_ICONS: Record<TailPresetKey, string> = {
  plakat: '플라캇.png',
  delta: '델타.png',
  halfmoon: '하프문.png',
  crowntail: '크라운테일.png',
  rosetail: '로즈테일.png',
  veiltail: '베일테일.png',
  doubletail: '더블테일.png',
}

const BUTTON_SIZE = 46
const ARC_RADIUS = 72
const START_ANGLE = 210
const END_ANGLE = 50

interface TailPresetSelectorProps {
  selected: TailPresetKey
  onSelect: (key: TailPresetKey) => void
  visible: boolean
}

export default function TailPresetSelector({ selected, onSelect, visible }: TailPresetSelectorProps) {
  const count = presetKeys.length

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>
      {presetKeys.map((key, i) => {
        const angleDeg = count === 1
          ? 90
          : START_ANGLE - i * (START_ANGLE - END_ANGLE) / (count - 1)
        const angleRad = (angleDeg * Math.PI) / 180
        const x = ARC_RADIUS * Math.cos(angleRad)
        const y = -ARC_RADIUS * Math.sin(angleRad)
        const isSelected = selected === key

        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            style={{
              position: 'absolute',
              left: x - BUTTON_SIZE / 2,
              top: y - BUTTON_SIZE / 2,
              width: BUTTON_SIZE,
              height: BUTTON_SIZE,
              borderRadius: '50%',
              border: isSelected ? '2px solid rgba(48,100,192,0.45)' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              overflow: 'hidden',
              transition: 'all 0.25s ease',
              opacity: visible ? 1 : 0,
              transform: visible ? 'scale(1)' : 'scale(0.3)',
              transitionDelay: visible ? `${i * 30}ms` : '0ms',
              pointerEvents: visible ? 'auto' : 'none',
              boxShadow: isSelected
                ? '0 2px 10px rgba(48,100,192,0.2)'
                : '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}white.png`}
              alt=""
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '50%',
                pointerEvents: 'none',
                opacity: isSelected ? 0.95 : 0.75,
                transition: 'opacity 0.2s ease',
              }}
            />
            <img
              src={`${import.meta.env.BASE_URL}tailicons/${TAIL_ICONS[key]}`}
              alt={TAIL_PRESETS[key].label}
              style={{
                position: 'relative',
                zIndex: 1,
                width: 30,
                height: 30,
                objectFit: 'contain',
                pointerEvents: 'none',
                filter: isSelected ? 'none' : 'grayscale(0.3) opacity(0.8)',
                transition: 'filter 0.2s ease',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
