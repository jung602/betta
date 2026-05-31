import { TANK_MODELS, type TankModelKey } from '../tank'
import { TAIL_PRESETS, type TailPresetKey } from '../fish'
import type { GamePhase } from '../tank/tiktaktoe/useTictactoeGame'
import type { Cell } from '../tank/tiktaktoe/tictactoeAi'
import { GlossyGlow, GlossyHighlight } from './glossySurface'

const FONT =
  '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif'

const BASE = import.meta.env.BASE_URL

export const GRID_BAR_SURFACE = {
  border: '1.5px solid rgba(158, 158, 158, 0.35)',
  borderRadius: 20,
  boxShadow:
    '1px 1px 0px 0px rgba(255, 255, 255, 1), -1px -1px 0px 0px rgba(0, 0, 0, 0.1)',
  backgroundColor: '#eee',
  backgroundImage: `
    linear-gradient(rgba(158, 158, 158, 0.22) 1px, transparent 1px),
    linear-gradient(90deg, rgba(158, 158, 158, 0.22) 1px, transparent 1px)
  `,
  backgroundSize: '16px 16px',
} as const

const TANK_ICONS: Record<TankModelKey, string> = {
  square: 'icon/square.png',
  round: 'icon/tank.png',
  imac: 'icon/imac.png',
}

const TAIL_ICONS: Record<TailPresetKey, string> = {
  plakat: 'plakat.png',
  delta: 'delta.png',
  halfmoon: 'halfmoon.png',
  crowntail: 'crowntail.png',
  rosetail: 'rosetail.png',
  veiltail: 'veiltail.png',
  doubletail: 'doubletail.png',
}

const HIDDEN_TAIL: TailPresetKey[] = ['delta', 'halfmoon']

const TANK_ITEMS = (Object.keys(TANK_MODELS) as TankModelKey[]).map(key => ({
  key,
  icon: `${BASE}${TANK_ICONS[key]}`,
  label: TANK_MODELS[key].label,
}))

const TAIL_ITEMS = (Object.keys(TAIL_PRESETS) as TailPresetKey[])
  .filter(k => !HIDDEN_TAIL.includes(k))
  .map(key => ({
    key,
    icon: `${BASE}icon/${TAIL_ICONS[key]}`,
    label: TAIL_PRESETS[key].label,
  }))

const OPTION_SIZE = 46

function gameBarMessage(phase: GamePhase, winner: Cell, isDraw: boolean): string | null {
  switch (phase) {
    case 'animating':
      return 'DRAWING GRID...'
    case 'userTurn':
      return 'YOUR TURN'
    case 'bettaMoving':
      return "BETTA'S TURN"
    case 'ended':
      if (isDraw) return 'DRAW'
      if (winner === 'O') return 'YOU WIN'
      if (winner === 'X') return 'FISH WINS'
      return null
    default:
      return null
  }
}

function BarOptionButton({
  icon,
  label,
  selected,
  onSelect,
}: {
  icon: string
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onSelect}
      style={{
        position: 'relative',
        width: OPTION_SIZE,
        height: OPTION_SIZE,
        flexShrink: 0,
        borderRadius: '50%',
        border: 'none',
        backgroundColor: selected ? 'rgba(150, 222, 245, 1)' : 'rgba(224, 224, 224, 1)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        overflow: 'hidden',
        boxShadow: '1px 1px 0px 0px rgba(255, 255, 255, 1), 0px -1px 0px 0px rgba(0, 0, 0, 0.2)',
      }}
    >
      <GlossyHighlight variant="circle" theme="fafafa" />
      <GlossyGlow variant="circle" theme="fafafa" />
      <img
        src={icon}
        alt=""
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
          filter: selected ? 'none' : 'grayscale(0.3) opacity(0.85)',
        }}
      />
    </button>
  )
}

export type GridBarPanel = 'tank' | 'fish' | null

interface GridBarProps {
  openPanel: GridBarPanel
  gameActive: boolean
  gamePhase: GamePhase
  winner: Cell
  isDraw: boolean
  tankModel: TankModelKey
  tailPreset: TailPresetKey
  onTankSelect: (key: TankModelKey) => void
  onTailSelect: (key: TailPresetKey) => void
}

export default function GridBar({
  openPanel,
  gameActive,
  gamePhase,
  winner,
  isDraw,
  tankModel,
  tailPreset,
  onTankSelect,
  onTailSelect,
}: GridBarProps) {
  const statusText = gameActive ? gameBarMessage(gamePhase, winner, isDraw) : null

  return (
    <div
      style={{
        width: '100%',
        height: 80,
        flexShrink: 0,
        ...GRID_BAR_SURFACE,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 12px',
      }}
    >
      {statusText ? (
        <div
          style={{
            fontFamily: FONT,
            fontSize: 18,
            fontWeight: 600,
            color: 'rgba(34, 34, 51, 1)',
            letterSpacing: '-0.02em',
            textAlign: 'center',
          }}
        >
          {statusText}
        </div>
      ) : openPanel === 'tank' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            width: '100%',
            overflowX: 'auto',
          }}
        >
          {TANK_ITEMS.map(item => (
            <BarOptionButton
              key={item.key}
              icon={item.icon}
              label={item.label}
              selected={tankModel === item.key}
              onSelect={() => onTankSelect(item.key)}
            />
          ))}
        </div>
      ) : openPanel === 'fish' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            width: '100%',
            overflowX: 'auto',
          }}
        >
          {TAIL_ITEMS.map(item => (
            <BarOptionButton
              key={item.key}
              icon={item.icon}
              label={item.label}
              selected={tailPreset === item.key}
              onSelect={() => onTailSelect(item.key)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
