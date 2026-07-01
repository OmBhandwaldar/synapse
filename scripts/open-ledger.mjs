/**
 * RISK GATE — open the shared 0G Compute ledger (platform wallet) and prove
 * a real inference returns verified: true (TEE-attested).
 *
 * Run once:  node scripts/open-ledger.mjs
 * If this prints "verified: true", the app refactor is safe. If not, stay on router.
 */
import { readFileSync } from 'fs';
import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

// ── load platform key from .env.local ────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const RPC = env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const provider = new ethers.JsonRpcProvider(RPC, 16602);
const wallet = new ethers.Wallet(env.PLATFORM_PRIVATE_KEY, provider);
const GAS = 5_000_000_000; // 5 gwei — 0G rejects sub-2-gwei tips

console.log('Platform wallet:', wallet.address);
console.log('Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), '0G\n');

const broker = await createZGComputeNetworkBroker(wallet, undefined, undefined, undefined, GAS);
console.log('Broker created.');

// ── 1. ensure ledger exists (3 0G minimum) ───────────────────────────────────
try {
  const led = await broker.ledger.getLedger();
  console.log('Ledger already exists. balance(raw):', led?.[1]?.toString?.() ?? led?.balance?.toString?.() ?? '(unknown)');
} catch {
  console.log('No ledger — creating with 3 0G…');
  await broker.ledger.addLedger(3);
  console.log('✅ Ledger created (3 0G).');
}

// ── 2. pick a chatbot provider ────────────────────────────────────────────────
const services = await broker.inference.listService();
console.log('Providers:', services.length);
const chosen = services.find(s => s.serviceType === 'chatbot') ?? services[0];
if (!chosen) { console.log('No providers available.'); process.exit(1); }
const providerAddr = chosen.provider;
console.log('Using provider:', providerAddr, '| model:', chosen.model);

// ── 3. acknowledge + fund the provider sub-account ────────────────────────────
try { await broker.inference.acknowledgeProviderSigner(providerAddr); console.log('Acknowledged provider signer.'); }
catch (e) { console.log('ack:', String(e.message).slice(0, 90)); }
try { await broker.ledger.transferFund(providerAddr, 'inference', BigInt(1e18)); console.log('Funded provider sub-account (1 0G).'); }
catch (e) { console.log('transferFund:', String(e.message).slice(0, 90)); }

// ── 4. one real inference + verify ────────────────────────────────────────────
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddr);
const body = JSON.stringify({
  model,
  messages: [{ role: 'user', content: 'In one word, what beats Rock in rock-paper-scissors?' }],
});
const headers = await broker.inference.getRequestHeaders(providerAddr, body);
const res = await fetch(`${endpoint}/chat/completions`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body,
});
const data = await res.json();
console.log('\nHTTP', res.status, '| answer:', data.choices?.[0]?.message?.content);

const chatID = res.headers.get('ZG-Res-Key') || data.id;
let verified = null;
try { verified = await broker.inference.processResponse(providerAddr, chatID); }
catch (e) { console.log('processResponse:', String(e.message).slice(0, 90)); }

console.log('\n==============================');
console.log('verified:', verified);
console.log(verified === true ? '✅ GATE PASSED — proceed with the refactor.' : '⚠️ Not verified — investigate or stay on router.');
console.log('==============================');
