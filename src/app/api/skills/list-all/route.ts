/**
 * GET /api/skills/list-all
 * Returns all active skills from the on-chain contract.
 */
import { NextResponse } from 'next/server';
import { fetchAllSkills } from '@/lib/SkillMarketplaceClient';

export async function GET() {
  try {
    const skills = await fetchAllSkills();
    return NextResponse.json({ skills }, {
      headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
    });
  } catch (err: unknown) {
    console.error('[/api/skills/list-all]', err);
    return NextResponse.json({ skills: [], error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
