/**
 * On-chain AgentRegistry writes (server-side only).
 *
 * Matches are orchestrated by the platform, so the platform wallet (the registry
 * admin) records results. All writes are best-effort — a registry failure must
 * never break a match.
 */
import { ethers } from 'ethers';
import { getProvider, getRegistryContract, AGENT_REGISTRY_ADDRESS } from '@/lib/og/chain';

const GAS_PRICE = BigInt('5000000000'); // 5 gwei — 0G rejects sub-2-gwei tips

function platformSigner(): ethers.Wallet {
  const pk = process.env.PLATFORM_PRIVATE_KEY;
  if (!pk) throw new Error('PLATFORM_PRIVATE_KEY not set');
  return new ethers.Wallet(pk, getProvider());
}

/**
 * Record a decisive match result on-chain (winner gains Neurons + a win, loser a
 * loss). Returns the tx hash, or null if recording was skipped/failed.
 */
export async function recordMatchOnChain(
  winner: { address: string; name: string },
  loser: { address: string; name: string },
): Promise<string | null> {
  if (!AGENT_REGISTRY_ADDRESS) return null;
  try {
    const registry = getRegistryContract(platformSigner());
    const tx = await registry.recordMatch(
      winner.address,
      winner.name,
      loser.address,
      loser.name,
      { gasPrice: GAS_PRICE },
    );
    await tx.wait();
    return tx.hash;
  } catch (err: any) {
    console.warn('[AgentRegistry] recordMatch failed:', err?.message ?? err);
    return null;
  }
}

/**
 * Register an agent on-chain (best-effort). Called at deploy time so the agent
 * shows up in the registry/leaderboard before it ever fights.
 */
export async function registerAgentOnChain(
  agentAddress: string,
  ownerAddress: string,
  name: string,
): Promise<string | null> {
  if (!AGENT_REGISTRY_ADDRESS) return null;
  try {
    const registry = getRegistryContract(platformSigner());
    const tx = await registry.registerAgent(agentAddress, ownerAddress, name, { gasPrice: GAS_PRICE });
    await tx.wait();
    return tx.hash;
  } catch (err: any) {
    console.warn('[AgentRegistry] registerAgent failed:', err?.message ?? err);
    return null;
  }
}
