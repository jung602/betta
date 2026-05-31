import { GlossyGlow, GlossyHighlight } from './glossySurface'

export const RADIAL_BUTTON_SIZE = 46
export const RADIAL_ARC_RADIUS = 72
/** 원형 배경이 아크·버튼 전체를 덮도록 하는 지름(px) */
export const RADIAL_BACKDROP_SIZE =
  2 * (RADIAL_ARC_RADIUS + RADIAL_BUTTON_SIZE / 2 + 6)

const BUTTON_SIZE = RADIAL_BUTTON_SIZE
const ARC_RADIUS = RADIAL_ARC_RADIUS
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
            type="button"
            onClick={() => onSelect(key)}
            style={{
              position: 'absolute',
              left: x - BUTTON_SIZE / 2,
              top: y - BUTTON_SIZE / 2,
              width: BUTTON_SIZE,
              height: BUTTON_SIZE,
              borderRadius: '50%',
              border: 'none',
              backgroundColor: isSelected
                ? 'rgba(150, 222, 245, 1)'
                : 'rgba(224, 224, 224, 1)',
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
              boxShadow: '1px 1px 0px 0px rgba(255, 255, 255, 1), 0px -1px 0px 0px rgba(0, 0, 0, 0.2)',
            }}
          >
            <GlossyHighlight variant="circle" theme="fafafa" />
            <GlossyGlow variant="circle" theme="fafafa" />
            <img
              src={icon}
              alt={label}
              style={{
                position: 'absolute',
                zIndex: 2,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 30,
                height: 30,
                objectFit: 'contain',
                pointerEvents: 'none',
                filter: isSelected ? 'none' : 'grayscale(0.3) opacity(0.85)',
                transition: 'filter 0.2s ease',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
