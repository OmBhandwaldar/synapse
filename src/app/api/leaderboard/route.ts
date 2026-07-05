/**
 * GET /api/leaderboard
 * Reads the on-chain AgentRegistry (0G Chain) and returns agents ranked by
 * Neurons. Wins/losses/Neurons are real on-chain values written by arena matches.
 */
import { NextResponse } from 'next/server';
import { getProvider, getRegistryContract, AGENT_REGISTRY_ADDRESS } from '@/lib/og/chain';

export const runtime = 'nodejs';

export async function GET() {
  try {
    if (!AGENT_REGISTRY_ADDRESS) {
      return NextResponse.json({ leaderboard: [] });
    }

    const registry = getRegistryContract(getProvider());
    const count = Number(await registry.getAgentCount());

    const entries = await Promise.all(
      Array.from({ length: count }, async (_, i) => {
        try {
          const addr: string = await registry.agentList(i);
          const rec = await registry.getAgent(addr);
          const wins = Number(rec.wins);
          const losses = Number(rec.losses);
          const total = wins + losses;
          return {
            name: rec.name || `${addr.slice(0, 6)}…${addr.slice(-4)}`,
            address: addr,
            neurons: Number(rec.neurons),
            wins,
            losses,
            winRate: total > 0 ? ((wins / total) * 100).toFixed(0) + '%' : '—',
          };
        } catch {
          return null;
        }
      })
    );

    const leaderboard = entries
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => b.neurons - a.neurons || b.wins - a.wins);

    return NextResponse.json({ leaderboard });
  } catch (err: any) {
    console.error('Leaderboard API error:', err);
    return NextResponse.json({ leaderboard: [], error: err.message }, { status: 200 });
  }
}
