/**
 * 0G Storage helpers (server-side only).
 * Replaces the old Pinata IPFS module. Keeps the same wrapper payload shape
 * ({ cortex_skill, skill_id, encrypted_source, public_metadata }) so the rest
 * of the app barely changes — but stores it on 0G Storage and addresses it by
 * root hash instead of an IPFS CID.
 */
import { ZgFile, Indexer } from '@0gfoundation/0g-storage-ts-sdk';
import { ethers } from 'ethers';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { OG_RPC_URL } from './chain';

const OG_INDEXER_RPC =
  process.env.OG_INDEXER_RPC ?? 'https://indexer-storage-testnet-turbo.0g.ai';

function getSigner(): ethers.Wallet {
  const pk = process.env.PLATFORM_PRIVATE_KEY;
  if (!pk) throw new Error('PLATFORM_PRIVATE_KEY not set (required for 0G Storage uploads)');
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL);
  return new ethers.Wallet(pk, provider);
}

function getIndexer(): Indexer {
  return new Indexer(OG_INDEXER_RPC);
}

interface SkillPayload {
  cortex_skill: true;
  skill_id: string;
  encrypted_source: string;
  public_metadata: {
    name: string;
    type: string;
    version: string;
    seller: string;
  };
}

/**
 * Upload encrypted skill content to 0G Storage.
 * Returns the root hash (used later to download the file).
 */
export async function uploadSkillToOG(
  skillId: string,
  encryptedContent: string,
  metadata: { name: string; type: string; version: string; seller: string }
): Promise<string> {
  const payload: SkillPayload = {
    cortex_skill: true,
    skill_id: skillId,
    encrypted_source: encryptedContent,
    public_metadata: metadata,
  };

  const tmpPath = path.join(os.tmpdir(), `skill_${skillId}_${randomUUID()}.json`);
  await fs.writeFile(tmpPath, JSON.stringify(payload));

  try {
    const file = await ZgFile.fromFilePath(tmpPath);
    const [tree, treeErr] = await file.merkleTree();
    if (treeErr !== null) {
      await file.close();
      throw new Error(`0G Storage merkle tree error: ${treeErr}`);
    }

    const signer = getSigner();
    const indexer = getIndexer();
    // The 0G SDK bundles its own ethers build; cast across the dual-package boundary.
    const [tx, uploadErr] = await indexer.upload(file, OG_RPC_URL, signer as any);
    await file.close();
    if (uploadErr !== null) {
      throw new Error(`0G Storage upload error: ${uploadErr}`);
    }

    // Prefer the root hash from the merkle tree; fall back to tx fields.
    const rootHash =
      tree?.rootHash?.() ??
      ('rootHash' in (tx as any) ? (tx as any).rootHash : (tx as any).rootHashes);
    if (!rootHash) throw new Error('0G Storage upload returned no root hash');
    return rootHash as string;
  } finally {
    await fs.rm(tmpPath, { force: true });
  }
}

/**
 * Download a skill from 0G Storage by root hash and return the
 * encrypted_source string from the wrapped payload.
 */
export async function fetchSkillFromOG(rootHash: string): Promise<string> {
  const indexer = getIndexer();
  const tmpPath = path.join(os.tmpdir(), `skill_dl_${randomUUID()}.json`);

  try {
    const err = await indexer.download(rootHash, tmpPath, true);
    if (err !== null) throw new Error(`0G Storage download error: ${err}`);

    const raw = await fs.readFile(tmpPath, 'utf-8');
    const data = JSON.parse(raw) as SkillPayload;
    return data.encrypted_source;
  } finally {
    await fs.rm(tmpPath, { force: true });
  }
}
