export { default as TictactoeOverlay } from './TictactoeOverlay'
export { useTictactoeGame, type GamePhase, type GameState } from './useTictactoeGame'
export {
  createRandomGridLayout,
  strokeToCell,
  isClosedStroke,
  uvToCellIndex,
  type GridLayout,
  type CellBounds,
} from './gridLayout'
export {
  animateGridDraw,
  animateMarkX,
  drawFullBoard,
  getGridLines,
  type TraceDrawAPI,
  type OStrokeMap,
} from './gridDrawing'
export { pickBestMove, checkWinner, type Board, type Cell } from './tictactoeAi'
