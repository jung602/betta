const BUTTON_SIZE = 46
const ARC_RADIUS = 72
const WHITE_BG = `${import.meta.env.BASE_URL}icon/white.png`

export interface RadialItem<K extends string> {
  key: K
  /** Fully resolved icon image src. */
  icon: string
  label: string
}

interface RadialSelectorProps<K extends string> {
  items: RadialItem<K>[]
  selected: K
  onSelect: (key: K) => void
  visible: boolean
  /** Arc start/end angles in degrees (measured counter-clockwise from +x). */
  startAngle: number
  endAngle: number
}

/**
 * Renders a fan of circular icon buttons arranged along an arc. Used for both
 * the tail-preset and tank-model pickers.
 */
export default function RadialSelector<K extends string>({
  items,
  selected,
  onSelect,
  visible,
  startAngle,
  endAngle,
}: RadialSelectorProps<K>) {
  const count = items.length

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>
      {items.map(({ key, icon, label }, i) => {
        const angleDeg = count === 1
          ? 90
          : startAngle - i * (startAngle - endAngle) / (count - 1)
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
              src={WHITE_BG}
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
              src={icon}
              alt={label}
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
