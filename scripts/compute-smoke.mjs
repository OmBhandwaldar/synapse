/**
 * Live smoke test for 0G Compute (Direct SDK broker).
 * Funds a ledger from the platform wallet, lists providers, and runs one
 * chat completion to prove verifiable inference works on 0G.
 */
import { readFileSync } from 'fs';
import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const provider = new ethers.JsonRpcProvider(env.OG_RPC_URL, 16602);
const wallet = new ethers.Wallet(env.PLATFORM_PRIVATE_KEY, provider);

const broker = await createZGComputeNetworkBroker(wallet);
console.log('Broker created.');

try { await broker.ledger.addLedger(0.05); console.log('Ledger created (0.05 0G).'); }
catch (e) { console.log('addLedger:', e.message?.slice(0, 80)); try { await broker.ledger.depositFund(0.05); console.log('Deposited 0.05 0G.'); } catch (e2) { console.log('depositFund:', e2.message?.slice(0,80)); } }

const services = await broker.inference.listService();
console.log('Providers found:', services.length);
if (!services.length) { console.log('No providers available right now.'); process.exit(0); }
const chosen = services.find((s) => s.serviceType === 'chatbot') ?? services[0];
console.log('Using provider:', chosen.provider, 'model:', chosen.model);

const { endpoint, model } = await broker.inference.getServiceMetadata(chosen.provider);
try { await broker.inference.acknowledgeProviderSigner(chosen.provider); } catch (e) { console.log('ack:', e.message?.slice(0,60)); }
try { await broker.ledger.transferFund(chosen.provider, 'inference', BigInt(5e16)); } catch (e) { console.log('transferFund:', e.message?.slice(0,60)); }

const body = JSON.stringify({ model, messages: [{ role: 'user', content: 'In one word, what beats Rock in rock-paper-scissors?' }] });
const headers = await broker.inference.getRequestHeaders(chosen.provider, body);
const res = await fetch(`${endpoint}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
const data = await res.json();
console.log('Inference status:', res.status);
console.log('Answer:', data.choices?.[0]?.message?.content);

try {
  const chatID = res.headers.get('ZG-Res-Key') || data.id;
  const ok = chatID ? await broker.inference.processResponse(chosen.provider, chatID) : null;
  console.log('TEE-verified:', ok);
} catch (e) { console.log('verify:', e.message?.slice(0,60)); }
