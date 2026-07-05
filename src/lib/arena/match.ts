/**
 * Arena match engine (server-side).
 *
 * Pits two agents against each other in one of three games. Each turn, the
 * active fighter(s):
 *   1. run their equipped skill in the QuickJS sandbox  → skillMove
 *   2. reason on TEE-verified 0G Compute to follow/override → finalMove
 * The game engine resolves each turn and declares a winner.
 *
 * RPS is simultaneous (both fighters reason each round, in parallel).
 * Nim / TicTacToe are sequential (only the active player reasons per ply).
 */
import { evaluateAgentMove } from '@/lib/engine/sandbox';
import { runInference, type ChatMessage } from '@/lib/og/compute';
import { rpsEngine } from '@/lib/games/rps';
import { nimEngine } from '@/lib/games/nim';
import { tictactoeEngine } from '@/lib/games/tictactoe';
import type { GameEngine } from '@/lib/engine/types';

export type GameId = 'rps' | 'nim' | 'tictactoe';

const ENGINES: Record<GameId, GameEngine<any, any>> = {
  rps: rpsEngine,
  nim: nimEngine,
  tictactoe: tictactoeEngine,
};

const MOVE_HINTS: Record<GameId, string> = {
  rps: 'R, P, or S',
  nim: '1, 2, or 3',
  tictactoe: '0-8 (a board index)',
};

const TURN_CAP = 24; // safety guard against a runaway match

// A fighter that's ready to play: its resolved skill code + identity.
export interface Fighter {
  side: 'p1' | 'p2';
  agentAddress: string | null; // null for the House bot
  agentName: string;
  isHouse: boolean;
  code: string; // decrypted skill JS
}

// Per-move outcome we surface to the UI (drives the TEE seal).
export interface MoveResult {
  skillMove: any;
  finalMove: any;
  reasoning: string;
  verified: boolean;
  provider: string;
  overridden: boolean;
}

export interface TurnEvent {
  turnNumber: number;
  gameId: GameId;
  p1Move: any;
  p2Move: any;
  stateAfter: any;
  reason: string;
  moves: { p1?: MoveResult; p2?: MoveResult };
}

export interface ResultEvent {
  winnerSide: 'p1' | 'p2' | 'draw' | null;
  winnerAddress: string | null;
  winnerName: string | null;
  reason: string;
  finalState: any;
}

// The sandbox playerId each game expects (tictactoe uses X/O).
function sandboxPlayerId(gameId: GameId, side: 'p1' | 'p2'): string {
  if (gameId === 'tictactoe') return side === 'p1' ? 'X' : 'O';
  return side;
}

// Which side is on the move for a sequential game.
function activeSide(gameId: GameId, state: any): 'p1' | 'p2' {
  if (gameId === 'tictactoe') return state.turn === 'X' ? 'p1' : 'p2';
  return state.turn; // nim stores 'p1'|'p2'
}

function coerceMove(gameId: GameId, move: any): any {
  if (gameId === 'nim' || gameId === 'tictactoe') return Number(move);
  return move;
}

// Run one fighter's skill + 0G Compute decision for the current state.
async function decideMove(
  gameId: GameId,
  fighter: Fighter,
  state: any,
  history: any[],
): Promise<MoveResult> {
  const pid = sandboxPlayerId(gameId, fighter.side);
  const sandbox = await evaluateAgentMove(fighter.code, state, pid, history);
  const skillMove = sandbox.success ? sandbox.returnValue : null;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a competitive game-playing AI agent. You always commit to exactly one concrete, valid move. Respond only with strict JSON, no extra text.',
    },
    {
      role: 'user',
      content: `Game:${gameId}
You are playing as ${pid}.
State:${JSON.stringify(state)}
Your skill module computed the move: ${JSON.stringify(skillMove)}.
Decide whether to follow the skill's move or override it, then commit to ONE move.
The "move" field MUST be exactly one of: ${MOVE_HINTS[gameId]} — never the word "random" or an explanation.
Respond ONLY as compact JSON: {"reasoning":"one short sentence","move":"<one valid move>"}`,
    },
  ];

  let finalMove: any = skillMove;
  let reasoning = '';
  let verified = false;
  let provider = '';
  try {
    const inf = await runInference(null, messages);
    const cleaned = inf.content.replace(/```json|```/g, '').trim();
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    const parsed = JSON.parse(s !== -1 ? cleaned.slice(s, e + 1) : cleaned);
    finalMove = parsed.move ?? skillMove;
    reasoning = parsed.reasoning ?? '';
    verified = inf.verified;
    provider = inf.provider;
  } catch (err: any) {
    reasoning = `Brain unavailable (${err.message}); using the skill's move.`;
    finalMove = skillMove;
  }

  finalMove = coerceMove(gameId, finalMove);
  const overridden = String(finalMove) !== String(skillMove);
  return { skillMove, finalMove, reasoning, verified, provider, overridden };
}

/**
 * Run a full match, invoking `emit` for each turn as it resolves so the caller
 * can stream it. Returns the final result.
 */
export async function runMatch(
  gameId: GameId,
  p1: Fighter,
  p2: Fighter,
  emit: (turn: TurnEvent) => void,
): Promise<ResultEvent> {
  const engine = ENGINES[gameId];
  let state = engine.getInitialState();
  const history: any[] = []; // RPS round history for skills that read it
  let turnNumber = 1;
  let winnerSide: 'p1' | 'p2' | 'draw' | null = null;
  let reason = '';

  while (turnNumber <= TURN_CAP) {
    let p1Move: any;
    let p2Move: any;
    const moves: { p1?: MoveResult; p2?: MoveResult } = {};

    if (gameId === 'rps') {
      // Simultaneous: both fighters reason in parallel.
      const [a, b] = await Promise.all([
        decideMove(gameId, p1, state, history),
        decideMove(gameId, p2, state, history),
      ]);
      moves.p1 = a;
      moves.p2 = b;
      p1Move = engine.validateMove(state, a.finalMove, 'p1');
      p2Move = engine.validateMove(state, b.finalMove, 'p2');
    } else {
      // Sequential: only the active player reasons this ply.
      const side = activeSide(gameId, state);
      const fighter = side === 'p1' ? p1 : p2;
      const d = await decideMove(gameId, fighter, state, history);
      moves[side] = d;
      const validated = engine.validateMove(state, d.finalMove, side);
      p1Move = side === 'p1' ? validated : 0;
      p2Move = side === 'p2' ? validated : 0;
    }

    const { nextState, winner, reason: turnReason } = engine.computeNextState(state, p1Move, p2Move);

    if (gameId === 'rps') {
      history.push({ turnNumber, p1Move, p2Move });
    }

    emit({
      turnNumber,
      gameId,
      p1Move,
      p2Move,
      stateAfter: nextState,
      reason: turnReason ?? '',
      moves,
    });

    state = nextState;
    if (winner !== null) {
      winnerSide = winner;
      reason = turnReason ?? '';
      break;
    }
    turnNumber++;
  }

  if (winnerSide === null) {
    winnerSide = 'draw';
    reason = `Match reached the ${TURN_CAP}-turn cap without a decisive result — declared a draw.`;
  }

  const winnerFighter = winnerSide === 'p1' ? p1 : winnerSide === 'p2' ? p2 : null;
  return {
    winnerSide,
    winnerAddress: winnerFighter?.agentAddress ?? null,
    winnerName: winnerFighter?.agentName ?? null,
    reason,
    finalState: state,
  };
}
