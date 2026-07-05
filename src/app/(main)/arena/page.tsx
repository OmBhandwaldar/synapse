'use client';

import { useState, useEffect, useCallback } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { useAlgorandWallet } from '@/components/Providers';
import type { SkillListing } from '@/lib/SkillMarketplaceClient';
import {
  Swords, ShieldCheck, Loader2, ExternalLink, Bot, Cpu,
  Trophy, Zap, AlertCircle, Terminal,
} from 'lucide-react';

const EXPLORER = 'https://chainscan-galileo.0g.ai';

interface AgentInfo {
  agentAddress: string;
  agentName: string;
  balance?: number;
}

interface MoveResult {
  skillMove: any;
  finalMove: any;
  reasoning: string;
  verified: boolean;
  provider: string;
  overridden: boolean;
}

interface TurnEvent {
  turnNumber: number;
  gameId: string;
  p1Move: any;
  p2Move: any;
  stateAfter: any;
  reason: string;
  moves: { p1?: MoveResult; p2?: MoveResult };
}

interface ResultEvent {
  winnerSide: 'p1' | 'p2' | 'draw' | null;
  winnerAddress: string | null;
  winnerName: string | null;
  reason: string;
  finalState: any;
}

const GAMES = [
  { id: 'rps', label: 'Rock · Paper · Scissors', tag: 'best of 3' },
  { id: 'nim', label: 'Nim Subtraction', tag: 'sequential' },
  { id: 'tictactoe', label: 'Tic-Tac-Toe', tag: 'sequential' },
] as const;

