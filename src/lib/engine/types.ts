export interface Agent {
  id: string;
  name: string;
  code: string;
}

export type MatchStatus = "pending" | "live" | "completed" | "error";

export interface MatchTurnLog {
  turnNumber: number;
  p1Move: any;
  p2Move: any;
  stateAfter: any;
  logMessages: string[];
}

export interface MatchResult {
  winnerId: string | null; // null means draw
  reason: string;
  turns: MatchTurnLog[];
  finalState: any;
}

export interface GameEngine<TState, TMove> {
  name: string;
  id: string;
  getInitialState: () => TState;
  validateMove: (state: TState, move: any, playerId: "p1" | "p2") => TMove | null;
  computeNextState: (state: TState, p1Move: TMove, p2Move: TMove) => { 
    nextState: TState; 
    winner: "p1" | "p2" | "draw" | null; // null if game continues
    reason?: string;
  };
}
