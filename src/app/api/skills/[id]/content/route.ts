/**
 * x402 Content Gate: /api/skills/[id]/content
 *
 * Flow:
 * 1. Request arrives with a 0G (EVM) address in the Authorization header
 * 2. We check on-chain: has this address purchased skill [id]?
 * 3. If yes → fetch from 0G Storage, decrypt, return source
 * 4. If no  → 402 Payment Required with metadata
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkAccess, fetchSkill } from '@/lib/SkillMarketplaceClient';
import { decryptSkillCode } from '@/lib/encryption';
import { fetchSkillFromOG } from '@/lib/og/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const skillId = parseInt(id);
  if (isNaN(skillId) || skillId < 1) {
    return NextResponse.json({ error: 'Invalid skill ID' }, { status: 400 });
  }

  // Extract buyer address from Authorization header
  // Format: "Bearer ALGORAND_ADDRESS"
  const auth = req.headers.get('Authorization') ?? '';
  const buyer = auth.replace(/^Bearer\s+/i, '').trim();

  if (!buyer) {
    return NextResponse.json(
      {
        error: 'Authorization required',
        x402: true,
        paymentInfo: {
          description: `Purchase access to Skill #${skillId}`,
          paymentRoute: '/api/skills/pay',
          skillId,
        },
      },
      { status: 402 }
    );
  }

  // Check on-chain access
  const hasAccess = await checkAccess(skillId, buyer);

  if (!hasAccess) {
    // Get skill pricing info for the 402 response
    const skill = await fetchSkill(skillId);
    const priceOg = skill ? skill.price.toFixed(4) : 'unknown';

    return NextResponse.json(
      {
        error: 'Payment required to access this skill',
        x402: true,
        paymentInfo: {
          skillId,
          skillName: skill?.name ?? `Skill #${skillId}`,
          priceOg,
          priceWei: skill?.priceWei ?? '0',
          currency: '0G',
          seller: skill?.seller ?? '',
          purchaseEndpoint: '/api/skills/purchase',
        },
      },
      { status: 402 }
    );
  }

  // Access granted — fetch from 0G Storage and decrypt
  try {
    const skill = await fetchSkill(skillId);

    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const encryptedContent = await fetchSkillFromOG(skill.storageRootHash);
    const decryptedSource = await decryptSkillCode(encryptedContent);

    return NextResponse.json(
      {
        skillId,
        name: skill.name,
        type: skill.skillType,
        version: skill.version,
        source: decryptedSource,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Gated': 'true',
        },
      }
    );
  } catch (err) {
    console.error('[x402 Gate] Error fetching/decrypting skill:', err);
    return NextResponse.json({ error: 'Failed to retrieve skill content' }, { status: 500 });
  }
}