export default function ArenaPage() {
  const { activeAddress } = useAlgorandWallet();

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [gameId, setGameId] = useState<'rps' | 'nim' | 'tictactoe'>('rps');

  // Player (P1)
  const [p1Address, setP1Address] = useState('');
  const [p1Skills, setP1Skills] = useState<SkillListing[]>([]);
  const [p1SkillId, setP1SkillId] = useState<number | ''>('');

  // Opponent (P2)
  const [oppMode, setOppMode] = useState<'house' | 'agent'>('house');
  const [p2Address, setP2Address] = useState('');
  const [p2Skills, setP2Skills] = useState<SkillListing[]>([]);
  const [p2SkillId, setP2SkillId] = useState<number | ''>('');

  // Match state
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [turns, setTurns] = useState<TurnEvent[]>([]);
  const [result, setResult] = useState<ResultEvent | null>(null);
  const [error, setError] = useState('');

  // Load the owner's agents.
  useEffect(() => {
    if (!activeAddress) { setAgents([]); return; }
    let cancelled = false;
    fetch(`/api/agent/list?owner=${activeAddress}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setAgents(d.agents ?? []); })
      .catch(() => { if (!cancelled) setAgents([]); });
    return () => { cancelled = true; };
  }, [activeAddress]);

  const loadOwnedSkills = useCallback(async (address: string): Promise<SkillListing[]> => {
    if (!address) return [];
    try {
      const r = await fetch(`/api/skills/owned?address=${address}`);
      const d = await r.json();
      return d.skills ?? [];
    } catch { return []; }
  }, []);

  // When P1 agent changes, load its owned skills.
  useEffect(() => {
    if (!p1Address) { setP1Skills([]); setP1SkillId(''); return; }
    let cancelled = false;
    loadOwnedSkills(p1Address).then(s => {
      if (cancelled) return;
      setP1Skills(s);
      setP1SkillId(s.length ? s[0].id : '');
    });
    return () => { cancelled = true; };
  }, [p1Address, loadOwnedSkills]);

  // When P2 agent changes, load its owned skills.
  useEffect(() => {
    if (oppMode !== 'agent' || !p2Address) { setP2Skills([]); setP2SkillId(''); return; }
    let cancelled = false;
    loadOwnedSkills(p2Address).then(s => {
      if (cancelled) return;
      setP2Skills(s);
      setP2SkillId(s.length ? s[0].id : '');
    });
    return () => { cancelled = true; };
  }, [p2Address, oppMode, loadOwnedSkills]);

  const p1Agent = agents.find(a => a.agentAddress === p1Address);
  const p2Agent = agents.find(a => a.agentAddress === p2Address);

  const canFight =
    !running &&
    !!p1Address && p1SkillId !== '' &&
    (oppMode === 'house' || (!!p2Address && p2SkillId !== '' && p2Address !== p1Address));

  async function handleFight() {
    if (!canFight) return;
    setRunning(true);
    setError('');
    setProgress('');
    setTurns([]);
    setResult(null);

    const agentB = oppMode === 'house'
      ? { house: true }
      : { agentAddress: p2Address, agentName: p2Agent?.agentName, skillId: p2SkillId };

    try {
      const res = await fetch('/api/arena/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          agentA: { agentAddress: p1Address, agentName: p1Agent?.agentName, skillId: p1SkillId },
          agentB,
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Match failed' }));
        throw new Error(err.error || 'Match failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          let eventType = '';
          let dataStr = '';
          for (const line of part.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
          }
          if (!dataStr) continue;
          let payload: any;
          try { payload = JSON.parse(dataStr); } catch { continue; }

          if (eventType === 'progress') setProgress(payload.message ?? '');
          else if (eventType === 'turn') setTurns(prev => [...prev, payload]);
          else if (eventType === 'result') setResult(payload);
          else if (eventType === 'error') setError(payload.error ?? 'Match failed');
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const p1Name = p1Agent?.agentName ?? 'Agent A';
  const p2Name = oppMode === 'house' ? 'House Bot' : (p2Agent?.agentName ?? 'Agent B');

  return (
    <div className="space-y-8 pb-16">
      <SectionHeader
        title="THE ARENA"
        subtitle="Two agents, their own skills, and a verifiable brain. Every move is reasoned on TEE-attested 0G Compute."
      />

      {!activeAddress ? (
        <Card className="p-10 text-center">
          <Cpu size={40} className="mx-auto mb-4 text-violet/40" />
          <p className="font-heading text-2xl uppercase tracking-widest text-inkBlack mb-2">Connect to enter the arena</p>
          <p className="text-streetGray text-sm font-mono">Connect your wallet to pick an agent and start a battle.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Setup ── */}
          <div className="lg:col-span-1 space-y-6">
            <div className="punk-card punk-card-purple p-5 space-y-5">
              <div className="flex items-center gap-2">
                <Swords size={18} className="text-violetBright" />
                <h3 className="font-heading text-sm uppercase tracking-widest text-inkBlack">Match Setup</h3>
              </div>

              {/* Game */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] text-streetGray uppercase tracking-widest">Game</label>
                <select
                  value={gameId}
                  onChange={e => setGameId(e.target.value as any)}
                  className="w-full bg-bgDark border border-[rgba(139,92,246,0.3)] rounded-lg font-mono text-sm text-inkBlack px-3 py-2 focus:outline-none focus:border-violet"
                >
                  {GAMES.map(g => <option key={g.id} value={g.id}>{g.label} — {g.tag}</option>)}
                </select>
              </div>

              {/* Your agent */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] text-violetBright uppercase tracking-widest">Your agent (P1)</label>
                <select
                  value={p1Address}
                  onChange={e => setP1Address(e.target.value)}
                  className="w-full bg-bgDark border border-[rgba(139,92,246,0.3)] rounded-lg font-mono text-sm text-inkBlack px-3 py-2 focus:outline-none focus:border-violet"
                >
                  <option value="">Select your agent…</option>
                  {agents.map(a => <option key={a.agentAddress} value={a.agentAddress}>{a.agentName}</option>)}
                </select>
                <select
                  value={p1SkillId}
                  onChange={e => setP1SkillId(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={!p1Address}
                  className="w-full bg-bgDark border border-[rgba(139,92,246,0.3)] rounded-lg font-mono text-sm text-inkBlack px-3 py-2 focus:outline-none focus:border-violet disabled:opacity-50"
                >
                  <option value="">
                    {p1Address ? (p1Skills.length ? 'Select an owned skill…' : 'This agent owns no skills — buy one first') : 'Pick an agent first'}
                  </option>
                  {p1Skills.map(s => <option key={s.id} value={s.id}>#{s.id} · {s.name}</option>)}
                </select>
              </div>

              {/* Opponent */}
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] text-punkBlue uppercase tracking-widest">Opponent (P2)</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOppMode('house')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${oppMode === 'house' ? 'bg-punkBlue/20 border-punkBlue text-punkBlue' : 'border-borderSoft text-streetGray hover:text-punkBlue'}`}
                  >House Bot</button>
                  <button
                    onClick={() => setOppMode('agent')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${oppMode === 'agent' ? 'bg-punkBlue/20 border-punkBlue text-punkBlue' : 'border-borderSoft text-streetGray hover:text-punkBlue'}`}
                  >Another Agent</button>
                </div>
                {oppMode === 'agent' && (
                  <>
                    <select
                      value={p2Address}
                      onChange={e => setP2Address(e.target.value)}
                      className="w-full bg-bgDark border border-[rgba(96,165,250,0.3)] rounded-lg font-mono text-sm text-inkBlack px-3 py-2 focus:outline-none focus:border-punkBlue"
                    >
                      <option value="">Select opponent agent…</option>
                      {agents.filter(a => a.agentAddress !== p1Address).map(a => (
                        <option key={a.agentAddress} value={a.agentAddress}>{a.agentName}</option>
                      ))}
                    </select>
                    <select
                      value={p2SkillId}
                      onChange={e => setP2SkillId(e.target.value === '' ? '' : Number(e.target.value))}
                      disabled={!p2Address}
                      className="w-full bg-bgDark border border-[rgba(96,165,250,0.3)] rounded-lg font-mono text-sm text-inkBlack px-3 py-2 focus:outline-none focus:border-punkBlue disabled:opacity-50"
                    >
                      <option value="">
                        {p2Address ? (p2Skills.length ? 'Select an owned skill…' : 'This agent owns no skills') : 'Pick an agent first'}
                      </option>
                      {p2Skills.map(s => <option key={s.id} value={s.id}>#{s.id} · {s.name}</option>)}
                    </select>
                  </>
                )}
              </div>

              <button
                onClick={handleFight}
                disabled={!canFight}
                className="punk-btn bg-violet text-white w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {running
                  ? (<><Loader2 size={16} className="animate-spin" /> Battle in progress…</>)
                  : (<><Swords size={16} /> Fight</>)}
              </button>
              {error && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-punkRed/10 border border-punkRed/40">
                  <AlertCircle size={14} className="text-punkRed shrink-0" />
                  <p className="text-punkRed text-xs font-mono">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Battle telemetry ── */}
          <div className="lg:col-span-2 space-y-4">
            <BattleView
              running={running}
              progress={progress}
              turns={turns}
              result={result}
              p1Name={p1Name}
              p2Name={p2Name}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Battle view ──────────────────────────────────────────────────────────────

function BattleView({
  running, progress, turns, result, p1Name, p2Name,
}: {
  running: boolean;
  progress: string;
  turns: TurnEvent[];
  result: ResultEvent | null;
  p1Name: string;
  p2Name: string;
}) {
  if (!running && turns.length === 0 && !result) {
    return (
      <div className="punk-card min-h-[460px] flex items-center justify-center p-8 text-center">
        <div>
          <Swords size={40} className="mx-auto mb-4 text-violet/40" />
          <p className="font-heading text-2xl uppercase tracking-widest text-inkBlack mb-2">Battle Telemetry</p>
          <p className="text-streetGray text-sm font-mono max-w-sm mx-auto">
            Set up a match and hit <span className="text-violetBright">Fight</span>. Watch each agent reason on
            TEE-verified 0G Compute, move by move.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Fighters banner */}
      <div className="punk-card p-4 flex items-center justify-between">
        <FighterTag name={p1Name} color="text-violetBright" />
        <span className="font-pixel text-[10px] text-streetGray">VS</span>
        <FighterTag name={p2Name} color="text-punkBlue" alignRight />
      </div>

      {/* Winner banner */}
      {result && (
        <div className="rounded-2xl bg-punkGreen/12 border border-punkGreen/50 p-5 text-center shadow-[0_0_28px_rgba(74,222,128,0.18)]">
          <Trophy size={22} className="mx-auto mb-2 text-punkGreen" />
          <p className="font-heading text-2xl uppercase tracking-widest text-punkGreen text-glow">
            {result.winnerSide === 'draw' ? 'Draw' : `${result.winnerName ?? (result.winnerSide === 'p1' ? p1Name : p2Name)} wins`}
          </p>
          <p className="font-mono text-[11px] text-streetGray mt-1">{result.reason}</p>
        </div>
      )}

      {/* Progress line */}
      {running && (
        <div className="flex items-center gap-2 font-mono text-[11px] text-violetBright">
          <Loader2 size={13} className="animate-spin" /> {progress || 'Working…'}
        </div>
      )}

      {/* Turns */}
      <div className="space-y-3">
        {turns.map((t, i) => (
          <TurnCard key={i} turn={t} p1Name={p1Name} p2Name={p2Name} live={running && i === turns.length - 1} />
        ))}
      </div>
    </div>
  );
}

function FighterTag({ name, color, alignRight }: { name: string; color: string; alignRight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${alignRight ? 'flex-row-reverse text-right' : ''}`}>
      <div className="p-2 rounded-lg bg-violet/15 border border-[rgba(139,92,246,0.4)]">
        <Bot size={16} className={color} />
      </div>
      <p className={`font-heading text-sm uppercase tracking-tight ${color}`}>{name}</p>
    </div>
  );
}

function TurnCard({ turn, p1Name, p2Name, live }: { turn: TurnEvent; p1Name: string; p2Name: string; live: boolean }) {
  const s = turn.stateAfter ?? {};
  const score = (s.p1Score !== undefined) ? `${s.p1Score} — ${s.p2Score}` : null;
  return (
    <div className="punk-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-streetGray uppercase tracking-widest">
          Turn {turn.turnNumber}
        </span>
        {score && <span className="font-heading text-sm text-inkBlack">{score}</span>}
        {live && <span className="font-mono text-[9px] text-punkPink animate-pulse">● live</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {turn.moves.p1 && <MoveCard name={p1Name} move={turn.moves.p1} accent="violet" />}
        {turn.moves.p2 && <MoveCard name={p2Name} move={turn.moves.p2} accent="blue" />}
      </div>
      {turn.reason && <p className="font-mono text-[10px] text-streetGray">{turn.reason}</p>}
    </div>
  );
}

function MoveCard({ name, move, accent }: { name: string; move: MoveResult; accent: 'violet' | 'blue' }) {
  const nameColor = accent === 'violet' ? 'text-violetBright' : 'text-punkBlue';
  return (
    <div className="rounded-lg bg-bgDark/60 border border-borderSoft p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className={`font-heading text-xs uppercase tracking-wide ${nameColor}`}>{name}</span>
        {move.verified ? (
          <a
            href={`${EXPLORER}/address/${move.provider}`}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-punkGreen/12 border border-punkGreen/40 hover:border-punkGreen"
            title={`TEE-attested · provider ${move.provider}`}
          >
            <ShieldCheck size={9} className="text-punkGreen" />
            <span className="font-mono text-[8px] text-punkGreen uppercase tracking-widest">TEE ✓</span>
            <ExternalLink size={8} className="text-punkGreen" />
          </a>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-streetGray/10 border border-borderSoft">
            <Cpu size={9} className="text-streetGray" />
            <span className="font-mono text-[8px] text-streetGray uppercase tracking-widest">compute</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Terminal size={11} className="text-streetGray shrink-0" />
        <span className="font-mono text-[10px] text-streetGray">skill</span>
        <span className="font-heading text-xs text-streetGray uppercase">{String(move.skillMove)}</span>
        <Zap size={11} className="text-violetBright shrink-0 ml-1" />
        <span className="font-mono text-[10px] text-streetGray">played</span>
        <span className={`font-heading text-base uppercase ${nameColor}`}>{String(move.finalMove)}</span>
        {move.overridden && (
          <span className="font-mono text-[8px] text-punkOrange uppercase tracking-widest ml-auto">overrode</span>
        )}
      </div>
      {move.reasoning && <p className="font-mono text-[10px] text-inkBlack leading-relaxed">{move.reasoning}</p>}
    </div>
  );
}
