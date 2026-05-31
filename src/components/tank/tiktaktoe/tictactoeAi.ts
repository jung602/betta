export type Cell = '' | 'O' | 'X'
export type Board = Cell[]

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export function checkWinner(board: Board): Cell {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]
    }
  }
  return ''
}

export function isBoardFull(board: Board): boolean {
  return board.every((c) => c !== '')
}

export function getEmptyCells(board: Board): number[] {
  return board.map((c, i) => (c === '' ? i : -1)).filter((i) => i >= 0)
}

function minimax(board: Board, isMax: boolean): number {
  const winner = checkWinner(board)
  if (winner === 'X') return 1
  if (winner === 'O') return -1
  if (isBoardFull(board)) return 0

  const empty = getEmptyCells(board)
  if (isMax) {
    let best = -Infinity
    for (const i of empty) {
      board[i] = 'X'
      best = Math.max(best, minimax(board, false))
      board[i] = ''
    }
    return best
  }
  let best = Infinity
  for (const i of empty) {
    board[i] = 'O'
    best = Math.min(best, minimax(board, true))
    board[i] = ''
  }
  return best
}

export function pickBestMove(board: Board): number {
  const empty = getEmptyCells(board)
  if (empty.length === 0) return -1

  let bestScore = -Infinity
  let bestMove = empty[0]
  for (const i of empty) {
    board[i] = 'X'
    const score = minimax(board, false)
    board[i] = ''
    if (score > bestScore) {
      bestScore = score
      bestMove = i
    }
  }
  return bestMove
}
