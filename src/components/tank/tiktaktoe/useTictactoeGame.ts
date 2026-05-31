import { useState, useCallback } from 'react'
import type { Board, Cell } from './tictactoeAi'
import { checkWinner, isBoardFull, pickBestMove } from './tictactoeAi'
import { createRandomGridLayout, type GridLayout } from './gridLayout'

export type GamePhase =
  | 'idle'
  | 'animating'
  | 'userTurn'
  | 'bettaMoving'
  | 'ended'

const EMPTY_BOARD: Board = ['', '', '', '', '', '', '', '', '']

export function useTictactoeGame(
  planeWidth: number,
  planeHeight: number,
  fishVisualScale: number,
  reachX = 0,
  reachY = 0,
) {
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [board, setBoard] = useState<Board>([...EMPTY_BOARD])
  const [gridLayout, setGridLayout] = useState<GridLayout | null>(null)
  const [winner, setWinner] = useState<Cell>('')
  const [isDraw, setIsDraw] = useState(false)
  const [bettaTargetCell, setBettaTargetCell] = useState<number | null>(null)

  const statusMessage =
    phase === 'idle'
      ? '게임 시작 버튼을 눌러주세요'
      : phase === 'animating'
        ? '격자를 그리는 중...'
        : phase === 'userTurn'
          ? 'O를 그려주세요'
          : phase === 'bettaMoving'
            ? '베타가 이동 중...'
            : isDraw
              ? '무승부!'
              : winner === 'O'
                ? '승리! 🎉'
                : winner === 'X'
                  ? '베타 승리...'
                  : ''

  const endGame = useCallback((win: Cell, draw: boolean) => {
    setWinner(win)
    setIsDraw(draw)
    setPhase('ended')
    setBettaTargetCell(null)
  }, [])

  const startGame = useCallback(() => {
    if (planeWidth <= 0 || planeHeight <= 0) return
    const layout = createRandomGridLayout(
      planeWidth,
      planeHeight,
      fishVisualScale,
      reachX > 0 && reachY > 0 ? { x: reachX, y: reachY } : undefined,
    )
    setBoard([...EMPTY_BOARD])
    setWinner('')
    setIsDraw(false)
    setBettaTargetCell(null)
    setGridLayout(layout)
    setPhase('animating')
  }, [planeWidth, planeHeight, fishVisualScale, reachX, reachY])

  const onGridAnimationComplete = useCallback(() => {
    setPhase('userTurn')
  }, [])

  const placeO = useCallback(
    (cellIndex: number) => {
      if (phase !== 'userTurn' || cellIndex < 0 || board[cellIndex] !== '') return false

      const next: Board = [...board]
      next[cellIndex] = 'O'
      setBoard(next)

      const win = checkWinner(next)
      if (win) {
        endGame(win, false)
        return true
      }
      if (isBoardFull(next)) {
        endGame('', true)
        return true
      }

      const aiCell = pickBestMove(next)
      if (aiCell < 0) {
        endGame('', true)
        return true
      }

      setBettaTargetCell(aiCell)
      setPhase('bettaMoving')
      return true
    },
    [phase, board, endGame],
  )

  const completeBettaMove = useCallback(() => {
    if (bettaTargetCell === null) return

    const next: Board = [...board]
    next[bettaTargetCell] = 'X'
    setBoard(next)
    setBettaTargetCell(null)

    const win = checkWinner(next)
    if (win) {
      endGame(win, false)
      return
    }
    if (isBoardFull(next)) {
      endGame('', true)
      return
    }
    setPhase('userTurn')
  }, [bettaTargetCell, board, endGame])

  const resetToIdle = useCallback(() => {
    setPhase('idle')
    setBoard([...EMPTY_BOARD])
    setGridLayout(null)
    setWinner('')
    setIsDraw(false)
    setBettaTargetCell(null)
  }, [])

  return {
    phase,
    board,
    gridLayout,
    winner,
    isDraw,
    bettaTargetCell,
    statusMessage,
    startGame,
    onGridAnimationComplete,
    placeO,
    completeBettaMove,
    resetToIdle,
  }
}
