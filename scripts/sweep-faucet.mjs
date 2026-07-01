/**
 * Sweep the 10 faucet wallets into the platform wallet.
 * Keys live in the session scratchpad (never committed).
 *
 *   node scripts/sweep-faucet.mjs
 */
import { readFileSync } from 'fs';
import { ethers } from 'ethers';

const KEYS_PATH =
  process.env.FAUCET_KEYS ??
  '/private/tmp/claude-501/-Users-omb-sanctum-zero-cup/ce7d9bed-592a-4f4d-8c9c-d832cde2873b/scratchpad/faucet-wallets.json';

const RPC = 'https://evmrpc-testnet.0g.ai';
const PLATFORM = process.env.PLATFORM_ADDRESS ?? '0x1724DACded2552523F39a054adc75Bd965c94fce';

// 0G rejects sub-2-gwei tips; keep a small gas reserve per sweep.
const maxPriorityFeePerGas = ethers.parseUnits('2', 'gwei');
const maxFeePerGas = ethers.parseUnits('5', 'gwei');
const GAS_LIMIT = 21000n;
const gasReserve = maxFeePerGas * GAS_LIMIT; // wei to leave behind for gas

const provider = new ethers.JsonRpcProvider(RPC, 16602);
const wallets = JSON.parse(readFileSync(KEYS_PATH, 'utf8'));

console.log(`Sweeping ${wallets.length} wallets -> ${PLATFORM}\n`);

let swept = 0n;
for (let i = 0; i < wallets.length; i++) {
  const w = new ethers.Wallet(wallets[i].privateKey, provider);
  const bal = await provider.getBalance(w.address);
  if (bal <= gasReserve) {
    console.log(`${(i + 1).toString().padStart(2)}. ${w.address}  ${ethers.formatEther(bal)} 0G  — skip (too low)`);
    continue;
  }
  const value = bal - gasReserve;
  try {
    const tx = await w.sendTransaction({
      to: PLATFORM, value, gasLimit: GAS_LIMIT, maxFeePerGas, maxPriorityFeePerGas,
    });
    await tx.wait();
    swept += value;
    console.log(`${(i + 1).toString().padStart(2)}. ${w.address}  sent ${ethers.formatEther(value)} 0G  (${tx.hash.slice(0, 14)}…)`);
  } catch (e) {
    console.log(`${(i + 1).toString().padStart(2)}. ${w.address}  ERROR: ${String(e.message).slice(0, 80)}`);
  }
}

const platformBal = await provider.getBalance(PLATFORM);
console.log(`\nSwept total: ${ethers.formatEther(swept)} 0G`);
console.log(`Platform wallet ${PLATFORM} now holds: ${ethers.formatEther(platformBal)} 0G`);
