/**
 * 0G Compute helpers (server-side only).
 *
 * Primary path: Direct SDK (@0gfoundation/0g-compute-ts-sdk). The agent pays
 * for its own inference from its own 0G wallet via the on-chain ledger — this
 * is the "economic autonomy" story and exercises 0G Compute's verifiable
 * (TEE-signed) inference.
 *
 * Fallback path (OG_COMPUTE_MODE=router): OpenAI-compatible router endpoint,
 * a single API key. Same return shape, so callers don't care which is used.
 */
import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

const COMPUTE_MODE = (process.env.OG_COMPUTE_MODE ?? 'direct').toLowerCase();
const ROUTER_URL = process.env.OG_ROUTER_URL ?? 'https://router-api.0g.ai/v1';
const ROUTER_KEY = process.env.OG_ROUTER_KEY ?? '';
const ROUTER_MODEL = process.env.OG_ROUTER_MODEL ?? 'llama-3.3-70b-instruct';

// Amount the agent funds its compute sub-account with on first use (in 0G).
const FUND_AMOUNT = process.env.OG_COMPUTE_FUND ?? '0.1';
// 0G enforces a minimum balance to OPEN a ledger (currently 3 0G). The payer
// wallet must hold at least this much before the first inference in direct mode.
const LEDGER_MIN = Number(process.env.OG_LEDGER_MIN ?? '3');

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface InferenceResult {
  content: string;
  verified: boolean;
  provider: string;
}

/**
 * Run a chat-completion against 0G Compute.
 * @param agentWallet The agent's own ethers.Wallet (direct mode pays from it).
 */
export async function runInference(
  agentWallet: ethers.Wallet,
  messages: ChatMessage[]
): Promise<InferenceResult> {
  if (COMPUTE_MODE === 'router') {
    return runViaRouter(messages);
  }
  return runViaBroker(agentWallet, messages);
}

// ─── Direct SDK (broker) ───────────────────────────────────────────────────
async function runViaBroker(
  agentWallet: ethers.Wallet,
  messages: ChatMessage[]
): Promise<InferenceResult> {
  const broker = await createZGComputeNetworkBroker(agentWallet);

  // Ensure the ledger exists. 0G requires a minimum balance (LEDGER_MIN, ~3 0G)
  // to OPEN a ledger; after that we top up by FUND_AMOUNT. If the wallet can't
  // meet the minimum, surface a clear, actionable error (use router mode).
  try {
    await broker.ledger.addLedger(LEDGER_MIN);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (/already exists|LedgerExists/i.test(msg)) {
      try {
        await broker.ledger.depositFund(Number(FUND_AMOUNT));
      } catch {
        /* ledger exists with balance — fine */
      }
    } else if (/Minimum balance|insufficient/i.test(msg)) {
      throw new Error(
        `0G Compute ledger needs >= ${LEDGER_MIN} 0G in the agent wallet to open. ` +
          `Fund the wallet, or set OG_COMPUTE_MODE=router for the demo. (${msg})`
      );
    } else {
      throw e;
    }
  }

  // Discover a provider (prefer a chatbot service; fall back to the first one).
  const services = await broker.inference.listService();
  if (services.length === 0) throw new Error('No 0G Compute providers available');
  const chosen = services.find((s) => s.serviceType === 'chatbot') ?? services[0];
  const providerAddress = chosen.provider;

  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);

  // Acknowledge + fund the provider sub-account.
  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress);
  } catch {
    /* already acknowledged */
  }
  try {
    await broker.ledger.transferFund(
      providerAddress,
      'inference',
      BigInt(Math.floor(Number(FUND_AMOUNT) * 1e18))
    );
  } catch {
    /* already funded */
  }

  const body = JSON.stringify({ model, messages });
  const headers = await broker.inference.getRequestHeaders(providerAddress, body);

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

  // Verify TEE signature (best effort).
  let verified = false;
  try {
    const chatID = res.headers.get('ZG-Res-Key') || data.id;
    if (chatID) verified = (await broker.inference.processResponse(providerAddress, chatID)) ?? false;
  } catch {
    /* verification optional */
  }

  return { content, verified, provider: providerAddress };
}

// ─── Router fallback ────────────────────────────────────────────────────────
async function runViaRouter(messages: ChatMessage[]): Promise<InferenceResult> {
  if (!ROUTER_KEY) throw new Error('OG_ROUTER_KEY not set (required for router mode)');
  const res = await fetch(`${ROUTER_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ROUTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: ROUTER_MODEL, messages }),
  });
  if (!res.ok) {
    throw new Error(`0G Router inference failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    verified: false,
    provider: 'router',
  };
}
