import { GameEngine } from "../engine/types";

export interface NimState {
  objectsRemaining: number;
  turn: "p1" | "p2";
}

export type NimMove = 1 | 2 | 3;

export const nimEngine: GameEngine<NimState, NimMove> = {
  name: "Nim Subtraction",
  id: "nim",
  getInitialState: () => ({ objectsRemaining: 21, turn: "p1" }),
  
  validateMove: (state, move, playerId) => {
    const num = Number(move);
    if (!isNaN(num) && (num === 1 || num === 2 || num === 3)) {
      return Math.min(num, state.objectsRemaining) as NimMove;
    }
    // Invalid move -> fallback to 1
    return 1;
  },
  
  computeNextState: (state, p1Move, p2Move) => {
    // Nim is sequential
    const currentPlayer = state.turn;
    const activePlayerStr = currentPlayer;
    const move = currentPlayer === "p1" ? p1Move : p2Move;
    
    const newRemaining = state.objectsRemaining - move;
    
    if (newRemaining <= 0) {
      // The person who takes the last object LOSES in typical normal play Nim, 
      // but let's say taking the last object WINS for simplicity, as per classic variation.
      // E.g. "Take 1, 2, or 3. Force opponent to take the last one" means taking last = lose.
      const winner = currentPlayer === "p1" ? "p2" : "p1";
      return {
        nextState: { objectsRemaining: 0, turn: currentPlayer === "p1" ? "p2" : "p1" },
        winner: winner,
        reason: `${activePlayerStr.toUpperCase()} was forced to take the last object.`
      };
    }

    return {
      nextState: { objectsRemaining: newRemaining, turn: currentPlayer === "p1" ? "p2" : "p1" },
      winner: null
    };
  }
};
