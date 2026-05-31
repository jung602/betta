import type { GamePhase } from './useTictactoeGame'

interface TictactoeOverlayProps {
  phase: GamePhase
  statusMessage: string
  onStart: () => void
  onReset: () => void
}

export default function TictactoeOverlay({
  phase,
  statusMessage,
  onStart,
  onReset,
}: TictactoeOverlayProps) {
  const showStart = phase === 'idle'
  const showRestart = phase === 'ended'

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 48,
        gap: 16,
      }}
    >
      <p
        style={{
          margin: 0,
          padding: '10px 20px',
          borderRadius: 20,
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif',
          fontSize: 14,
          fontWeight: 500,
          color: '#334',
          boxShadow: '0 2px 12px rgba(100,160,255,0.15)',
        }}
      >
        {statusMessage}
      </p>

      {(showStart || showRestart) && (
        <button
          type="button"
          onClick={showRestart ? onReset : onStart}
          style={{
            pointerEvents: 'auto',
            padding: '12px 28px',
            fontSize: 14,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, sans-serif',
            fontWeight: 600,
            background: 'rgba(255,255,255,0.75)',
            color: '#223',
            border: '1.5px solid rgba(100,160,255,0.45)',
            borderRadius: 24,
            cursor: 'pointer',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 4px 16px rgba(100,160,255,0.2)',
          }}
        >
          {showRestart ? '다시하기' : '게임 시작'}
        </button>
      )}
    </div>
  )
}
