const state = getState();
const history = getHistory();
const myId = getPlayerId();

const oppId = myId === "p1" ? "p2" : "p1";

// Helper to get opponent's moves from history
const getOpponentMoves = () => {
    return history.map(h => oppId === "p1" ? h.p1Move : h.p2Move).filter(Boolean);
};

// ─── 1. NIM SUBTRACTION ──────────────────────────────────────────────────────
if (state.objectsRemaining !== undefined) {
    const rem = state.objectsRemaining;
    if (rem <= 3) return rem === 1 ? 1 : rem - 1;

    // Track if opponent has any predictable choices
    const oppMoves = getOpponentMoves();
    const counts = { 1: 0, 2: 0, 3: 0 };
    oppMoves.forEach(m => { if (counts[m] !== undefined) counts[m]++; });

    // If opponent favors taking 1, we can play accordingly
    const favoriteOppMove = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);

    // Math logic fallback
    const targetMod = rem % 4;
    if (targetMod === 0) return 3;
    if (targetMod === 3) return 2;
    if (targetMod === 2) return 1;
    return 1;
}

// ─── 2. TIC-TAC-TOE ──────────────────────────────────────────────────────────
if (state.board !== undefined) {
    const board = state.board;
    const mySymbol = myId === "p1" ? "X" : "O";
    const oppSymbol = mySymbol === "X" ? "O" : "X";

    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

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

    // Immediate moves
    const winCell = findCompletingCell(mySymbol);
    if (winCell !== null) return winCell;

    const blockCell = findCompletingCell(oppSymbol);
    if (blockCell !== null) return blockCell;

    // Corner traps / predictive blocks
    if (board[4] === null) return 4;

    const corners = [0, 2, 6, 8];
    const emptyCorners = corners.filter(c => board[c] === null);
    if (emptyCorners.length > 0) {
        return emptyCorners[Math.floor(Math.random() * emptyCorners.length)];
    }

    const emptySides = [1, 3, 5, 7].filter(s => board[s] === null);
    return emptySides.length > 0 ? emptySides[0] : 0;
}

// ─── 3. ROCK-PAPER-SCISSORS ──────────────────────────────────────────────────
if (state.round !== undefined) {
    const oppMoves = getOpponentMoves();

    if (oppMoves.length < 2) {
        // Too early for pattern analysis, play rock/paper/scissors randomly
        const moves = ["R", "P", "S"];
        return moves[Math.floor(Math.random() * 3)];
    }

    // Build transition matrix: what does opponent play after move X?
    const transitions = {
        R: { R: 0, P: 0, S: 0 },
        P: { R: 0, P: 0, S: 0 },
        S: { R: 0, P: 0, S: 0 }
    };

    for (let i = 0; i < oppMoves.length - 1; i++) {
        const current = oppMoves[i];
        const next = oppMoves[i + 1];
        if (transitions[current] && transitions[current][next] !== undefined) {
            transitions[current][next]++;
        }
    }

    // Get opponent's very last move
    const lastOppMove = oppMoves[oppMoves.length - 1];
    const nextProbabilities = transitions[lastOppMove];

    // Find predicted next move based on transition history
    let predictedOppMove = "R";
    let maxCount = -1;
    ["R", "P", "S"].forEach(m => {
        if (nextProbabilities[m] > maxCount) {
            maxCount = nextProbabilities[m];
            predictedOppMove = m;
        }
    });

    // If no transitions recorded yet, fall back to global move frequency
    if (maxCount === 0) {
        const frequencies = { R: 0, P: 0, S: 0 };
        oppMoves.forEach(m => { frequencies[m]++; });
        predictedOppMove = Object.keys(frequencies).reduce((a, b) => frequencies[a] > frequencies[b] ? a : b);
    }

    // Counter the predicted move:
    // - If opponent plays Rock (R), play Paper (P)
    // - If opponent plays Paper (P), play Scissors (S)
    // - If opponent plays Scissors (S), play Rock (R)
    const counterMoves = { R: "P", P: "S", S: "R" };
    const counter = counterMoves[predictedOppMove] || "R";

    // Dynamic Adaptation check: did we lose the last round?
    const lastRound = history[history.length - 1];
    const lastWinner = lastRound.stateAfter?.winner || lastRound.winner;

    if (lastWinner === oppId) {
        // If we lost last round, opponent might repeat or expect us to counter. 
        // Bluff: Counter the counter of their predicted move (anticipate they anticipate us)
        const bluffCounter = { R: "S", P: "R", S: "P" };
        return bluffCounter[predictedOppMove];
    }

    return counter;
}

return "R"; // Fallback