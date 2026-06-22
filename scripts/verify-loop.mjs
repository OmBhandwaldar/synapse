/**
 * End-to-end verification of the autonomous purchase loop on 0G:
 *  1. read the listed skill from the contract
 *  2. create a fresh agent wallet, fund it from the platform wallet
 *  3. agent autonomously calls buySkill() from its OWN wallet
 *  4. assert hasAccess() flipped on-chain
 *  5. download the skill from 0G Storage by root hash + decrypt, assert it matches
 */
import { readFileSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { createDecipheriv } from 'crypto';
import { ethers } from 'ethers';
import { Indexer } from '@0gfoundation/0g-storage-ts-sdk';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const provider = new ethers.JsonRpcProvider(env.OG_RPC_URL, 16602);
const platform = new ethers.Wallet(env.PLATFORM_PRIVATE_KEY, provider);
const SKILL_KEY = Buffer.from(env.SKILL_ENCRYPTION_KEY, 'hex');

const abi = [
  'function getSkill(uint256) view returns (tuple(string name,string description,string skillType,string version,uint256 price,address seller,string storageRootHash,uint256 soldCount,uint256 listedAt,bool active))',
  'function hasAccess(uint256,address) view returns (bool)',
  'function buySkill(uint256) payable',
];

const skillId = 1;

// 1. read skill
const marketRead = new ethers.Contract(env.NEXT_PUBLIC_SKILL_MARKETPLACE_ADDRESS, abi, provider);
const s = await marketRead.getSkill(skillId);
console.log(`Skill #${skillId}: "${s.name}"  price=${ethers.formatEther(s.price)} 0G  root=${s.storageRootHash.slice(0,12)}…  sold=${s.soldCount}`);

// 2. fresh agent wallet + fund it
const agent = ethers.Wallet.createRandom().connect(provider);
console.log('Agent wallet:', agent.address);
const fundTx = await platform.sendTransaction({ to: agent.address, value: ethers.parseEther('0.05') });
await fundTx.wait();
console.log('Funded agent with 0.05 0G (tx', fundTx.hash.slice(0,12) + '…)');

console.log('hasAccess BEFORE:', await marketRead.hasAccess(skillId, agent.address));

// 3. agent autonomously buys from its own wallet
const market = new ethers.Contract(env.NEXT_PUBLIC_SKILL_MARKETPLACE_ADDRESS, abi, agent);
const buyTx = await market.buySkill(skillId, { value: s.price });
const buyRcpt = await buyTx.wait();
console.log('Agent bought skill autonomously (tx', buyRcpt.hash.slice(0,12) + '…)');

// 4. assert access flipped
const after = await marketRead.hasAccess(skillId, agent.address);
console.log('hasAccess AFTER: ', after);
if (!after) throw new Error('FAIL: access did not flip');

// 5. download from 0G Storage + decrypt
const indexer = new Indexer(env.OG_INDEXER_RPC);
const out = path.join(tmpdir(), `dl_${Date.now()}.json`);
const dlErr = await indexer.download(s.storageRootHash, out, true);
if (dlErr) throw new Error('download: ' + dlErr);
const payload = JSON.parse(readFileSync(out, 'utf8'));
rmSync(out, { force: true });

const raw = Buffer.from(payload.encrypted_source, 'base64');
const iv = raw.subarray(0, 12);
const tag = raw.subarray(raw.length - 16);
const ct = raw.subarray(12, raw.length - 16);
const decipher = createDecipheriv('aes-256-gcm', SKILL_KEY, iv);
decipher.setAuthTag(tag);
const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');

const expected = readFileSync(new URL('../skill-examples/rps-markov-predictor.js', import.meta.url), 'utf8');
console.log('Decrypted skill matches source:', plain === expected);
if (plain !== expected) throw new Error('FAIL: decrypted content mismatch');

console.log('\n✅ FULL LOOP VERIFIED ON 0G: list → fund → autonomous buy → access flip → storage fetch + decrypt');
console.log('   buy tx: https://chainscan-galileo.0g.ai/tx/' + buyRcpt.hash);
