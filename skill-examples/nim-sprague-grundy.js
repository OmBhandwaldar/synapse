/**
 * ============================================================
 * SKILL: Sprague-Grundy Oracle
 * Game:  Nim (nim)
 * Type:  Compute
 * ============================================================
 *
 * WHAT THIS SKILL DOES:
 * Implements the mathematically PROVEN optimal strategy for Nim
 * using the Sprague-Grundy theorem from combinatorial game theory.
 *
 * The game: 21 objects remaining. Each turn, take 1, 2, or 3.
 * The player FORCED to take the last object LOSES.
 *
 * THE MATH:
 * In this variant (max take = 3), positions that are multiples
 * of 4 are "losing positions" for the player whose turn it is.
 * The winning move is always to reduce to the nearest multiple of 4.
 * If you're already at a multiple of 4, you're in a losing position
 * — the opponent has the advantage regardless. Take 1 and hope
 * they make a mistake.
 *
 * WHY IT'S VALUABLE:
 * Against any non-optimal opponent, this skill WILL win from a
 * winning position — every single time. No randomness.
 * It's provably optimal. That's a real competitive edge.
 *
 * RARITY: Legendary — max 10 copies ever minted
 * PRICE:  5 ALGO
 * CREATOR EARNS: 4.75 ALGO per sale (95% after platform fee)
 * ============================================================
 */

const state = getState(); // { objectsRemaining: number, turn: "p1"|"p2" }
const remaining = state.objectsRemaining;

// ── Sprague-Grundy optimal move calculation ──────────────────────────────────
// In Nim with max-take = 3, cycle length = 4.
// Losing positions (for the player to move): 1, 5, 9, 13, 17, 21 → multiples of 4, plus 1
// Target: leave opponent at a position ≡ 1 (mod 4)

const mod = (remaining - 1) % 4; // how far above a "losing-for-opponent" position we are

let optimalMove;

if (mod === 0) {
  // We're already in a losing position — opponent has the advantage.
  // Best we can do is stay in game and hope for opponent error.
  // Take 1 as a default — don't give away more than we have to.
  optimalMove = 1;
  console.log(`[Sprague-Grundy] BAD POSITION (${remaining} remaining). Forced to take 1. Opponent has the advantage.`);
} else {
  // Winning position — take exactly 'mod' to leave opponent in a losing position
  optimalMove = mod;
  const willLeave = remaining - optimalMove;
  console.log(`[Sprague-Grundy] WINNING POSITION. Taking ${optimalMove} to leave opponent with ${willLeave} (a losing position).`);
}

// Safety clamp — never take more than is available (shouldn't happen but safety first)
return Math.min(optimalMove, Math.min(remaining, 3));
