/**
 * POST /api/skills/purchase
 * Autonomous skill purchase: the agent buys a skill on 0G Chain from its OWN
 * server-custodial wallet — no per-step human signing. This is the core
 * "economic autonomy" action of the x402 flow.
 *
 * Body: { agentAddress: string, skillId: number }
 * 1. Look up the skill price on-chain.
 * 2. If the agent already has access, return early.
 * 3. Otherwise call buySkill() from the agent's wallet and return the tx hash.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchSkill, checkAccess } from '@/lib/SkillMarketplaceClient';
import { agentBuySkill } from '@/lib/server/AgentKeyVault';

export async function POST(req: NextRequest) {
  try {
    const { agentAddress, skillId } = await req.json();

    if (!agentAddress || skillId === undefined) {
      return NextResponse.json(
        { error: 'agentAddress and skillId are required' },
        { status: 400 }
      );
    }

    const id = Number(skillId);
    const skill = await fetchSkill(id);
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    // Already owned — nothing to pay.
    if (await checkAccess(id, agentAddress)) {
      return NextResponse.json({ alreadyOwned: true, skillId: id });
    }

    // Autonomous on-chain purchase from the agent's own 0G wallet.
    const txHash = await agentBuySkill(agentAddress, id, BigInt(skill.priceWei));

    return NextResponse.json({
      success: true,
      skillId: id,
      txHash,
      explorer: `https://chainscan-galileo.0g.ai/tx/${txHash}`,
      pricePaid: skill.price,
      currency: '0G',
    });
  } catch (err: unknown) {
    console.error('[/api/skills/purchase]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Purchase failed' },
      { status: 500 }
    );
  }
}
