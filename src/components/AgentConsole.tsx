'use client';

import { useMemo, useState } from 'react';
import {
  Cpu, Brain, ShoppingCart, ExternalLink, Loader2, CheckCircle,
  AlertCircle, Wallet, Copy, ShieldCheck,
} from 'lucide-react';
import type { SkillListing } from '@/lib/SkillMarketplaceClient';

interface ConsoleAgent {
  agentAddress: string;
  agentName: string;
  balance?: number;
}

const EXPLORER = 'https://chainscan-galileo.0g.ai';
const FAUCET = 'https://faucet.0g.ai';

export function AgentConsole({
  agent,
  skills,
  onPurchased,
}: {
  agent: ConsoleAgent | null;
  skills: SkillListing[];
  onPurchased?: () => void;
}) {
  const [skillId, setSkillId] = useState<number | ''>('');
  const [copied, setCopied] = useState(false);

  async function copyAddr(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = addr; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const [buyState, setBuyState] = useState<'idle' | 'buying' | 'done' | 'error'>('idle');
  const [buyRes, setBuyRes] = useState<any>(null);
  const [buyErr, setBuyErr] = useState('');

  const [thinkState, setThinkState] = useState<'idle' | 'thinking' | 'done' | 'error'>('idle');
  const [thought, setThought] = useState<any>(null);
  const [thinkErr, setThinkErr] = useState('');

  const cheapest = useMemo(() => (skills.length ? Math.min(...skills.map(s => s.price)) : 0.01), [skills]);
  // Need the cheapest skill price + a little gas headroom to act.
  const minNeeded = cheapest + 0.003;
  const lowFunds = agent?.balance !== undefined && agent.balance < minNeeded;

  async function handleAutonomousBuy() {
    if (!agent || skillId === '') return;
    setBuyState('buying'); setBuyErr(''); setBuyRes(null);
    try {
      const res = await fetch('/api/skills/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentAddress: agent.agentAddress, skillId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Purchase failed');
      setBuyRes(data); setBuyState('done');
      onPurchased?.();
    } catch (e: any) {
      setBuyErr(e.message); setBuyState('error');
    }
  }

  async function handleThink() {
    if (!agent) return;
    setThinkState('thinking'); setThinkErr(''); setThought(null);
    try {
      const res = await fetch('/api/llm/x402', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentAddress: agent.agentAddress,
          agentName: agent.agentName,
          gameId: 'rps',
          state: { round: 3, note: 'Opponent has played Rock twice in a row.' },
          history: [
            { turnNumber: 1, p1Move: 'R', p2Move: 'R' },
            { turnNumber: 2, p1Move: 'R', p2Move: 'R' },
          ],
          skillMove: 'R',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Inference failed');
      setThought(data); setThinkState('done');
    } catch (e: any) {
      setThinkErr(e.message); setThinkState('error');
    }
  }

  if (!agent) {
    return (
      <div className="punk-card min-h-[460px] flex items-center justify-center p-8 text-center">
        <div>
          <Cpu size={40} className="mx-auto mb-4 text-violet/40" />
          <p className="font-heading text-2xl uppercase tracking-widest text-inkBlack mb-2">Agent Console</p>
          <p className="text-streetGray text-sm font-mono max-w-sm mx-auto">
            Select an agent from the left to let it act autonomously — buy skills from its own wallet and reason on 0G Compute.
          </p>
        </div>
      </div>
    );
  }

  const short = `${agent.agentAddress.slice(0, 6)}…${agent.agentAddress.slice(-4)}`;

  return (
    <div className="space-y-6">
      {/* Selected agent header */}
      <div className="punk-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet/15 border border-[rgba(139,92,246,0.4)]">
              <Cpu size={20} className="text-violetBright" />
            </div>
            <div>
              <p className="font-heading text-lg uppercase tracking-tight text-inkBlack">{agent.agentName}</p>
              <button
                onClick={() => copyAddr(agent.agentAddress)}
                className={`font-mono text-[11px] flex items-center gap-1 transition-colors ${copied ? 'text-punkGreen' : 'text-streetGray hover:text-violetBright'}`}
                title="Copy agent address"
              >
                {short} {copied ? <><CheckCircle size={11} /> copied</> : <Copy size={10} />}
              </button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono text-streetGray uppercase tracking-widest">Agent Wallet</p>
            <p className="font-mono font-bold text-violetBright flex items-center gap-1 justify-end">
              <Wallet size={13} /> {agent.balance?.toFixed(4) ?? '—'} 0G
            </p>
          </div>
        </div>

        {lowFunds && (
          <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-punkRed/10 border border-punkRed/40">
            <AlertCircle size={14} className="text-punkRed shrink-0" />
            <p className="text-punkRed text-xs font-mono">
              Low funds. Fund the agent at{' '}
              <a href={FAUCET} target="_blank" rel="noreferrer" className="underline">faucet.0g.ai</a>{' '}
              so it can pay for skills + gas.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── Autonomous purchase ── */}
        <div className="punk-card punk-card-purple p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-violetBright" />
            <h3 className="font-heading text-sm uppercase tracking-widest text-inkBlack">Autonomous Purchase</h3>
          </div>
          <p className="text-streetGray text-xs font-mono leading-relaxed">
            The agent buys a skill <span className="text-violetBright">from its own wallet</span> on 0G Chain — no human signature.
          </p>

          <select
            value={skillId}
            onChange={e => setSkillId(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full bg-bgDark border border-[rgba(139,92,246,0.3)] rounded-lg font-mono text-sm text-inkBlack px-3 py-2 focus:outline-none focus:border-violet"
          >
            <option value="">Select a skill to acquire…</option>
            {skills.map(s => (
              <option key={s.id} value={s.id}>#{s.id} · {s.name} — {s.price} 0G</option>
            ))}
          </select>

          <button
            onClick={handleAutonomousBuy}
            disabled={skillId === '' || buyState === 'buying' || lowFunds}
            className="punk-btn bg-violet text-white w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {buyState === 'buying'
              ? (<><Loader2 size={14} className="animate-spin mr-2" /> Agent paying…</>)
              : 'Let agent buy autonomously'}
          </button>

          {buyState === 'done' && buyRes && (
            <div className="p-3 rounded-lg bg-punkGreen/10 border border-punkGreen/40 space-y-1">
              {buyRes.alreadyOwned ? (
                <p className="text-punkGreen text-xs font-mono flex items-center gap-1">
                  <CheckCircle size={13} /> Agent already owns skill #{buyRes.skillId}.
                </p>
              ) : (
                <>
                  <p className="text-punkGreen text-xs font-mono flex items-center gap-1">
                    <CheckCircle size={13} /> Agent paid {buyRes.pricePaid} 0G from its own wallet.
                  </p>
                  <a
                    href={buyRes.explorer ?? `${EXPLORER}/tx/${buyRes.txHash}`}
                    target="_blank" rel="noreferrer"
                    className="text-violetBright hover:underline font-mono text-[10px] flex items-center gap-1 break-all"
                  >
                    {String(buyRes.txHash).slice(0, 26)}… <ExternalLink size={10} />
                  </a>
                </>
              )}
            </div>
          )}
          {buyState === 'error' && (
            <p className="text-punkRed text-xs font-mono">{buyErr}</p>
          )}
        </div>

        {/* ── 0G Compute brain ── */}
        <div className="punk-card punk-card-blue p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-punkBlue" />
            <h3 className="font-heading text-sm uppercase tracking-widest text-inkBlack">0G Compute Brain</h3>
          </div>
          <p className="text-streetGray text-xs font-mono leading-relaxed">
            The agent reasons over a game scenario using <span className="text-punkBlue">verifiable 0G Compute</span> inference.
          </p>

          <div className="bg-bgDark border border-[rgba(96,165,250,0.25)] rounded-lg p-3 font-mono text-[10px] text-streetGray leading-relaxed">
            <span className="text-streetGray/70">scenario:</span> Rock-Paper-Scissors, opponent played Rock twice. Skill suggests Rock.
          </div>

          <button
            onClick={handleThink}
            disabled={thinkState === 'thinking'}
            className="punk-btn bg-punkBlue text-white w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {thinkState === 'thinking'
              ? (<><Loader2 size={14} className="animate-spin mr-2" /> Thinking on 0G…</>)
              : 'Ask the agent to reason'}
          </button>

          {thinkState === 'done' && thought && (
            <div className="p-3 rounded-lg bg-punkBlue/10 border border-punkBlue/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-streetGray uppercase tracking-widest">Decision</span>
                <span className="font-heading text-lg text-punkBlue uppercase">{String(thought.move)}</span>
              </div>
              <p className="text-inkBlack text-xs font-mono leading-relaxed">{thought.reasoning}</p>
              <div className="flex items-center gap-2 pt-1 border-t border-borderSoft">
                <ShieldCheck size={12} className={thought.verified ? 'text-punkGreen' : 'text-streetGray'} />
                <span className="font-mono text-[9px] text-streetGray uppercase tracking-widest">
                  0G Compute{thought.verified ? ' · TEE-verified' : ''}
                  {thought.provider && thought.provider !== 'router' ? ` · ${String(thought.provider).slice(0, 8)}…` : ''}
                </span>
              </div>
            </div>
          )}
          {thinkState === 'error' && (
            <p className="text-punkRed text-xs font-mono">{thinkErr}</p>
          )}
        </div>
      </div>
    </div>
  );
}
