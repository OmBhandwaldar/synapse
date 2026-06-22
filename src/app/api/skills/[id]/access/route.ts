/**
 * GET /api/skills/[id]/access?buyer=ADDRESS
 * Returns whether a buyer has purchased a skill. Used for UI ownership indicators.
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/SkillMarketplaceClient';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const skillId = parseInt(id);
  const buyer = req.nextUrl.searchParams.get('buyer') ?? '';

  if (isNaN(skillId) || !buyer) {
    return NextResponse.json({ hasAccess: false }, { status: 400 });
  }

  try {
    const hasAccess = await checkAccess(skillId, buyer);
    return NextResponse.json({ hasAccess });
  } catch {
    return NextResponse.json({ hasAccess: false });
  }
}
