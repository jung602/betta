import type { GamePhase } from '../tank/tiktaktoe/useTictactoeGame'
import type { Cell } from '../tank/tiktaktoe/tictactoeAi'

const BASE = import.meta.env.BASE_URL

export type GameResult = 'win' | 'lose' | 'draw'

export function gameResult(phase: GamePhase, winner: Cell, isDraw: boolean): GameResult | null {
  if (phase !== 'ended') return null
  if (isDraw) return 'draw'
  if (winner === 'O') return 'win'
  if (winner === 'X') return 'lose'
  return null
}

const RESULT_IMAGES: Record<GameResult, string> = {
  win: `${BASE}win.png`,
  lose: `${BASE}lose.png`,
  draw: `${BASE}draw.png`,
}

/** 게임 종료 시 승/패/무 이미지가 3D 캔버스 위로 통통 튀며 떠오르는 오버레이 */
export default function CanvasResultOverlay({ result }: { result: GameResult }) {
  return (
    <>
      <style>{`
        @keyframes canvasResultPop {
          0%   { transform: scale(0.2); opacity: 0; }
          55%  { transform: scale(1.12); opacity: 1; }
          75%  { transform: scale(0.96); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <img
          key={result}
          src={RESULT_IMAGES[result]}
          alt={result}
          style={{
            width: '55%',
            maxWidth: 360,
            height: 'auto',
            objectFit: 'contain',
            transformOrigin: 'center',
            filter: 'drop-shadow(0 6px 18px rgba(0, 0, 0, 0.25))',
            animation: 'canvasResultPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        />
      </div>
    </>
  )
}
