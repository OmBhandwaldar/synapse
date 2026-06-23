import { GameEngine } from "../engine/types";

export type Cell = "X" | "O" | null;
export interface TicTacToeState {
  board: Cell[]; // 9 length array
  turn: "X" | "O";
}

export type TicTacToeMove = number; // Index 0-8

export const tictactoeEngine: GameEngine<TicTacToeState, TicTacToeMove> = {
  name: "Tic-Tac-Toe",
  id: "tictactoe",
  getInitialState: () => ({ board: Array(9).fill(null), turn: "X" }),
  
  validateMove: (state, move, playerId) => {
    const num = Number(move);
    if (!isNaN(num) && num >= 0 && num <= 8 && state.board[num] === null) {
      return num;
    }
    // Invalid move -> randomly pick an empty cell
    const emptyCells = state.board.map((v, i) => v === null ? i : null).filter(v => v !== null) as number[];
    if (emptyCells.length === 0) return 0; // fallback but shouldn't happen
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  },
  
  computeNextState: (state, p1Move, p2Move) => {
    // Note: TIC-TAC-TOE is sequential, so p1 moves, then p2 moves. 
    // In our synchronous multi-turn engine, if it's P1's turn (X), we only care about p1Move.
    // If it's P2's turn (O), we only care about p2Move.
    
    const newBoard = [...state.board];
    const currentPlayer = state.turn;
    
    let activePlayerStr: "p1" | "p2" = currentPlayer === "X" ? "p1" : "p2";
    const move = currentPlayer === "X" ? p1Move : p2Move;
    
    newBoard[move] = currentPlayer;

    // Check win
    const winPatterns = [
      [0,1,2], [3,4,5], [6,7,8], // rows
      [0,3,6], [1,4,7], [2,5,8], // cols
      [0,4,8], [2,4,6] // diags
    ];

    let isWin = false;
    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
        isWin = true;
        break;
      }
    }

    if (isWin) {
      return {
        nextState: { board: newBoard, turn: currentPlayer === "X" ? "O" : "X" },
        winner: activePlayerStr,
        reason: `${activePlayerStr.toUpperCase()} connected 3 in a row.`
      };
    }

    // Check draw
    if (newBoard.every(cell => cell !== null)) {
      return {
        nextState: { board: newBoard, turn: currentPlayer === "X" ? "O" : "X" },
        winner: "draw",
        reason: "Board full."
      };
    }

    return {
      nextState: { board: newBoard, turn: currentPlayer === "X" ? "O" : "X" },
      winner: null
    };
  }
};
