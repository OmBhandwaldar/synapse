/**
 * 0G Compute helpers (server-side only).
 *
 * Primary path (OG_COMPUTE_MODE=direct): Direct SDK against a SHARED ledger
 * owned by the platform wallet. Inference is TEE-attested — `verified` comes
 * from the broker's processResponse(). One 3 0G ledger (opened once via
 * scripts/open-ledger.mjs) covers all agents' reasoning.
 *
 * Fallback path (OG_COMPUTE_MODE=router, or any direct-mode failure): the
 * OpenAI-compatible router endpoint. Same return shape, verified: false.
 *
 * Note: the shared ledger means the platform pays for compute (not each agent).
 * The agent's economic autonomy remains the on-chain skill BUY (its own wallet).
 */
import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import { getProvider } from './chain';

const COMPUTE_MODE = (process.env.OG_COMPUTE_MODE ?? 'router').toLowerCase();
const ROUTER_URL = process.env.OG_ROUTER_URL ?? 'https://router-api.0g.ai/v1';
const ROUTER_KEY = process.env.OG_ROUTER_KEY ?? '';
const ROUTER_MODEL = process.env.OG_ROUTER_MODEL ?? 'llama-3.3-70b-instruct';
const PROVIDER_PIN = process.env.OG_COMPUTE_PROVIDER ?? ''; // optional: pin a provider address
const GAS = 5_000_000_000; // 5 gwei — 0G rejects sub-2-gwei tips

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface InferenceResult {
  content: string;
  verified: boolean;
  provider: string;
}

// ─── Shared broker + provider (cached across calls) ──────────────────────────
let brokerPromise: Promise<any> | null = null;
let cachedProvider: string | null = null;

function platformSigner(): ethers.Wallet {
  const pk = process.env.PLATFORM_PRIVATE_KEY;
  if (!pk) throw new Error('PLATFORM_PRIVATE_KEY not set (required for direct compute)');
  return new ethers.Wallet(pk, getProvider());
}

async function getBroker() {
  if (!brokerPromise) {
    brokerPromise = createZGComputeNetworkBroker(platformSigner(), undefined, undefined, undefined, GAS);
  }
  return brokerPromise;
}

async function getProviderAddress(broker: any): Promise<string> {
  if (cachedProvider) return cachedProvider;
  if (PROVIDER_PIN) { cachedProvider = PROVIDER_PIN; return cachedProvider; }
  const services = await broker.inference.listService();
  if (!services.length) throw new Error('No 0G Compute providers available');
  const chosen = services.find((s: any) => s.serviceType === 'chatbot') ?? services[0];
  cachedProvider = chosen.provider;
  // Best-effort acknowledge once (ledger + sub-account are pre-funded by open-ledger.mjs).
  try { await broker.inference.acknowledgeProviderSigner(cachedProvider); } catch { /* already acked */ }
  return cachedProvider as string;
}

export async function runInference(
  _agentWallet: ethers.Wallet | null,
  messages: ChatMessage[]
): Promise<InferenceResult> {
  if (COMPUTE_MODE === 'direct') {
    try {
      return await runViaBroker(messages);
    } catch (e: any) {
      console.warn('[0G Compute] direct failed, falling back to router:', e?.message ?? e);
      return runViaRouter(messages);
    }
  }
  return runViaRouter(messages);
}

// ─── Direct SDK (shared platform ledger, TEE-verified) ───────────────────────
async function runViaBroker(messages: ChatMessage[]): Promise<InferenceResult> {
  const broker = await getBroker();
  const providerAddr = await getProviderAddress(broker);

  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddr);
  const body = JSON.stringify({ model, messages });
  const headers = await broker.inference.getRequestHeaders(providerAddr, body);

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers as unknown as Record<string, string>) },
    body,
  });
  if (!res.ok) {
    throw new Error(`0G Compute inference failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';

  let verified = false;
  try {
    const chatID = res.headers.get('ZG-Res-Key') || data.id;
    if (chatID) verified = (await broker.inference.processResponse(providerAddr, chatID)) === true;
  } catch { /* verification optional */ }

  return { content, verified, provider: providerAddr };
}

// ─── Router fallback ─────────────────────────────────────────────────────────
async function runViaRouter(messages: ChatMessage[]): Promise<InferenceResult> {
  if (!ROUTER_KEY) throw new Error('OG_ROUTER_KEY not set (required for router mode)');
  const res = await fetch(`${ROUTER_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ROUTER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: ROUTER_MODEL, messages }),
  });
  if (!res.ok) {
    throw new Error(`0G Router inference failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { content: data.choices?.[0]?.message?.content ?? '', verified: false, provider: 'router' };
}
