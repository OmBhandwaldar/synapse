/**
 * deploy.mjs — Deploy SkillMarketplace + AgentRegistry to Algorand TestNet
 *
 * Usage:
 *   node deploy.mjs "word1 word2 ... word25"
 *   node deploy.mjs "your mnemonic" --contract=AgentRegistry
 *   node deploy.mjs "your mnemonic" --contract=SkillMarketplace
 *   node deploy.mjs "your mnemonic" --contract=all   (default)
 *
 * After success, copy the printed App IDs into .env.local
 */

import { execSync } from 'child_process';
import algosdk from 'algosdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────
const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN  = '';
const ALGOD_PORT   = '';

const ARTIFACTS = path.join(__dirname, 'contracts/artifacts');

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function compileTealToBytes(algod, source) {
  const result = await algod.compile(source).do();
  return new Uint8Array(Buffer.from(result.result, 'base64'));
}

async function waitAndGetAppId(algod, txid) {
  console.log(`   Waiting for confirmation...`);
  const result = await algosdk.waitForConfirmation(algod, txid, 8);
  return result.applicationIndex ?? result['application-index'];
}

function printBox(title, lines) {
  console.log('\n' + '═'.repeat(50));
  console.log(`  ✅ ${title}`);
  lines.forEach(l => console.log(`     ${l}`));
  console.log('═'.repeat(50));
}

// ─── Deploy: SkillMarketplace ─────────────────────────────────────────────────
async function deploySkillMarketplace(algod, account, sp) {
  console.log('\n📦 [1/2] Compiling SkillMarketplace...');
  execSync('npx tealscript contracts/SkillMarketplace.algo.ts contracts/artifacts --skip-algod', { stdio: 'inherit' });

  const approvalSource = fs.readFileSync(path.join(ARTIFACTS, 'SkillMarketplace.approval.teal'), 'utf8');
  const clearSource    = fs.readFileSync(path.join(ARTIFACTS, 'SkillMarketplace.clear.teal'), 'utf8');

  console.log('   Compiling TEAL bytecode...');
  const approvalProgram = await compileTealToBytes(algod, approvalSource);
  const clearProgram    = await compileTealToBytes(algod, clearSource);

  const abiMethod = new algosdk.ABIMethod({
    name: 'createApplication',
    desc: 'Initializes the contract.',
    args: [],
    returns: { type: 'void' },
  });

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: account.addr.toString(),
    suggestedParams: sp,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram,
    clearProgram,
    numGlobalByteSlices: 1, // admin
    numGlobalInts: 2,       // skillCount, platformFeeBps
    numLocalByteSlices: 0,
    numLocalInts: 0,
    appArgs: [abiMethod.getSelector()],
  });

  console.log('   Sending transaction...');
  const { txid } = await algod.sendRawTransaction(txn.signTxn(account.sk)).do();
  console.log(`   TX: ${txid}`);

  const appId = await waitAndGetAppId(algod, txid);
  printBox('SkillMarketplace Deployed', [
    `App ID:      ${appId}`,
    `App Address: ${algosdk.getApplicationAddress(appId)}`,
    `Add to .env.local:`,
    `  NEXT_PUBLIC_SKILL_MARKETPLACE_APP_ID=${appId}`,
  ]);
  return appId;
}

// ─── Deploy: AgentRegistry ───────────────────────────────────────────────────
async function deployAgentRegistry(algod, account, sp, skillMarketAppId = 0, deployFeeAlgo = 5) {
  console.log('\n📦 [2/2] Compiling AgentRegistry...');
  execSync('npx tealscript contracts/AgentRegistry.algo.ts contracts/artifacts --skip-algod', { stdio: 'inherit' });

  const approvalSource = fs.readFileSync(path.join(ARTIFACTS, 'AgentRegistry.approval.teal'), 'utf8');
  const clearSource    = fs.readFileSync(path.join(ARTIFACTS, 'AgentRegistry.clear.teal'), 'utf8');

  console.log('   Compiling TEAL bytecode...');
  const approvalProgram = await compileTealToBytes(algod, approvalSource);
  const clearProgram    = await compileTealToBytes(algod, clearSource);

  // createApplication(deployFee: uint64, skillMarketAppId: uint64)
  const deployFeeMicroAlgo = deployFeeAlgo * 1_000_000;
  const abiMethod = new algosdk.ABIMethod({
    name: 'createApplication',
    desc: 'Initializes the AgentRegistry contract.',
    args: [
      { name: 'deployFee', type: 'uint64' },
      { name: 'skillMarketAppId', type: 'uint64' },
    ],
    returns: { type: 'void' },
  });

  const encodedArgs = [
    abiMethod.getSelector(),
    algosdk.encodeUint64(deployFeeMicroAlgo),
    algosdk.encodeUint64(skillMarketAppId),
  ];

  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: account.addr.toString(),
    suggestedParams: sp,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram,
    clearProgram,
    numGlobalByteSlices: 1, // admin
    numGlobalInts: 4,       // agentCount, matchCount, deployFee, skillMarketAppId
    numLocalByteSlices: 0,
    numLocalInts: 0,
    appArgs: encodedArgs,
    extraPages: 1,
  });

  console.log('   Sending transaction...');
  const { txid } = await algod.sendRawTransaction(txn.signTxn(account.sk)).do();
  console.log(`   TX: ${txid}`);

  const appId = await waitAndGetAppId(algod, txid);
  printBox('AgentRegistry Deployed', [
    `App ID:      ${appId}`,
    `App Address: ${algosdk.getApplicationAddress(appId)}`,
    `Deploy Fee:  ${deployFeeAlgo} ALGO`,
    `Add to .env.local:`,
    `  NEXT_PUBLIC_AGENT_REGISTRY_APP_ID=${appId}`,
  ]);
  return appId;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function deploy() {
  const mnemonic = process.argv[2] || process.env.TESTNET_DEPLOYER_MNEMONIC;
  if (!mnemonic) {
    console.error('\nUsage: node deploy.mjs "<your 25-word mnemonic>" [--contract=all|SkillMarketplace|AgentRegistry]\n');
    process.exit(1);
  }

  // Parse which contract to deploy
  const contractArg = process.argv.find(a => a.startsWith('--contract='))?.split('=')[1] ?? 'all';
  const deployAll     = contractArg === 'all';
  const deployMarket  = deployAll || contractArg === 'SkillMarketplace';
  const deployAgents  = deployAll || contractArg === 'AgentRegistry';

  const account = algosdk.mnemonicToSecretKey(mnemonic);
  console.log(`\n🔑 Deployer: ${account.addr.toString()}`);

  // Ensure artifacts dir exists
  if (!fs.existsSync(ARTIFACTS)) fs.mkdirSync(ARTIFACTS, { recursive: true });

  const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
  const sp    = await algod.getTransactionParams().do();
  console.log(`📡 Network: Algorand TestNet | Round: ${sp.firstValid}`);

  let marketAppId = 0;

  if (deployMarket) {
    marketAppId = await deploySkillMarketplace(algod, account, sp);
  }

  if (deployAgents) {
    // If we just deployed the marketplace, use that ID; otherwise prompt
    const existingMarketId = Number(process.env.NEXT_PUBLIC_SKILL_MARKETPLACE_APP_ID ?? 0);
    const skillMarketId = marketAppId || existingMarketId;
    await deployAgentRegistry(algod, account, sp, skillMarketId, 0);
  }

  console.log('\n🎉 All done! Update your .env.local with the IDs above.\n');
}

deploy().catch(err => {
  console.error('\n❌ Deployment failed:', err.message ?? err);
  process.exit(1);
});
