/**
 * POST /api/agent/play  — "Skill in Action"
 *
 * Closes the buy -> use loop. An agent:
 *  1. Proves it owns the skill on-chain (x402 gate / hasAccess),
 *  2. Fetches the encrypted skill from 0G Storage and decrypts it,
 *  3. RUNS the skill in the QuickJS sandbox to get the skill's move,
 *  4. Then reasons on 0G Compute to follow or override the skill's move.
 *
 * Body: { agentAddress: string, skillId: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { evaluateAgentMove } from '@/lib/engine/sandbox';
import { fetchSkill, checkAccess } from '@/lib/SkillMarketplaceClient';
import { fetchSkillFromOG } from '@/lib/og/storage';
import { decryptSkillCode } from '@/lib/encryption';
import { getAgentWallet } from '@/lib/server/AgentKeyVault';
import { runInference } from '@/lib/og/compute';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MOVE_HINTS: Record<string, string> = {
  rps: 'R, P, or S',
  nim: '1, 2, or 3',
  tictactoe: '0-8 (a board index)',
};

// Infer the game from the skill name (skills are named by game).
function inferGame(name: string): 'rps' | 'nim' | 'tictactoe' {
  const n = name.toLowerCase();
  if (n.includes('nim')) return 'nim';
  if (n.includes('tic') || n.includes('tac')) return 'tictactoe';
  return 'rps';
}

// A representative scenario per game (state + history) the skill can reason over.
function scenarioFor(gameId: string): { state: any; history: any[]; me: string; summary: string } {
  if (gameId === 'nim') {
    return {
      state: { objectsRemaining: 7, turn: 'p1' },
      history: [],
      me: 'p1',
      summary: 'Nim: 7 objects remaining, your turn. Take 1, 2, or 3.',
    };
  }
  if (gameId === 'tictactoe') {
    return {
      state: { board: ['X', 'O', 'X', null, 'O', null, null, null, null], turn: 'X' },
      history: [],
      me: 'X',
      summary: 'Tic-Tac-Toe: you are X. Pick the best open cell (0-8).',
    };
  }
  // rps — opponent (p2) has played Rock three times in a row.
  return {
    state: { round: 4, p1Score: 1, p2Score: 1 },
    history: [
      { turnNumber: 1, p1Move: 'P', p2Move: 'R' },
      { turnNumber: 2, p1Move: 'S', p2Move: 'R' },
      { turnNumber: 3, p1Move: 'P', p2Move: 'R' },
    ],
    me: 'p1',
    summary: 'Rock-Paper-Scissors: the opponent has played Rock three times in a row.',
  };
}

export async function POST(req: NextRequest) {
  try {
    const { agentAddress, skillId } = await req.json();
    if (!agentAddress || skillId === undefined) {
      return NextResponse.json({ error: 'agentAddress and skillId are required' }, { status: 400 });
    }
    const id = Number(skillId);

    // 1. Skill must exist and the agent must own it (on-chain).
    const skill = await fetchSkill(id);
    if (!skill) return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    if (!(await checkAccess(id, agentAddress))) {
      return NextResponse.json({ error: 'Agent does not own this skill. Buy it first.' }, { status: 402 });
    }

    // 2. Fetch from 0G Storage + decrypt.
    const encrypted = await fetchSkillFromOG(skill.storageRootHash);
    const source = await decryptSkillCode(encrypted);

    // 3. Run the skill in the sandbox.
    const gameId = inferGame(skill.name);
    const { state, history, me, summary } = scenarioFor(gameId);
    const sandbox = await evaluateAgentMove(source, state, me, history);
    const skillMove = sandbox.success ? sandbox.returnValue : null;

    // 4. Reason on 0G Compute: follow or override the skill's move?
    const wallet = await getAgentWallet(agentAddress);
    const messages = [
      {
        role: 'system' as const,
        content:
          'You are a competitive game-playing AI agent. You always commit to exactly one concrete, valid move. Respond only with strict JSON, no extra text.',
      },
      {
        role: 'user' as const,
        content: `Game:${gameId}
Scenario:${summary}
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
      const inf = await runInference(wallet, messages);
      const cleaned = inf.content.replace(/```json|```/g, '').trim();
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
      const parsed = JSON.parse(s !== -1 ? cleaned.slice(s, e + 1) : cleaned);
      finalMove = parsed.move ?? skillMove;
      if (gameId === 'nim') finalMove = Number(finalMove);
      if (gameId === 'tictactoe') finalMove = Number(finalMove);
      reasoning = parsed.reasoning ?? '';
      verified = inf.verified;
      provider = inf.provider;
    } catch (e: any) {
      reasoning = `Brain unavailable (${e.message}); using the skill's move.`;
    }

    const overridden = String(finalMove) !== String(skillMove);

    return NextResponse.json({
      skillName: skill.name,
      gameId,
      scenario: summary,
      skillMove,
      skillError: sandbox.success ? null : sandbox.error,
      finalMove,
      reasoning,
      overridden,
      verified,
      provider,
      logs: sandbox.logs?.slice(0, 4) ?? [],
    });
  } catch (err: any) {
    console.error('[/api/agent/play]', err);
    return NextResponse.json({ error: err.message ?? 'Skill run failed' }, { status: 500 });
  }
}
