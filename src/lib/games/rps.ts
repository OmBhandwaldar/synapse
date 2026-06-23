import { GameEngine } from "../engine/types";

export interface RPSState {
  round: number;
  p1Score: number;
  p2Score: number;
}

export type RPSMove = "R" | "P" | "S";

export const rpsEngine: GameEngine<RPSState, RPSMove> = {
  name: "Rock Paper Scissors",
  id: "rps",
  getInitialState: () => ({ round: 1, p1Score: 0, p2Score: 0 }),
  validateMove: (state, move, playerId) => {
    if (move === "R" || move === "P" || move === "S") return move;
    // Default fallback if invalid
    const random = Math.random();
    if (random < 0.33) return "R";
    if (random < 0.66) return "P";
    return "S";
  },
  computeNextState: (state, p1Move, p2Move) => {
    let nextP1Score = state.p1Score || 0;
    let nextP2Score = state.p2Score || 0;
    let winner: "p1" | "p2" | "draw" | null = null;
    let reason = "";

    if (p1Move === p2Move) {
      reason = `Round ${state.round}: Both chose ${p1Move}. Round drawn.`;
    } else {
      const p1Wins = 
        (p1Move === "R" && p2Move === "S") ||
        (p1Move === "P" && p2Move === "R") ||
        (p1Move === "S" && p2Move === "P");

      if (p1Wins) {
        nextP1Score++;
        reason = `Round ${state.round}: ${p1Move} beats ${p2Move}. P1 wins round.`;
      } else {
        nextP2Score++;
        reason = `Round ${state.round}: ${p2Move} beats ${p1Move}. P2 wins round.`;
      }
    }

    const nextRound = state.round + 1;
    const maxRounds = 3;

    // Check if someone reached 2 wins, or if we finished 3 rounds
    if (nextP1Score >= 2) {
      winner = "p1";
      reason += ` P1 wins the match (${nextP1Score}-${nextP2Score})!`;
    } else if (nextP2Score >= 2) {
      winner = "p2";
      reason += ` P2 wins the match (${nextP2Score}-${nextP1Score})!`;
    } else if (nextRound > maxRounds) {
      if (nextP1Score === nextP2Score) {
        winner = "draw";
        reason += ` Match drawn after 3 rounds (${nextP1Score}-${nextP2Score}).`;
      } else {
        winner = nextP1Score > nextP2Score ? "p1" : "p2";
        reason += ` Match over. ${winner.toUpperCase()} wins (${nextP1Score}-${nextP2Score}).`;
      }
    }

    return {
      nextState: {
        round: nextRound,
        p1Score: nextP1Score,
        p2Score: nextP2Score
      },
      winner,
      reason
    };
  }
};
