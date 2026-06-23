const state = getState();
const history = getHistory();
const myId = getPlayerId();

const oppId = myId === "p1" ? "p2" : "p1";

// ─── 1. NIM SUBTRACTION ──────────────────────────────────────────────────────
if (state.objectsRemaining !== undefined) {
  const rem = state.objectsRemaining;
  if (rem <= 3) {
    // If 1 object is remaining, we are forced to take it (loss). Take 1.
    // If 2, take 1 to leave 1 (win).
    // If 3, take 2 to leave 1 (win).
    return rem === 1 ? 1 : rem - 1;
  }
  // Optimal formula: we want (rem - take) % 4 === 1
  const targetMod = rem % 4;
  if (targetMod === 0) return 3; // 4 - 3 = 1 mod 4
  if (targetMod === 3) return 2; // 3 - 2 = 1 mod 4
  if (targetMod === 2) return 1; // 2 - 1 = 1 mod 4
  // If already at 1 mod 4, we are in a losing position; take 1 and hope for opponent mistake
  return 1;
}

// ─── 2. TIC-TAC-TOE ──────────────────────────────────────────────────────────
if (state.board !== undefined) {
  const board = state.board;
  const mySymbol = myId === "p1" ? "X" : "O";
  const oppSymbol = mySymbol === "X" ? "O" : "X";

  const winPatterns = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];

  // Helper to find cells that complete a pattern
  const findCompletingCell = (symbol) => {
    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      const cells = [board[a], board[b], board[c]];
      const symCount = cells.filter(cell => cell === symbol).length;
      const nullCount = cells.filter(cell => cell === null).length;
      if (symCount === 2 && nullCount === 1) {
        if (board[a] === null) return a;
        if (board[b] === null) return b;
        if (board[c] === null) return c;
      }
    }
    return null;
  };

  // Rule A: Can I win immediately?
  const winCell = findCompletingCell(mySymbol);
  if (winCell !== null) return winCell;

  // Rule B: Can I block opponent's immediate win?
  const blockCell = findCompletingCell(oppSymbol);
  if (blockCell !== null) return blockCell;

  // Rule C: Play Center
  if (board[4] === null) return 4;

  // Rule D: Play Corner
  const corners = [0, 2, 6, 8];
  const emptyCorners = corners.filter(c => board[c] === null);
  if (emptyCorners.length > 0) {
    return emptyCorners[Math.floor(Math.random() * emptyCorners.length)];
  }

  // Rule E: Play Random Side
  const emptySides = [1, 3, 5, 7].filter(s => board[s] === null);
  return emptySides.length > 0 ? emptySides[0] : 0;
}

// ─── 3. ROCK-PAPER-SCISSORS ──────────────────────────────────────────────────
if (state.round !== undefined) {
  // If no history, play random
  if (history.length === 0) {
    const moves = ["R", "P", "S"];
    return moves[Math.floor(Math.random() * 3)];
  }
  // Counter the opponent's last thrown move (with 60% probability, otherwise random)
  const lastRound = history[history.length - 1];
  const lastOppMove = oppId === "p1" ? lastRound.p1Move : lastRound.p2Move;

  if (Math.random() < 0.6 && lastOppMove) {
    if (lastOppMove === "R") return "P"; // Paper beats Rock
    if (lastOppMove === "P") return "S"; // Scissors beats Paper
    return "R"; // Rock beats Scissors
  }

  const moves = ["R", "P", "S"];
  return moves[Math.floor(Math.random() * 3)];
}

return "R"; // Fallback