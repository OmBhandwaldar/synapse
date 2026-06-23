'use client';

import React, { useState, useEffect, useCallback } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAlgorandWallet } from "@/components/Providers";
import { useDialog } from "@/components/DialogProvider";
import { RefreshCw, Zap, ExternalLink } from "lucide-react";

interface PredictionBook {
  id: number;
  game: string;
  pool: string;
  timeRemaining: string;
  status: number;
  p1: { name: string; odds: string; poolPercentage: number };
  p2: { name: string; odds: string; poolPercentage: number };
}

export default function PredictionsPage() {
  const { activeAddress, signTransaction } = useAlgorandWallet();
  const { alert, confirm, prompt } = useDialog();
  const [predictions, setPredictions] = useState<PredictionBook[]>([]);
  const [userBets, setUserBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [betting, setBetting] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const url = activeAddress 
        ? `/api/predictions/list?user=${activeAddress}` 
        : '/api/predictions/list';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPredictions(data.predictions ?? []);
        setUserBets(data.userBets ?? []);
      }
    } catch (err) {
      console.error("Failed to load predictions list:", err);
    } finally {
      setLoading(false);
    }
  }, [activeAddress]);

  const fetchBalance = useCallback(async () => {
    if (!activeAddress) return;
    try {
      const algodUrl = 'https://testnet-api.algonode.cloud';
      const balanceRes = await fetch(`${algodUrl}/v2/accounts/${activeAddress}`);
      if (balanceRes.ok) {
        const info = await balanceRes.json();
        const algoBal = info.amount / 1_000_000;
        setBalance(algoBal);
      }
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  }, [activeAddress]);

  useEffect(() => {
    loadData();
    fetchBalance();
  }, [loadData, fetchBalance]);

  const handlePlaceBet = async (matchId: number, predictedWinner: 'p1' | 'p2', playerName: string) => {
    if (!activeAddress) {
      await alert("Please connect your wallet first!");
      return;
    }

    const amountStr = await prompt(`Enter bet amount in ALGO for ${playerName}:`);
    if (!amountStr) return; // user cancelled

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      await alert("Invalid bet amount entered.");
      return;
    }

    if (balance !== null && amount > balance) {
      await alert("Insufficient ALGO balance for this bet.");
      return;
    }

    setBetting(matchId);
    try {
      // 1. Build unsigned transaction on backend
      const res = await fetch('/api/predictions/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: activeAddress,
          matchId,
          predictedWinner,
          betAmount: amount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to build transaction');

      // 2. Sign transaction via connected wallet
      const algosdk = await import('algosdk');
      const txnBytes = Buffer.from(data.txn, 'base64');
      const unsignedTxn = algosdk.decodeUnsignedTransaction(txnBytes);
      
      const signed = await signTransaction([[{ txn: unsignedTxn }]]);
      const signedB64 = Buffer.from(signed[0]).toString('base64');

      // 3. Submit signed txn and save record to Supabase
      const submitRes = await fetch('/api/predictions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTxn: signedB64,
          userAddress: activeAddress,
          matchId,
          predictedWinner,
          betAmount: amount,
        }),
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitData.error || 'Submission failed');

      await alert(`🎉 Prediction registered!\nTx ID: ${submitData.txId.slice(0, 16)}...`);
      loadData();
      fetchBalance();
    } catch (err: any) {
      console.error(err);
      await alert(`❌ Bet failed: ${err.message}`);
    } finally {
      setBetting(null);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <SectionHeader 
        title="PREDICTIONS" 
        // jpTitle="予測"
        subtitle="Put your testnet tokens where your mouth is. Bet on AI match outcomes." 
        action={
          <button
            onClick={() => { loadData(); fetchBalance(); }}
            className="punk-btn bg-white text-inkBlack px-4 py-2 font-heading text-sm flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            REFRESH
          </button>
        }
      />

      {/* User Stats Bar */}
      <div className="punk-card p-4 flex flex-col md:flex-row items-center justify-between gap-4 border-3 border-inkBlack">
        <div className="flex gap-6 text-sm font-body">
          <div>
            <span className="text-streetGray">Your Balance: </span>
            <span className="text-inkBlack font-mono font-bold">
              {balance !== null ? `${balance.toFixed(2)} ALGO` : '-- ALGO'}
            </span>
          </div>
          <div>
            <span className="text-streetGray">Active Bets: </span>
            <span className="text-punkPurple font-mono font-bold">
              {userBets.filter(b => !b.settled).length}
            </span>
          </div>
          <div>
            <span className="text-streetGray">Total Bets: </span>
            <span className="text-inkBlack font-mono font-bold">{userBets.length}</span>
          </div>
        </div>
        {!activeAddress && <div className="text-xs font-mono text-punkRed animate-pulse">🔐 Connect wallet to place bets</div>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl text-inkBlack font-heading tracking-widest uppercase flex items-center gap-3">
            Open Books
            <span className="font-jp text-lg text-punkPink opacity-50 font-bold">賭け</span>
          </h2>
          <div className="flex gap-2 items-center">
            <span className="w-3 h-3 rounded-full bg-punkGreen animate-pulse" />
            <span className="text-streetGray text-sm font-mono font-bold">Accepting Bets</span>
          </div>
        </div>
        
        {loading ? (
          <p className="font-mono text-xs text-streetGray animate-pulse">Fetching open books...</p>
        ) : predictions.length === 0 ? (
          <div className="punk-card bg-white p-8 text-center border-3 border-inkBlack">
            <div className="text-3xl mb-3">🏜️</div>
            <p className="font-heading text-lg uppercase text-inkBlack">No active matches accepting predictions</p>
            <p className="font-mono text-xs text-streetGray mt-1">Predictions will open when lobby matches are created</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {predictions.map((book) => (
              <Card key={book.id} variant="highlight" className="p-6 relative border-3 border-inkBlack">
                <div className="flex justify-between items-center mb-6">
                  <Badge label={`${book.game} · Match #${book.id}`} color="purple" />
                  <div className="text-right">
                    <div className="text-inkBlack text-sm font-mono font-bold">{book.pool}</div>
                    <div className="text-punkRed text-xs font-mono font-bold">Status: {book.timeRemaining}</div>
                  </div>
                </div>
                
                <div className="flex justify-between items-end gap-4">
                  
                  {/* Player 1 */}
                  <div className="flex-1 punk-card punk-card-pink p-4 text-center group">
                    <p className="text-inkBlack font-body font-bold truncate mb-1">{book.p1.name}</p>
                    <p className="text-punkPink font-heading tracking-widest text-2xl group-hover:scale-105 transition-transform">{book.p1.odds}</p>
                    
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-borderSoft rounded-full mt-3 overflow-hidden">
                      <div className="h-full bg-punkPink rounded-full" style={{ width: `${book.p1.poolPercentage}%` }} />
                    </div>
                    <p className="text-streetGray text-[10px] uppercase tracking-wider mt-1 font-bold">{book.p1.poolPercentage}% of pool</p>
                    
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={() => handlePlaceBet(book.id, 'p1', book.p1.name)}
                      disabled={betting !== null}
                      className="w-full mt-4 text-xs"
                    >
                      {betting === book.id ? 'Betting...' : `Bet ${book.p1.name.slice(0, 10)}`}
                    </Button>
                  </div>

                  <div className="text-inkBlack font-heading text-xl pb-16">VS</div>

                  {/* Player 2 */}
                  <div className="flex-1 punk-card punk-card-purple p-4 text-center group">
                    <p className="text-inkBlack font-body font-bold truncate mb-1">{book.p2.name}</p>
                    <p className="text-punkPurple font-heading tracking-widest text-2xl group-hover:scale-105 transition-transform">{book.p2.odds}</p>
                    
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-borderSoft rounded-full mt-3 overflow-hidden">
                      <div className="h-full bg-punkPurple rounded-full" style={{ width: `${book.p2.poolPercentage}%` }} />
                    </div>
                    <p className="text-streetGray text-[10px] uppercase tracking-wider mt-1 font-bold">{book.p2.poolPercentage}% of pool</p>

                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => handlePlaceBet(book.id, 'p2', book.p2.name)}
                      disabled={betting !== null || book.p2.name === 'Open Slot'}
                      className="w-full mt-4 text-xs"
                    >
                      {betting === book.id ? 'Betting...' : `Bet ${book.p2.name.slice(0, 10)}`}
                    </Button>
                  </div>

                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* User Bet History Table */}
      {activeAddress && userBets.length > 0 && (
        <div className="pt-8">
          <div className="flex items-center gap-3 mb-6 pb-2 border-b-4 border-inkBlack">
            <h2 className="text-2xl text-inkBlack font-heading tracking-widest uppercase">Your Bets</h2>
            <span className="sticker sticker-purple text-[9px] font-mono">{userBets.length} Bets</span>
          </div>

          <div className="punk-card bg-white p-5 overflow-x-auto border-3 border-inkBlack">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b-2 border-inkBlack pb-2 text-streetGray">
                  <th className="py-2">Match ID</th>
                  <th>Bet Amount</th>
                  <th>Prediction</th>
                  <th>Status</th>
                  <th>TX Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderSoft">
                {userBets.map((bet: any) => (
                  <tr key={bet.id} className="hover:bg-punkPink/5 transition-colors">
                    <td className="py-3 font-bold">Match #{bet.match_id}</td>
                    <td className="text-punkGreen font-bold">{bet.bet_amount} ALGO</td>
                    <td className="uppercase font-bold text-punkPurple">
                      {bet.predicted_winner === 'p1' ? 'Player 1' : 'Player 2'}
                    </td>
                    <td>
                      {bet.settled ? (
                        <span className="bg-punkGreen/20 text-punkGreen px-2 py-0.5 rounded font-bold border-2 border-punkGreen/30 uppercase text-[9px]">Settled</span>
                      ) : (
                        <span className="bg-punkYellow/20 text-punkYellow px-2 py-0.5 rounded font-bold border-2 border-punkYellow/30 uppercase text-[9px]">Pending Settle</span>
                      )}
                    </td>
                    <td>
                      <a href={`https://testnet.explorer.perawallet.app/tx/${bet.tx_id}`} target="_blank" rel="noopener noreferrer" className="text-punkBlue hover:underline flex items-center gap-1 font-bold">
                        {bet.tx_id.slice(0, 10)}... <ExternalLink size={10} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
