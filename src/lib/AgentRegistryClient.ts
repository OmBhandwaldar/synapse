/**
 * AgentRegistryClient — [PARTIALLY DEFERRED for the 0G Group Stage]
 *
 * The on-chain AgentRegistry (TEALScript) is NOT ported in the Group Stage.
 * Agent metadata lives in Supabase this round; agent wallets are created via
 * POST /api/agent/deploy (EVM wallets). The on-chain registry + matches + ELO
 * return in a later round on 0G.
 *
 * This file keeps the chain-agnostic helpers and shared types/constants that
 * the UI imports, and stubs the former Algorand transaction builders so the
 * build stays green.
 */

// ─── Shared types ───────────────────────────────────────────────────────────
export interface OnChainMatch {
  matchId: number;
  gameType: number;
  gameId: string;
  agentA: string;
  agentB: string | null;
  stakeAmount: number; // in 0G (later round)
  status: number; // 0=open, 1=committed, 3=settled
  createdAt: number;
  winner: string | null;
}

// ─── Game type mapping (chain-agnostic) ─────────────────────────────────────
export const GAME_TYPE_MAP: Record<string, number> = { rps: 1, tictactoe: 2, nim: 3 };
export const GAME_TYPE_NAMES: Record<number, string> = { 1: 'rps', 2: 'tictactoe', 3: 'nim' };

// ─── Move encoding (chain-agnostic; reused by future commit-reveal) ─────────
export function encodeMove(gameId: string, move: any): number {
  if (gameId === 'rps') {
    if (move === 'R') return 1;
    if (move === 'P') return 2;
    if (move === 'S') return 3;
  }
  if (gameId === 'tictactoe') return Number(move) + 1; // offset to avoid 0
  if (gameId === 'nim') return Number(move);
  return 0;
}

export function decodeMove(gameId: string, encoded: number): any {
  if (gameId === 'rps') {
    if (encoded === 1) return 'R';
    if (encoded === 2) return 'P';
    if (encoded === 3) return 'S';
  }
  if (gameId === 'tictactoe') return encoded - 1; // reverse offset
  if (gameId === 'nim') return encoded;
  return null;
}

// ─── Commit-reveal helpers (chain-agnostic) ─────────────────────────────────
export async function createCommitHash(moveEncoded: number, salt: Uint8Array): Promise<Uint8Array> {
  const moveBytes = new Uint8Array(8);
  let v = BigInt(moveEncoded);
  for (let i = 7; i >= 0; i--) {
    moveBytes[i] = Number(v & BigInt(0xff));
    v >>= BigInt(8);
  }
  const combined = new Uint8Array([...moveBytes, ...salt]);
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  return new Uint8Array(hashBuffer);
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

// ─── Deferred on-chain functions (stubbed) ──────────────────────────────────
const DEFERRED = 'AgentRegistry on-chain is deferred to a later 0G round.';

export async function fetchOpenMatches(): Promise<OnChainMatch[]> {
  // No on-chain registry this round.
  return [];
}

export async function buildDeployAgentTxns(): Promise<never> {
  throw new Error(DEFERRED + ' Use POST /api/agent/deploy instead.');
}

export async function buildCreateMatchTxns(): Promise<never> {
  throw new Error(DEFERRED);
}

export async function buildJoinMatchTxns(): Promise<never> {
  throw new Error(DEFERRED);
}

export async function submitSignedTxns(): Promise<never> {
  throw new Error(DEFERRED);
}
