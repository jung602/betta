import { TAIL_PRESETS, type TailPresetKey } from '../fish'

const presetKeys = Object.keys(TAIL_PRESETS) as TailPresetKey[]

interface TailPresetSelectorProps {
  selected: TailPresetKey
  onSelect: (key: TailPresetKey) => void
}

export default function TailPresetSelector({ selected, onSelect }: TailPresetSelectorProps) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {presetKeys.map(key => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          style={{
            padding: '7px 16px',
            fontSize: 13,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif',
            fontWeight: selected === key ? 500 : 400,
            background: selected === key ? 'rgba(192, 64, 48, 0.12)' : 'rgba(255,255,255,0.7)',
            color: selected === key ? '#c04030' : '#445',
            border: selected === key ? '1px solid rgba(192, 64, 48, 0.35)' : '1px solid rgba(0,0,0,0.1)',
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
  )
}
