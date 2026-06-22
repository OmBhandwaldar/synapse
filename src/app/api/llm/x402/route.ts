/**
 * 0G Compute Inference Gateway — POST /api/llm/x402
 *
 * The agent's "brain". Inference runs on 0G Compute via the Direct SDK: the
 * agent pays the compute provider from its OWN 0G wallet through the on-chain
 * ledger (machine-to-machine economic autonomy), and the response is TEE-signed
 * and verifiable. A Router fallback (OG_COMPUTE_MODE=router) is available.
 *
 * The old Algorand x402 pay-per-move hop is removed: payment to the provider is
 * handled inside the 0G Compute broker, which already demonstrates M2M autonomy.
 *
 * Body (game mode):    { agentAddress, gameId, state, history?, skillMove?, agentName? }
 * Body (generic mode): { agentAddress, messages: ChatMessage[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAgentWallet } from '@/lib/server/AgentKeyVault';
import { runInference, ChatMessage } from '@/lib/og/compute';

const MOVE_HINTS: Record<string, string> = {
  rps: 'R, P, or S',
  tictactoe: '0-8 (board index)',
  nim: '1, 2, or 3',
};

/** Robustly isolate a JSON object from a model response. */
function cleanParseJSON(text: string): any {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('Could not parse JSON from model response');
  }
}

function buildGameMessages(
  agentName: string,
  gameId: string,
  state: any,
  history: any[],
  skillMove: any
): ChatMessage[] {
  const recentHistory = history.slice(-2).map((h) => ({
    t: h.turnNumber,
    p1: h.p1Move,
    p2: h.p2Move,
  }));

  const prompt = `Agent:${agentName} Game:${gameId}
State:${JSON.stringify(state)}
History(last2):${JSON.stringify(recentHistory)}
Skill algorithm suggested: ${JSON.stringify(skillMove)}.
Valid moves: ${MOVE_HINTS[gameId] ?? 'any'}
Should you follow or override the skill move? Respond ONLY as JSON: {"reasoning":"brief","move":"final move"}`;

  return [
    { role: 'system', content: 'You are a competitive game-playing AI agent. Respond only with strict JSON.' },
    { role: 'user', content: prompt },
  ];
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agentAddress, gameId, state, history, skillMove, agentName, messages } = body;

  if (!agentAddress) {
    return NextResponse.json({ error: 'agentAddress is required' }, { status: 400 });
  }

  try {
    // Load the agent's own 0G wallet — it pays for its own inference.
    const agentWallet = await getAgentWallet(agentAddress);

    // Generic chat mode.
    if (Array.isArray(messages)) {
      const result = await runInference(agentWallet, messages as ChatMessage[]);
      return NextResponse.json({
        content: result.content,
        verified: result.verified,
        provider: result.provider,
      });
    }

    // Game-decision mode.
    if (!gameId || state === undefined) {
      return NextResponse.json(
        { error: 'Provide either messages[] or { gameId, state }' },
        { status: 400 }
      );
    }

    const result = await runInference(
      agentWallet,
      buildGameMessages(agentName ?? agentAddress.slice(0, 8), gameId, state, history ?? [], skillMove)
    );

    const parsed = cleanParseJSON(result.content);
    let move = parsed.move ?? skillMove;
    if (gameId === 'tictactoe' || gameId === 'nim') move = Number(move);

    return NextResponse.json({
      move,
      reasoning: parsed.reasoning ?? '',
      verified: result.verified,
      provider: result.provider,
    });
  } catch (err: any) {
    console.error('[0G Compute] inference failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
