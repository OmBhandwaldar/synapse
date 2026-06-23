/**
 * ============================================================
 * SKILL: Minimax Perfect Player
 * Game:  Tic-Tac-Toe (tictactoe)
 * Type:  Strategy
 * ============================================================
 *
 * WHAT THIS SKILL DOES:
 * Runs a full minimax game-tree search before every single move.
 * It evaluates EVERY possible future game state, all the way to
 * the end, and picks the move with the best guaranteed outcome.
 *
 * Against a random or naive agent: IT NEVER LOSES.
 * Against another Minimax agent: it always draws (the mathematical
 * result of perfect TicTacToe play between two optimal agents).
 *
 * WHY IT'S VALUABLE:
 * This is the hardest possible TicTacToe opponent. If you equip
 * this skill, your agent is unbeatable unless the opponent also
 * has Minimax. In a competitive arena, that's a huge edge.
 *
 * RARITY: Legendary — max 10 copies ever minted
 * PRICE:  5 ALGO
 * CREATOR EARNS: 4.75 ALGO per sale
 * ============================================================
 */

const state = getState(); // { board: (null|"X"|"O")[], turn: "X"|"O" }
const me    = getPlayerId(); // "p1" or "p2"

const mySymbol  = me === "p1" ? "X" : "O";
const oppSymbol = me === "p1" ? "O" : "X";

// ── Helper: check if a player has won on a given board ───────────────────────
function checkWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8], // rows
    [0,3,6],[1,4,7],[2,5,8], // cols
    [0,4,8],[2,4,6]          // diagonals
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(cell => cell !== null)) return "draw";
  return null;
}

// ── Minimax: recursively scores every possible board state ───────────────────
function minimax(board, isMaximizing, depth) {
  const result = checkWinner(board);
  if (result === mySymbol)  return 10 - depth; // I win — prefer faster wins
  if (result === oppSymbol) return depth - 10; // Opp wins — prefer slower losses
  if (result === "draw")    return 0;

  const emptyCells = board.map((v,i) => v === null ? i : -1).filter(i => i >= 0);

  if (isMaximizing) {
    let best = -Infinity;
    for (const cell of emptyCells) {
      const next = [...board];
      next[cell] = mySymbol;
      best = Math.max(best, minimax(next, false, depth + 1));
    }
    return best;
  } else {
    let best = Infinity;
    for (const cell of emptyCells) {
      const next = [...board];
      next[cell] = oppSymbol;
      best = Math.min(best, minimax(next, true, depth + 1));
    }
    return best;
  }
}

// ── Find the best move ────────────────────────────────────────────────────────
const board      = state.board; // 9-element array: null | "X" | "O"
const emptyCells = board.map((v,i) => v === null ? i : -1).filter(i => i >= 0);

let bestScore = -Infinity;
let bestCell  = emptyCells[0]; // fallback

for (const cell of emptyCells) {
  const next  = [...board];
  next[cell]  = mySymbol;
  const score = minimax(next, false, 0);
  if (score > bestScore) {
    bestScore = score;
    bestCell  = cell;
  }
}

console.log(`[Minimax] Evaluated ${emptyCells.length} moves. Best cell: ${bestCell} (score: ${bestScore})`);
return bestCell;
