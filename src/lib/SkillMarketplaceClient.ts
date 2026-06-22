/**
 * SkillMarketplace contract client (0G Chain / ethers).
 * Replaces the old algosdk box-based client. Reads use the default provider;
 * writes are performed by the caller's signer (MetaMask on the client, or the
 * agent's server-custodial wallet for autonomous buys).
 */
import { ethers } from 'ethers';
import { getProvider, getMarketplaceContract, MARKETPLACE_ADDRESS } from '@/lib/og/chain';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SkillListing {
  id: number;
  name: string;
  description: string;
  skillType: string;
  version: string;
  price: number;        // in 0G (human units)
  priceWei: string;     // raw wei as string (for exact on-chain calls)
  seller: string;
  storageRootHash: string;
  soldCount: number;
  listedAt: number;
  active: boolean;
}

function toListing(id: number, s: any): SkillListing {
  return {
    id,
    name: s.name,
    description: s.description,
    skillType: s.skillType,
    version: s.version,
    price: Number(ethers.formatEther(s.price)),
    priceWei: s.price.toString(),
    seller: s.seller,
    storageRootHash: s.storageRootHash,
    soldCount: Number(s.soldCount),
    listedAt: Number(s.listedAt),
    active: s.active,
  };
}

// ─── Read Functions (no wallet needed) ───────────────────────────────────────

/** Fetch all active skills from the contract. */
export async function fetchAllSkills(): Promise<SkillListing[]> {
  if (!MARKETPLACE_ADDRESS) {
    console.error('fetchAllSkills: marketplace address is not set');
    return [];
  }
  try {
    const contract = getMarketplaceContract(getProvider());
    const count = Number(await contract.skillCount());
    const skills: SkillListing[] = [];
    for (let i = 1; i <= count; i++) {
      try {
        const s = await contract.getSkill(i);
        if (s.seller !== ethers.ZeroAddress && s.active) {
          skills.push(toListing(i, s));
        }
      } catch {
        /* skip missing skill */
      }
    }
    return skills;
  } catch (err) {
    console.error('fetchAllSkills failed:', err);
    return [];
  }
}

/** Fetch a single skill by id (active or not). */
export async function fetchSkill(skillId: number): Promise<SkillListing | null> {
  if (!MARKETPLACE_ADDRESS) return null;
  try {
    const contract = getMarketplaceContract(getProvider());
    const s = await contract.getSkill(skillId);
    if (s.seller === ethers.ZeroAddress) return null;
    return toListing(skillId, s);
  } catch {
    return null;
  }
}

/** Check if an address has purchased a skill (on-chain). */
export async function checkAccess(skillId: number, buyer: string): Promise<boolean> {
  if (!MARKETPLACE_ADDRESS) return false;
  try {
    const contract = getMarketplaceContract(getProvider());
    return await contract.hasAccess(skillId, buyer);
  } catch {
    return false;
  }
}

// ─── Write Functions (require a signer) ──────────────────────────────────────

/**
 * List a skill on-chain. `signer` is typically a MetaMask signer on the client.
 * Returns the transaction hash.
 */
export async function listSkill(
  signer: ethers.Signer,
  params: {
    name: string;
    description: string;
    skillType: string;
    version: string;
    priceOg: number; // in 0G
    storageRootHash: string;
  }
): Promise<string> {
  const contract = getMarketplaceContract(signer);
  const priceWei = ethers.parseEther(String(params.priceOg));
  const tx = await contract.listSkill(
    params.name,
    params.description,
    params.skillType,
    params.version,
    priceWei,
    params.storageRootHash
  );
  await tx.wait();
  return tx.hash;
}

/**
 * Buy a skill on-chain with the given signer.
 * Returns the transaction hash.
 */
export async function buySkill(
  signer: ethers.Signer,
  skillId: number,
  priceWei: bigint
): Promise<string> {
  const contract = getMarketplaceContract(signer);
  const tx = await contract.buySkill(skillId, { value: priceWei });
  await tx.wait();
  return tx.hash;
}
