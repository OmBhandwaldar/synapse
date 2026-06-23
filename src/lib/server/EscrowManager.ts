import fs from 'fs';
import path from 'path';
import algosdk from 'algosdk';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN = '';
const ALGOD_PORT = '';

function getAlgod() {
  return new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
}

export function getOrCreateEscrowAccount() {
  let address = process.env.PREDICTION_ESCROW_ADDRESS;
  let mnemonic = process.env.PREDICTION_ESCROW_MNEMONIC;

  if (address && mnemonic) {
    return { address, mnemonic };
  }

  // Check if .env.local exists and contains them (if written but not loaded yet)
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const addrMatch = envContent.match(/^PREDICTION_ESCROW_ADDRESS=(.*)$/m);
    const mnemMatch = envContent.match(/^PREDICTION_ESCROW_MNEMONIC=(.*)$/m);
    if (addrMatch && mnemMatch) {
      const envAddress = addrMatch[1].trim();
      const envMnemonic = mnemMatch[1].trim().replace(/^"|"$/g, '');
      process.env.PREDICTION_ESCROW_ADDRESS = envAddress;
      process.env.PREDICTION_ESCROW_MNEMONIC = envMnemonic;
      return { address: envAddress, mnemonic: envMnemonic };
    }
  }

  // Generate new account
  const account = algosdk.generateAccount();
  const newAddress = account.addr.toString();
  const newMnemonic = algosdk.secretKeyToMnemonic(account.sk);

  // Append to .env.local
  const appendText = `\n# ─── Prediction Escrow (Server Managed) ───\nPREDICTION_ESCROW_ADDRESS=${newAddress}\nPREDICTION_ESCROW_MNEMONIC="${newMnemonic}"\n`;
  try {
    fs.appendFileSync(envPath, appendText, 'utf8');
    console.log(`[EscrowManager] Generated new prediction escrow: ${newAddress} and saved to .env.local`);
  } catch (err) {
    console.error('[EscrowManager] Failed to write new escrow to .env.local:', err);
  }

  process.env.PREDICTION_ESCROW_ADDRESS = newAddress;
  process.env.PREDICTION_ESCROW_MNEMONIC = newMnemonic;

  return { address: newAddress, mnemonic: newMnemonic };
}

/**
 * Distribute prediction payouts for a match.
 */
export async function payoutPredictions(matchId: number, winnerAddress: string | null, agentA: string, agentB: string | null) {
  try {
    console.log(`[EscrowManager] Starting payouts for match #${matchId}. Winner: ${winnerAddress}`);

    // 1. Fetch predictions
    const { data: predictions, error: dbError } = await supabase
      .from('predictions')
      .select('*')
      .eq('match_id', matchId)
      .eq('settled', false);

    if (dbError) {
      console.error('[EscrowManager] Supabase error fetching predictions:', dbError);
      return;
    }

    if (!predictions || predictions.length === 0) {
      console.log(`[EscrowManager] No pending predictions found for match #${matchId}`);
      return;
    }

    // 2. Determine winning side
    let winningSide: 'p1' | 'p2' | 'draw' = 'draw';
    if (winnerAddress) {
      if (winnerAddress.toLowerCase() === agentA.toLowerCase()) {
        winningSide = 'p1';
      } else if (agentB && winnerAddress.toLowerCase() === agentB.toLowerCase()) {
        winningSide = 'p2';
      }
    }

    console.log(`[EscrowManager] Winning side resolved to: ${winningSide}`);

    // 3. Compute pools
    const totalPool = predictions.reduce((acc, p) => acc + Number(p.bet_amount), 0);
    const winningPool = predictions
      .filter(p => p.predicted_winner === winningSide)
      .reduce((acc, p) => acc + Number(p.bet_amount), 0);

    const algod = getAlgod();
    const escrow = getOrCreateEscrowAccount();
    let escrowAccount: algosdk.Account | null = null;
    try {
      escrowAccount = algosdk.mnemonicToSecretKey(escrow.mnemonic);
    } catch (err: any) {
      console.error('[EscrowManager] Invalid escrow mnemonic:', err.message);
    }

    // 4. Calculate payouts and execute on-chain transfers
    for (const pred of predictions) {
      let payoutAmount = 0;
      let memo = '';

      if (winningSide === 'draw' || winningPool === 0) {
        // Refund
        payoutAmount = Number(pred.bet_amount);
        memo = `Refund Match #${matchId} (Draw/No winning bets)`;
      } else if (pred.predicted_winner === winningSide) {
        // Winner share with 5% house commission and principal protection
        const opposingPool = totalPool - winningPool;
        if (opposingPool === 0) {
          // If no one bet on the opposing side, refund principal
          payoutAmount = Number(pred.bet_amount);
          memo = `Refund Match #${matchId} (No opposing bets)`;
        } else {
          // Deduct 5% fee from the payout but guarantee player at least gets their bet back
          const rawPayout = (Number(pred.bet_amount) / winningPool) * totalPool * 0.95;
          payoutAmount = Math.max(Number(pred.bet_amount), rawPayout);
          memo = `Payout Match #${matchId} Win`;
        }
      }

      if (payoutAmount > 0) {
        if (!escrowAccount) {
          console.error(`[EscrowManager] Skipped payout of ${payoutAmount} ALGO to ${pred.user_address} (Escrow not loaded)`);
          continue;
        }

        try {
          const sp = await algod.getTransactionParams().do();
          const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: escrow.address,
            receiver: pred.user_address,
            amount: Math.round(payoutAmount * 1_000_000), // to microALGOs
            suggestedParams: sp,
            note: new TextEncoder().encode(memo),
          });

          const signedTxn = txn.signTxn(escrowAccount.sk);
          const response = await algod.sendRawTransaction(signedTxn).do();
          await algosdk.waitForConfirmation(algod, response.txid, 4);

          console.log(`[EscrowManager] Paid ${payoutAmount.toFixed(4)} ALGO to ${pred.user_address}. Tx: ${response.txid}`);
        } catch (err: any) {
          console.error(`[EscrowManager] Failed on-chain payout to ${pred.user_address}:`, err.message);
        }
      }
    }

    // 5. Mark predictions as settled in DB
    const { error: updateError } = await supabase
      .from('predictions')
      .update({ settled: true })
      .eq('match_id', matchId);

    if (updateError) {
      console.error('[EscrowManager] Failed to update predictions to settled state in DB:', updateError);
    } else {
      console.log(`[EscrowManager] Settled all prediction records for match #${matchId} in database.`);
    }
  } catch (err: any) {
    console.error('[EscrowManager] Payout process error:', err);
  }
}
