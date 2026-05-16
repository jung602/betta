import { TANK_MODELS, type TankModelKey } from '../tank'

const tankKeys = Object.keys(TANK_MODELS) as TankModelKey[]

interface TankSelectorProps {
  selected: TankModelKey
  onSelect: (key: TankModelKey) => void
}

export default function TankSelector({ selected, onSelect }: TankSelectorProps) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {tankKeys.map(key => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          style={{
            padding: '7px 16px',
            fontSize: 13,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif',
            fontWeight: selected === key ? 500 : 400,
            background: selected === key ? 'rgba(48, 100, 192, 0.12)' : 'rgba(255,255,255,0.7)',
            color: selected === key ? '#3064c0' : '#445',
            border: selected === key ? '1px solid rgba(48, 100, 192, 0.35)' : '1px solid rgba(0,0,0,0.1)',
            borderRadius: 999,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.15s ease',
          }}
        >
          {TANK_MODELS[key].label}
        </button>
      ))}
    </div>
  )
}
