'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Cpu, ShoppingCart, ExternalLink, Loader2, CheckCircle,
  AlertCircle, Wallet, Copy, ShieldCheck, Zap, Terminal,
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

  // Skill in Action: the agent runs a skill it owns, then 0G Compute decides.
  const [owned, setOwned] = useState<SkillListing[]>([]);
  const [playSkillId, setPlaySkillId] = useState<number | ''>('');
  const [playState, setPlayState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [playRes, setPlayRes] = useState<any>(null);
  const [playErr, setPlayErr] = useState('');

  // Load the skills this agent owns (on-chain) so it can run them.
  useEffect(() => {
    if (!agent) { setOwned([]); return; }
    let cancelled = false;
    fetch(`/api/skills/owned?address=${agent.agentAddress}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setOwned(d.skills ?? []); })
      .catch(() => { if (!cancelled) setOwned([]); });
    return () => { cancelled = true; };
  }, [agent, buyRes]);

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

  async function handlePlay() {
    if (!agent || playSkillId === '') return;
    setPlayState('running'); setPlayErr(''); setPlayRes(null);
    try {
      const res = await fetch('/api/agent/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentAddress: agent.agentAddress, skillId: playSkillId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Skill run failed');
      setPlayRes(data); setPlayState('done');
    } catch (e: any) {
      setPlayErr(e.message); setPlayState('error');
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

        {/* ── Skill in Action: run an owned skill + 0G Compute decides ── */}
        <div className="punk-card punk-card-blue p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-punkBlue" />
            <h3 className="font-heading text-sm uppercase tracking-widest text-inkBlack">Skill in Action</h3>
          </div>
          <p className="text-streetGray text-xs font-mono leading-relaxed">
            The agent <span className="text-punkBlue">runs a skill it owns</span> in a secure sandbox, then reasons on
            verifiable 0G Compute to follow or override it.
          </p>

          <select
            value={playSkillId}
            onChange={e => setPlaySkillId(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full bg-bgDark border border-[rgba(96,165,250,0.3)] rounded-lg font-mono text-sm text-inkBlack px-3 py-2 focus:outline-none focus:border-punkBlue"
          >
            <option value="">
              {owned.length ? 'Select an owned skill to run…' : 'Agent owns no skills yet — buy one first'}
            </option>
            {owned.map(s => (
              <option key={s.id} value={s.id}>#{s.id} · {s.name}</option>
            ))}
          </select>

          <button
            onClick={handlePlay}
            disabled={playSkillId === '' || playState === 'running'}
            className="punk-btn bg-punkBlue text-white w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {playState === 'running'
              ? (<><Loader2 size={14} className="animate-spin mr-2" /> Running skill + reasoning on 0G…</>)
              : 'Run skill'}
          </button>

          {playState === 'done' && playRes && (
            <div className="p-3 rounded-lg bg-punkBlue/10 border border-punkBlue/30 space-y-2">
              <p className="font-mono text-[10px] text-streetGray leading-relaxed">{playRes.scenario}</p>

              <div className="flex items-center gap-2">
                <Terminal size={12} className="text-streetGray shrink-0" />
                <span className="font-mono text-[10px] text-streetGray">Skill computed:</span>
                <span className="font-heading text-sm text-violetBright uppercase">{String(playRes.skillMove)}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-borderSoft">
                <span className="font-mono text-[10px] text-streetGray uppercase tracking-widest">
                  Agent decided {playRes.overridden ? '(overrode skill)' : '(followed skill)'}
                </span>
                <span className="font-heading text-lg text-punkBlue uppercase">{String(playRes.finalMove)}</span>
              </div>
              {playRes.reasoning && (
                <p className="text-inkBlack text-xs font-mono leading-relaxed">{playRes.reasoning}</p>
              )}
              <div className="flex items-center gap-2 pt-1 border-t border-borderSoft">
                <ShieldCheck size={12} className={playRes.verified ? 'text-punkGreen' : 'text-streetGray'} />
                <span className="font-mono text-[9px] text-streetGray uppercase tracking-widest">
                  sandbox + 0G Compute{playRes.verified ? ' · TEE-verified' : ''}
                </span>
              </div>
            </div>
          )}
          {playState === 'error' && (
            <p className="text-punkRed text-xs font-mono">{playErr}</p>
          )}
        </div>
      </div>
    </div>
  );
}
