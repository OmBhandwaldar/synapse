/**
 * AgentKeyVault.ts
 * Server-side only. Decrypts an agent's EVM (0G) private key from the Supabase
 * vault and returns an ethers.Wallet ready to sign. The key is decrypted
 * in-memory ONLY — never logged, never returned to the client.
 *
 * The AES-256-GCM decryption is chain-agnostic and unchanged from the original
 * Algorand version; only the key material (now an EVM private key) and the
 * resulting account type (ethers.Wallet) differ.
 */
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import { subtle } from 'crypto';
import { getProvider, getMarketplaceContract } from '@/lib/og/chain';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function decryptKey(encryptedHex: string): Promise<string> {
  const masterKey = Buffer.from(process.env.AGENT_ENCRYPTION_KEY!, 'hex');
  const [ivHex, ciphertextHex] = encryptedHex.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const aesKey = await subtle.importKey('raw', masterKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const plaintext = await subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
  // Stored value is the EVM private key as a hex string (0x-prefixed).
  return new TextDecoder().decode(plaintext);
}

/**
 * Fetches and decrypts an agent's private key from the Supabase vault.
 * Returns an ethers.Wallet connected to the 0G provider, ready for signing.
 */
export async function getAgentWallet(agentAddress: string): Promise<ethers.Wallet> {
  const { data: agent, error } = await supabase
    .from('agents')
    .select('encrypted_secret_key, agent_address')
    .eq('agent_address', agentAddress)
    .single();

  if (error || !agent) {
    throw new Error(`Agent ${agentAddress} not found in vault: ${error?.message}`);
  }

  const privKey = await decryptKey(agent.encrypted_secret_key);
  return new ethers.Wallet(privKey, getProvider());
}

/**
 * Signs and submits a native 0G payment from an agent's wallet.
 * Returns the confirmed transaction hash.
 */
export async function agentPay(
  agentAddress: string,
  receiverAddress: string,
  amountWei: bigint
): Promise<string> {
  const wallet = await getAgentWallet(agentAddress);
  const tx = await wallet.sendTransaction({ to: receiverAddress, value: amountWei });
  await tx.wait();
  console.log(`[AgentKeyVault] Agent ${agentAddress.slice(0, 8)}... paid ${amountWei} wei → tx: ${tx.hash}`);
  return tx.hash;
}

/**
 * Autonomously buys a skill from the marketplace using the agent's own wallet.
 * This is the core "economic autonomy" action: the agent pays on-chain with no
 * per-step human signing. Returns the confirmed transaction hash.
 */
export async function agentBuySkill(
  agentAddress: string,
  skillId: number,
  priceWei: bigint
): Promise<string> {
  const wallet = await getAgentWallet(agentAddress);
  const contract = getMarketplaceContract(wallet);
  const tx = await contract.buySkill(skillId, { value: priceWei });
  await tx.wait();
  console.log(`[AgentKeyVault] Agent ${agentAddress.slice(0, 8)}... bought skill ${skillId} → tx: ${tx.hash}`);
  return tx.hash;
}
