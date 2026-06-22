/**
 * GET /api/skills/owned?address=ADDRESS
 * Returns a list of all skills purchased by the specified address.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchAllSkills, checkAccess } from '@/lib/SkillMarketplaceClient';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ skills: [] }, { status: 400 });
  }

  try {
    // 1. Fetch all skills available in the marketplace
    const allSkills = await fetchAllSkills();

    // 2. Filter down to only those owned by this address
    // We do this in parallel to be efficient
    const ownedSkills = await Promise.all(
      allSkills.map(async (skill) => {
        if (skill.seller === address) return skill; // Sellers automatically own their skills
        const hasAccess = await checkAccess(skill.id, address);
        return hasAccess ? skill : null;
      })
    );

    return NextResponse.json({
      skills: ownedSkills.filter((s): s is NonNullable<typeof s> => s !== null)
    });
  } catch (err) {
    console.error('Failed to fetch owned skills:', err);
    return NextResponse.json({ skills: [], error: 'Internal server error' }, { status: 500 });
  }
}
