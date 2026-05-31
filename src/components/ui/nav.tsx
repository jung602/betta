import { useId } from 'react'
import { GlossyGlow, GlossyHighlight, glossyStyles } from './glossySurface'
import type { GridBarPanel } from './gridBar'

const FONT =
  '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif'

const BASE = import.meta.env.BASE_URL

interface NavProps {
  gameActive: boolean
  openPanel: GridBarPanel
  onTogglePanel: (panel: 'tank' | 'fish') => void
  canStartGame: boolean
  onStartGame: () => void
  onEndGame: () => void
}

const SIDE_SLOT_WIDTH = 64
/** 가운데 글로시 원형 버튼 크기 */
const NAV_BUTTON_SIZE = 64
/** PLAY 버튼 폭 */
const PLAY_WIDTH = 200

const GLOSSY_BLUE = glossyStyles('blue')

function NavSideSpacer() {
  return <div style={{ width: SIDE_SLOT_WIDTH, flexShrink: 0 }} aria-hidden />
}

/** 원형 버튼 아래쪽을 따라 휘는 라벨 */
function CurvedCircleLabel({ label }: { label: string }) {
  const pathId = useId()
  const pathD = 'M 10 64 Q 40 84 70 64'

  return (
    <svg
      width={NAV_BUTTON_SIZE}
      height={NAV_BUTTON_SIZE}
      viewBox="0 0 80 80"
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 3,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <defs>
        <path id={pathId} d={pathD} fill="none" />
      </defs>
      <text
        fill="#fff"
        fontSize={10}
        fontFamily={FONT}
        fontWeight={600}
        letterSpacing="1.4px"
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {label}
        </textPath>
      </text>
    </svg>
  )
}

function SideButton({
  label,
  iconSrc,
  active,
  onToggle,
}: {
  label: string
  iconSrc: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: NAV_BUTTON_SIZE,
        height: NAV_BUTTON_SIZE,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        aria-pressed={active}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          padding: 0,
          border: GLOSSY_BLUE.border,
          background: GLOSSY_BLUE.bg,
          color: 'rgba(34, 34, 51, 1)',
          borderRadius: '50%',
          overflow: 'hidden',
          cursor: 'pointer',
          opacity: active ? 1 : 0.92,
          boxShadow:
            '-1px -1px 1px 0px rgba(0, 0, 0, 0.2), 1px 1px 0px 0px rgba(255, 255, 255, 1)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <GlossyHighlight variant="circle" theme="blue" />
        <GlossyGlow variant="circle" theme="blue" />
        <img
          src={iconSrc}
          alt=""
          style={{
            position: 'absolute',
            zIndex: 2,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 32,
            height: 32,
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      </button>

      <CurvedCircleLabel label={label} />
    </div>
  )
}

function PlayButton({
  label,
  onClick,
  disabled = false,
}: {
  label: 'PLAY' | 'END'
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        position: 'relative',
        width: PLAY_WIDTH,
        maxWidth: '46vw',
        height: SIDE_SLOT_WIDTH,
        flexShrink: 0,
        padding: '12px 24px',
        background: GLOSSY_BLUE.bg,
        color: 'rgba(34, 34, 51, 1)',
        border: GLOSSY_BLUE.border,
        borderRadius: 100,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        boxShadow:
          '1px 1px 0px 0px rgba(255, 255, 255, 1), -1px -1px 0px 0px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
      }}
    >
      <GlossyHighlight variant="pill" theme="blue" />
      <GlossyGlow variant="pill" theme="blue" />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 16,
          fontFamily: FONT,
          fontWeight: 600,
          color: '#fff',
          textShadow: '-1px -1px 0px rgba(0, 0, 0, 0.1), 1px 1px 10px #A2ADB8',
        }}
      >
        {label}
      </div>
    </button>
  )
}

export default function Nav({
  gameActive,
  openPanel,
  onTogglePanel,
  canStartGame,
  onStartGame,
  onEndGame,
}: NavProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        flexShrink: 0,
      }}
    >
      {gameActive ? (
        <NavSideSpacer />
      ) : (
        <SideButton
          label="TANK"
          iconSrc={`${BASE}icon/tank.png`}
          active={openPanel === 'tank'}
          onToggle={() => onTogglePanel('tank')}
        />
      )}

      <PlayButton
        label={gameActive ? 'END' : 'PLAY'}
        onClick={gameActive ? onEndGame : onStartGame}
        disabled={!gameActive && !canStartGame}
      />

      {gameActive ? (
        <NavSideSpacer />
      ) : (
        <SideButton
          label="FISH"
          iconSrc={`${BASE}icon/fish.png`}
          active={openPanel === 'fish'}
          onToggle={() => onTogglePanel('fish')}
        />
      )}
    </div>
  )
}
