/**
 * POST /api/arena/execute  — the battle arena orchestrator.
 *
 * Pits two agents against each other in a live match, streamed over SSE.
 * Each turn, the active fighter(s) run their equipped skill in the sandbox and
 * reason on TEE-verified 0G Compute; the game engine resolves a winner.
 *
 * Body:
 *   {
 *     gameId: 'rps' | 'nim' | 'tictactoe',
 *     agentA: { agentAddress, agentName, skillId },
 *     agentB: { agentAddress, agentName, skillId } | { house: true }
 *   }
 *
 * SSE events: `progress` (status text), `turn` (TurnEvent), `result` (ResultEvent),
 * `error` (message).
 */
import type { NextRequest } from 'next/server';
import { fetchSkill, checkAccess } from '@/lib/SkillMarketplaceClient';
import { fetchSkillFromOG } from '@/lib/og/storage';
import { decryptSkillCode } from '@/lib/encryption';
import { runMatch, type Fighter, type GameId } from '@/lib/arena/match';
import { HOUSE_CODE, HOUSE_NAME } from '@/lib/arena/house';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VALID_GAMES: GameId[] = ['rps', 'nim', 'tictactoe'];

// Resolve a real agent's fighter: it must own the skill on-chain, then we
// fetch + decrypt the skill code from 0G Storage.
async function resolvePlayerFighter(
  side: 'p1' | 'p2',
  spec: { agentAddress: string; agentName?: string; skillId: number },
): Promise<Fighter> {
  const id = Number(spec.skillId);
  const skill = await fetchSkill(id);
  if (!skill) throw new Error(`Skill #${id} not found`);
  if (!(await checkAccess(id, spec.agentAddress))) {
    throw new Error(`Agent ${spec.agentAddress.slice(0, 8)}… does not own skill #${id}. Buy it first.`);
  }
  const encrypted = await fetchSkillFromOG(skill.storageRootHash);
  const code = await decryptSkillCode(encrypted);
  return {
    side,
    agentAddress: spec.agentAddress,
    agentName: spec.agentName || `Agent ${spec.agentAddress.slice(0, 6)}`,
    isHouse: false,
    code,
  };
}

function houseFighter(side: 'p1' | 'p2', gameId: GameId): Fighter {
  return { side, agentAddress: null, agentName: HOUSE_NAME, isHouse: true, code: HOUSE_CODE[gameId] };
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const gameId = body?.gameId as GameId;
  if (!VALID_GAMES.includes(gameId)) {
    return new Response(JSON.stringify({ error: 'gameId must be rps, nim, or tictactoe' }), { status: 400 });
  }
  const { agentA, agentB } = body ?? {};
  if (!agentA?.agentAddress || agentA?.skillId === undefined) {
    return new Response(JSON.stringify({ error: 'agentA { agentAddress, skillId } is required' }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        send('progress', { message: 'Resolving fighters and their skills…' });

        const p1 = await resolvePlayerFighter('p1', agentA);
        const p2 = agentB?.house
          ? houseFighter('p2', gameId)
          : await resolvePlayerFighter('p2', agentB);

        send('progress', {
          message: `Match starting: ${p1.agentName} vs ${p2.agentName} — ${gameId.toUpperCase()}`,
          p1: { name: p1.agentName, address: p1.agentAddress, isHouse: p1.isHouse },
          p2: { name: p2.agentName, address: p2.agentAddress, isHouse: p2.isHouse },
        });

        const result = await runMatch(gameId, p1, p2, (turn) => send('turn', turn));

        send('result', result);
      } catch (err: any) {
        send('error', { error: err?.message ?? 'Match failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
