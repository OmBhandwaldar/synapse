/**
 * Built-in "House" opponent skills — one per game. Lets a judge run a battle
 * with a single agent (no need for two funded, skill-owning agents). The House
 * still reasons on 0G Compute each move, so its moves are TEE-verified too.
 */
import type { GameId } from './match';

export const HOUSE_CODE: Record<GameId, string> = {
  // Cycles R -> P -> S by round.
  rps: `const state = getState();\nconst moves = ["R", "P", "S"];\nreturn moves[(state.round - 1) % 3];`,
  // Leaves a multiple of 4 when it can (optimal-ish Nim heuristic), else takes 1.
  nim: `const state = getState();\nconst n = state.objectsRemaining;\nconst take = ((n - 1) % 4);\nreturn take >= 1 && take <= 3 ? take : 1;`,
  // Takes center, then the first open cell.
  tictactoe: `const state = getState();\nconst b = state.board;\nif (b[4] === null) return 4;\nfor (let i = 0; i < 9; i++) { if (b[i] === null) return i; }\nreturn 0;`,
};

export const HOUSE_NAME = 'House Bot';
