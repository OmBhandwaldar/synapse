/**
 * ============================================================
 * SKILL: Markov Chain Opponent Predictor
 * Game:  Rock Paper Scissors (rps)
 * Type:  Prediction
 * ============================================================
 *
 * WHAT THIS SKILL DOES:
 * Watches the opponent's move sequence across the whole match.
 * It builds a "transition table" — how often does the opponent
 * go from Rock → Paper? From Scissors → Rock? etc.
 * Then it predicts the MOST LIKELY next move and plays the
 * counter to it.
 *
 * WHY IT'S VALUABLE:
 * Most players (and basic bots) have patterns they don't notice.
 * This skill exploits those patterns statistically. The longer
 * the match, the sharper it gets. First round is a cold-start guess,
 * by round 3 it has real data.
 *
 * RARITY: Rare — max 50 copies
 * PRICE:  1.5 ALGO
 * CREATOR EARNS: 1.425 ALGO per sale (95% after 5% platform fee)
 * ============================================================
 */

const state   = getState();    // { round, p1Score, p2Score }
const history = getHistory();  // [ { turnNumber, p1Move, p2Move, stateAfter, logMessages } ]
const me      = getPlayerId(); // "p1" or "p2"

// ── 1. Pull out opponent's move sequence from history ───────────────────────
const oppKey = me === "p1" ? "p2Move" : "p1Move";
const oppMoves = history.map(h => h[oppKey]).filter(Boolean); // e.g. ["R","R","P","S"]

// ── 2. Build a transition frequency table ───────────────────────────────────
// transitions["R"]["P"] = how many times opponent went R → P
const transitions = {};
for (const move of ["R","P","S"]) {
  transitions[move] = { R: 0, P: 0, S: 0 };
}

for (let i = 0; i < oppMoves.length - 1; i++) {
  const from = oppMoves[i];
  const to   = oppMoves[i + 1];
  if (transitions[from] && transitions[from][to] !== undefined) {
    transitions[from][to]++;
  }
}

// ── 3. Predict next opponent move ────────────────────────────────────────────
const lastOppMove = oppMoves[oppMoves.length - 1];

let predictedMove = null;

if (lastOppMove && oppMoves.length >= 2) {
  const counts = transitions[lastOppMove];
  const total  = counts.R + counts.P + counts.S;

  if (total > 0) {
    // Pick the opponent's statistically most likely next move
    predictedMove = ["R","P","S"].reduce((best, m) =>
      counts[m] > counts[best] ? m : best
    , "R");
  }
}

// ── 4. Play the counter ──────────────────────────────────────────────────────
const counter = { R: "P", P: "S", S: "R" };

if (predictedMove) {
  console.log(`[Markov] Opponent last played ${lastOppMove}. Predicting ${predictedMove}. Playing counter: ${counter[predictedMove]}`);
  return counter[predictedMove];
}

// Cold start: not enough data yet — play randomly
const coldStart = ["R","P","S"][Math.floor(Math.random() * 3)];
console.log(`[Markov] Not enough data yet. Cold-start: ${coldStart}`);
return coldStart;
