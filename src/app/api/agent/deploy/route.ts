/**
 * POST /api/agent/deploy
 * Generates a new 0G (EVM) wallet for an agent, encrypts the private key,
 * saves it to Supabase, and returns the public address. The owner then funds
 * this address so the agent can transact autonomously.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import { subtle } from 'crypto';

// ─── Supabase (Service Role — server-side only) ──────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // NOT the anon key — this bypasses RLS
);

// ─── AES-256-GCM Encryption ─────────────────────────────────────────────────
async function encryptKey(secretKeyHex: string): Promise<string> {
  const masterKey = Buffer.from(process.env.AGENT_ENCRYPTION_KEY!, 'hex');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await subtle.importKey('raw', masterKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const data = new TextEncoder().encode(secretKeyHex);
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, data);
  // Store as iv:ciphertext in hex
  return Buffer.from(iv).toString('hex') + ':' + Buffer.from(ciphertext).toString('hex');
}

export async function POST(req: NextRequest) {
  try {
    const { ownerAddress, agentName } = await req.json();

    if (!ownerAddress || !agentName) {
      return NextResponse.json({ error: 'ownerAddress and agentName are required' }, { status: 400 });
    }

    // 1. Generate a fresh 0G (EVM) account for this agent
    const account = ethers.Wallet.createRandom();
    const agentAddress = account.address;
    const privateKeyHex = account.privateKey; // 0x-prefixed

    // 2. Encrypt the private key before saving
    const encryptedSk = await encryptKey(privateKeyHex);

    // 3. Save to Supabase vault
    const { error } = await supabase.from('agents').insert({
      owner_address: ownerAddress,
      agent_address: agentAddress,
      encrypted_secret_key: encryptedSk,
      agent_name: agentName,
    });

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: 'Failed to save agent' }, { status: 500 });
    }

    // 4. Return only the public address — never expose secret key
    return NextResponse.json({
      agentAddress,
      agentName,
      ownerAddress,
      message: 'Agent wallet created on 0G. Fund this address with testnet 0G so the agent can transact.',
    });
  } catch (err) {
    console.error('Deploy agent error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
