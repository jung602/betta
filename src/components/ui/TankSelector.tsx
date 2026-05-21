import { TANK_MODELS, type TankModelKey } from '../tank'

const tankKeys = Object.keys(TANK_MODELS) as TankModelKey[]

const TANK_ICONS: Record<TankModelKey, string> = {
  square: 'square.png',
  round: 'tank.png',
  imac: 'imac.png',
}

const BUTTON_SIZE = 46
const ARC_RADIUS = 72
const START_ANGLE = 100
const END_ANGLE = 10

interface TankSelectorProps {
  selected: TankModelKey
  onSelect: (key: TankModelKey) => void
  visible: boolean
}

export default function TankSelector({ selected, onSelect, visible }: TankSelectorProps) {
  const count = tankKeys.length

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>
      {tankKeys.map((key, i) => {
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
              src={`${import.meta.env.BASE_URL}${TANK_ICONS[key]}`}
              alt={TANK_MODELS[key].label}
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
