/**
 * POST /api/skills/upload
 * Encrypts skill source code and uploads it to 0G Storage.
 * Returns the 0G Storage root hash (used as the on-chain storageRootHash).
 */
import { NextRequest, NextResponse } from 'next/server';
import { encryptSkillCode } from '@/lib/encryption';
import { uploadSkillToOG } from '@/lib/og/storage';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { skillSource, metadata } = await req.json();

    if (!skillSource || typeof skillSource !== 'string') {
      return NextResponse.json({ error: 'skillSource is required' }, { status: 400 });
    }

    // Encrypt the source code
    const encrypted = await encryptSkillCode(skillSource);

    // Upload to 0G Storage
    const skillId = randomUUID();
    const rootHash = await uploadSkillToOG(skillId, encrypted, metadata);

    // `cid` kept as an alias for backward compatibility with existing UI.
    return NextResponse.json({ rootHash, cid: rootHash, skillId });
  } catch (err: unknown) {
    console.error('[/api/skills/upload]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
