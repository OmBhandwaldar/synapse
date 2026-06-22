/**
 * Seed one skill end-to-end on 0G so the demo has something to buy.
 *  - encrypts a sample skill (AES-256-GCM, same format as src/lib/encryption.ts)
 *  - uploads the wrapped payload to 0G Storage (same shape as src/lib/og/storage.ts)
 *  - lists it on the SkillMarketplace contract on 0G Chain
 *
 * Run:  node scripts/seed-skill.mjs
 */
import { readFileSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { randomBytes, createCipheriv, randomUUID } from 'crypto';
import { ethers } from 'ethers';
import { ZgFile, Indexer } from '@0gfoundation/0g-storage-ts-sdk';

// ── env ──────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const RPC = env.OG_RPC_URL;
const INDEXER_RPC = env.OG_INDEXER_RPC;
const PK = env.PLATFORM_PRIVATE_KEY;
const MARKET = env.NEXT_PUBLIC_SKILL_MARKETPLACE_ADDRESS;
const SKILL_KEY = Buffer.from(env.SKILL_ENCRYPTION_KEY, 'hex');

// ── 1. encrypt sample skill (iv|ciphertext|tag, base64) ───────────────────────
const source = readFileSync(
  new URL('../skill-examples/rps-markov-predictor.js', import.meta.url),
  'utf8'
);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', SKILL_KEY, iv);
const ct = Buffer.concat([cipher.update(source, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
const encrypted_source = Buffer.concat([iv, ct, tag]).toString('base64');

// ── 2. wrap + upload to 0G Storage ────────────────────────────────────────────
const seller = new ethers.Wallet(PK).address;
const skillUuid = randomUUID();
const payload = {
  cortex_skill: true,
  skill_id: skillUuid,
  encrypted_source,
  public_metadata: { name: 'RPS Markov Predictor', type: 'Logic', version: '1.0.0', seller },
};

const tmp = path.join(tmpdir(), `seed_${skillUuid}.json`);
writeFileSync(tmp, JSON.stringify(payload));

const provider = new ethers.JsonRpcProvider(RPC, 16602);
const signer = new ethers.Wallet(PK, provider);
const indexer = new Indexer(INDEXER_RPC);

console.log('Uploading skill to 0G Storage…');
const file = await ZgFile.fromFilePath(tmp);
const [tree, treeErr] = await file.merkleTree();
if (treeErr) throw new Error('merkle: ' + treeErr);
const [tx, upErr] = await indexer.upload(file, RPC, signer);
await file.close();
rmSync(tmp, { force: true });
if (upErr) throw new Error('upload: ' + upErr);
const rootHash = tree.rootHash();
console.log('✅ 0G Storage root hash:', rootHash);
console.log('   upload tx:', tx?.txHash ?? tx);

// ── 3. list on the marketplace contract ───────────────────────────────────────
const abi = [
  'function listSkill(string name,string description,string skillType,string version,uint256 price,string storageRootHash) returns (uint256)',
  'function skillCount() view returns (uint256)',
  'event SkillListed(uint256 indexed skillId, address indexed seller, uint256 price, string storageRootHash)',
];
const market = new ethers.Contract(MARKET, abi, signer);
const priceWei = ethers.parseEther('0.01'); // 0.01 0G

console.log('Listing skill on 0G Chain…');
const listTx = await market.listSkill(
  'RPS Markov Predictor',
  'Tracks opponent move patterns and counter-predicts.',
  'Logic',
  '1.0.0',
  priceWei,
  rootHash
);
const rcpt = await listTx.wait();
const count = await market.skillCount();
console.log('✅ Listed. skillCount =', count.toString());
console.log('   list tx:', rcpt.hash);
console.log('   explorer: https://chainscan-galileo.0g.ai/tx/' + rcpt.hash);
