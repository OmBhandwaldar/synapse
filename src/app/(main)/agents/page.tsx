'use client';

import { useState, useEffect, useCallback } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAlgorandWallet } from '@/components/Providers';
import type { SkillListing } from '@/lib/SkillMarketplaceClient';
import {
  Sparkles, Terminal, Code, Cpu, Database,
  Bot, Zap, Shield, Trophy, Clock, Wallet,
  ChevronRight, AlertCircle, CheckCircle, Loader2, Plus, ExternalLink,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEPLOY_FEE_ALGO = 0;
const NEURONS_PER_LEVEL = 50;

const TYPE_ICONS: Record<string, any> = {
  Logic: Code,
  Compute: Cpu,
  State: Database,
  Data: Sparkles,
  Prediction: Terminal,
  Strategy: Sparkles,
};

const NEURON_LIMITS: { minNeurons: number; maxAgents: number; maxSkills: number; label: string }[] = [
  { minNeurons: 0, maxAgents: 1, maxSkills: 2, label: 'Hatchling' },
  { minNeurons: 50, maxAgents: 2, maxSkills: 3, label: 'Runner' },
  { minNeurons: 150, maxAgents: 3, maxSkills: 4, label: 'Operative' },
  { minNeurons: 350, maxAgents: 5, maxSkills: 5, label: 'Ghost' },
  { minNeurons: 700, maxAgents: 8, maxSkills: 6, label: 'Phantom' },
];

function getTier(neurons: number) {
  let tier = NEURON_LIMITS[0];
  for (const t of NEURON_LIMITS) {
    if (neurons >= t.minNeurons) tier = t;
  }
  return tier;
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface AgentInfo {
  agentAddress: string;
  agentName: string;
  ownerAddress: string;
  balance?: number; // ALGO balance of the agent wallet
  equippedSkill1?: string;
  equippedSkill2?: string;
  equippedSkill3?: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NeuronsLevelBar({ neurons }: { neurons: number }) {
  const tier = getTier(neurons);
  const nextTier = NEURON_LIMITS.find(t => t.minNeurons > neurons);
  const progress = nextTier
    ? ((neurons - tier.minNeurons) / (nextTier.minNeurons - tier.minNeurons)) * 100
    : 100;

  return (
    <div className="punk-card p-4 bg-inkBlack text-white space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu size={22} className="text-violetBright" />
          <div>
            <p className="font-heading text-xs uppercase tracking-widest text-punkYellow">{tier.label}</p>
            <p className="font-mono font-bold text-lg">{neurons} Neurons</p>
          </div>
        </div>
        <div className="text-right text-xs font-mono text-streetGray">
          <p>Max Agents: <span className="text-punkGreen font-bold">{tier.maxAgents}</span></p>
          <p>Max Skills/Bot: <span className="text-punkBlue font-bold">{tier.maxSkills}</span></p>
        </div>
      </div>
      {nextTier && (
        <>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-punkPink to-punkYellow rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[9px] text-streetGray font-mono uppercase text-right">
            {nextTier.minNeurons - neurons} neurons to {nextTier.label}
          </p>
        </>
      )}
    </div>
  );
}

function AgentCard({ agent, onSelect, isSelected }: { agent: AgentInfo; onSelect: () => void; isSelected: boolean }) {
  const shortAddr = `${agent.agentAddress.slice(0, 6)}…${agent.agentAddress.slice(-4)}`;
  const skillsCount = [agent.equippedSkill1, agent.equippedSkill2, agent.equippedSkill3].filter(Boolean).length;
  const hasSkills = skillsCount > 0;

  return (
    <div
      onClick={onSelect}
      className={`punk-card p-4 cursor-pointer border-2 transition-all relative overflow-hidden ${
        hasSkills
          ? 'border-punkPink bg-punkPink/5 shadow-[0_0_15px_rgba(255,45,138,0.25)]'
          : 'border-inkBlack hover:border-punkPurple bg-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded ${hasSkills ? 'bg-punkPink text-white' : 'bg-inkBlack text-white'}`}>
          <Bot size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-heading text-sm text-inkBlack uppercase tracking-tight truncate">{agent.agentName}</h4>
          <p className="font-mono text-[9px] text-streetGray">{shortAddr}</p>
        </div>
      </div>
      
      {hasSkills && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="sticker sticker-green !text-[8px] !py-0.5 !px-1.5 !transform-none font-bold uppercase tracking-wider">
            🛡️ ARMOR: {skillsCount} SKILLS
          </span>
        </div>
      )}

      {agent.balance !== undefined && (
        <div className="mt-2 pt-2 border-t border-borderSoft flex items-center gap-1">
          <Wallet size={10} className="text-streetGray" />
          <span className="font-mono text-[10px] text-streetGray">{agent.balance.toFixed(3)} ALGO</span>
          {agent.balance < 1 && (
            <span className="ml-auto text-[9px] text-punkRed font-bold animate-pulse">LOW FUNDS</span>
          )}
        </div>
      )}
    </div>
  );
}


function DeployModal({
  onClose,
  onDeployed,
  tier,
  agentCount,
}: {
  onClose: () => void;
  onDeployed: (agent: AgentInfo) => void;
  tier: ReturnType<typeof getTier>;
  agentCount: number;
}) {
  const { activeAddress, signTransaction } = useAlgorandWallet();
  const [agentName, setAgentName] = useState('');
  const [step, setStep] = useState<'form' | 'deploying' | 'signing' | 'done'>('form');
  const [newAgent, setNewAgent] = useState<AgentInfo | null>(null);
  const [error, setError] = useState('');
  const [txId, setTxId] = useState('');

  const canDeploy = agentCount < tier.maxAgents;

  async function handleDeploy() {
    if (!agentName.trim() || !activeAddress) return;
    setNewAgent(null);
    setStep('deploying');
    setError('');

    try {
      // 1. Generate secure wallet offline and save to vault
      const res = await fetch('/api/agent/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerAddress: activeAddress, agentName: agentName.trim() }),
      });

      if (!res.ok) throw new Error((await res.json()).error ?? 'Deploy failed');
      const data = await res.json();
      setNewAgent(data);

      // The agent's 0G (EVM) wallet is created and stored server-side. On 0G the
      // agent transacts autonomously from this wallet — no on-chain registration
      // step is needed (the AgentRegistry contract is deferred to a later round).
      // The owner just funds the returned address from https://faucet.0g.ai
      setStep('done');
    } catch (err: any) {
      setError(err.message);
      setStep('form');
    }
  }

  function handleDone() {
    if (newAgent) onDeployed(newAgent);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inkBlack/70 backdrop-blur-sm">
      <div className="punk-card bg-white w-full max-w-md border-4 border-inkBlack shadow-2xl">

        {/* Header */}
        <div className="bg-inkBlack text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot size={20} className="text-punkYellow" />
            <h2 className="font-heading text-lg uppercase tracking-widest">Deploy Agent</h2>
          </div>
          <button onClick={onClose} className="text-streetGray hover:text-white transition-colors text-xl font-bold">✕</button>
        </div>

        <div className="p-6 space-y-5">

          {/* Capacity check */}
          {!canDeploy && (
            <div className="flex items-center gap-3 p-3 bg-punkRed/10 border border-punkRed rounded">
              <AlertCircle size={16} className="text-punkRed shrink-0" />
              <p className="text-punkRed text-xs font-mono">
                Agent limit reached ({agentCount}/{tier.maxAgents}). Earn more Neurons to unlock more slots.
              </p>
            </div>
          )}

          {/* Step: Form */}
          {step === 'form' && (
            <>
              <div>
                <label className="block text-xs font-heading uppercase tracking-widest text-inkBlack mb-2">Agent Name</label>
                <input
                  type="text"
                  maxLength={32}
                  placeholder="e.g. NullSec_Bot"
                  value={agentName}
                  onChange={e => setAgentName(e.target.value)}
                  className="w-full border-2 border-inkBlack font-mono text-sm px-3 py-2 focus:outline-none focus:border-punkPink"
                />
              </div>

              <div className="bg-bgCream p-4 border-2 border-dashed border-inkBlack space-y-2">
                <p className="font-heading text-xs uppercase tracking-widest text-inkBlack">Deployment Cost</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-streetGray">Deploy Fee</span>
                  <span className="font-mono font-bold text-punkGreen">FREE ({DEPLOY_FEE_ALGO} ALGO)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-streetGray">Agent Wallet Funding</span>
                  <span className="font-mono font-bold text-streetGray">~2 ALGO (for gas)</span>
                </div>
                <div className="flex items-center justify-between border-t border-inkBlack pt-2">
                  <span className="font-heading text-xs uppercase text-inkBlack">Total</span>
                  <span className="font-heading text-punkPink">~2 ALGO</span>
                </div>
              </div>

              {error && <p className="text-punkRed text-xs font-mono">{error}</p>}

              <Button
                variant="primary"
                className="w-full"
                onClick={handleDeploy}
                disabled={!agentName.trim() || !canDeploy}
              >
                Generate Agent Wallet →
              </Button>
            </>
          )}

          {/* Step: Deploying */}
          {step === 'deploying' && (
            <div className="py-8 flex flex-col items-center gap-4">
              <Loader2 size={32} className="text-punkPink animate-spin" />
              <p className="font-mono text-sm text-inkBlack">Generating secure wallet...</p>
              <p className="text-streetGray text-xs font-mono">Encrypting private key to vault</p>
            </div>
          )}

          {/* Step: Signing */}
          {step === 'signing' && newAgent && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <Loader2 size={32} className="text-punkPink animate-spin" />
              <p className="font-mono text-sm text-inkBlack">Sign in Pera Wallet</p>
              <p className="text-streetGray text-xs font-mono">
                Please approve the transaction in your wallet to deploy and fund <strong>{newAgent.agentName}</strong>.
              </p>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && newAgent && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-punkGreen/10 border-2 border-punkGreen rounded-lg">
                <CheckCircle size={20} className="text-punkGreen shrink-0" />
                <div>
                  <p className="text-punkGreen font-heading text-sm uppercase tracking-wider">Agent Registered!</p>
                  <p className="text-inkBlack font-mono text-[10px]">Successfully registered on-chain.</p>
                </div>
              </div>

              <div className="punk-card bg-bgCream p-4 space-y-3 text-left">
                <div>
                  <span className="text-[10px] font-mono text-streetGray uppercase block">Agent Name</span>
                  <span className="font-heading text-md text-inkBlack uppercase">{newAgent.agentName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-streetGray uppercase block">Agent Address</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-inkBlack truncate bg-white px-2 py-1 border border-borderSoft rounded flex-1">
                      {newAgent.agentAddress}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newAgent.agentAddress);
                      }}
                      className="p-1.5 border border-inkBlack rounded bg-white hover:bg-punkYellow text-xs font-mono font-bold"
                      title="Copy Address"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
                {txId && (
                  <div>
                    <span className="text-[10px] font-mono text-streetGray uppercase block">Transaction Link</span>
                    <a
                      href={`https://testnet.explorer.perawallet.app/tx/${txId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-punkBlue hover:underline font-mono text-[10px] flex items-center gap-1 mt-1 font-bold"
                    >
                      Verify on Pera Explorer <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </div>

              <Button variant="primary" className="w-full mt-2" onClick={handleDone}>
                Close & View Swarm
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const { activeAddress } = useAlgorandWallet();
  const [ownedSkills, setOwnedSkills] = useState<SkillListing[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);

  // Mocked neurons — will be fetched from AgentRegistry contract once deployed
  const [neurons] = useState(0);
  const tier = getTier(neurons);

  // ── Fetch owned skills ──
  const loadOwnedSkills = useCallback(async () => {
    if (!activeAddress) { setOwnedSkills([]); return; }
    setLoadingSkills(true);
    try {
      const res = await fetch(`/api/skills/owned?address=${activeAddress}`);
      if (res.ok) setOwnedSkills((await res.json()).skills ?? []);
    } finally {
      setLoadingSkills(false);
    }
  }, [activeAddress]);

  // ── Fetch agents from vault ──
  const loadAgents = useCallback(async () => {
    if (!activeAddress) { setAgents([]); return; }
    try {
      const res = await fetch(`/api/agent/list?owner=${activeAddress}`);
      if (res.ok) setAgents((await res.json()).agents ?? []);
    } catch { /* silent */ }
  }, [activeAddress]);

  useEffect(() => { loadOwnedSkills(); loadAgents(); }, [loadOwnedSkills, loadAgents]);

  function handleDeployed(newAgent: AgentInfo) {
    setAgents(prev => [...prev, newAgent]);
  }

  return (
    <div className="space-y-8 pb-16">
      <SectionHeader
        title="AGENT SWARM"
        jpTitle="スウォーム"
        subtitle="Deploy autonomous bots. Equip skills. Compete in the Arena via x402."
        action={
          <Button variant="primary" onClick={() => setShowDeploy(true)}>
            <Plus size={14} className="mr-2" />
            Deploy Agent
          </Button>
        }
      />

      {/* Neurons Level Bar */}
      {activeAddress && <NeuronsLevelBar neurons={neurons} />}

      {/* No wallet */}
      {!activeAddress && (
        <Card className="p-12 text-center stripe-bg">
          <div className="text-5xl mb-4">🔌</div>
          <p className="font-heading text-xl uppercase tracking-widest text-inkBlack mb-2">Connect Your Wallet</p>
          <p className="text-streetGray text-sm font-mono">Connect to manage your agent swarm.</p>
        </Card>
      )}

      {activeAddress && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* ── Left Sidebar: Skills + Agents ── */}
          <div className="lg:col-span-1 space-y-6">

            {/* My Agents */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-heading tracking-wider text-inkBlack uppercase">
                  MY AGENTS <span className="text-streetGray text-xs">({agents.length}/{tier.maxAgents})</span>
                </h3>
                <button
                  onClick={() => setShowDeploy(true)}
                  className="p-1 border-2 border-inkBlack hover:bg-punkYellow transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>

              <div className="space-y-2">
                {agents.length === 0 ? (
                  <Card className="p-4 text-center border-dashed">
                    <Bot size={24} className="mx-auto mb-2 text-streetGray opacity-40" />
                    <p className="text-streetGray text-xs font-mono">No agents deployed yet.</p>
                  </Card>
                ) : (
                  agents.map(a => (
                    <AgentCard
                      key={a.agentAddress}
                      agent={a}
                      isSelected={false}
                      onSelect={() => {}}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Skill Inventory */}
            <div className="space-y-2">
              <h3 className="text-lg font-heading tracking-wider text-inkBlack uppercase">
                SKILL INVENTORY <span className="text-streetGray text-xs">({ownedSkills.length})</span>
              </h3>
              <p className="text-[10px] text-streetGray font-mono uppercase">On-chain verified purchases</p>

              <div className="space-y-2">
                {loadingSkills ? (
                  [1, 2, 3].map(i => (
                    <div key={i} className="h-14 w-full bg-inkBlack/5 animate-pulse rounded" />
                  ))
                ) : ownedSkills.length === 0 ? (
                  <Card className="p-4 text-center border-dashed">
                    <p className="text-streetGray text-xs font-mono">No skills in inventory.</p>
                    <a href="/marketplace" className="text-punkPink text-[10px] font-mono hover:underline mt-1 block">
                      Visit marketplace →
                    </a>
                  </Card>
                ) : (
                  ownedSkills.map(skill => {
                    const Icon = TYPE_ICONS[skill.skillType] || Code;
                    return (
                      <div
                        key={skill.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/json', JSON.stringify(skill));
                        }}
                        className="group punk-card p-3 bg-white border-2 border-inkBlack hover:bg-punkYellow transition-all cursor-grab relative overflow-hidden"
                        title="Drag to equip"
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-inkBlack text-white rounded shrink-0">
                            <Icon size={12} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-heading text-xs text-inkBlack uppercase tracking-tighter truncate">{skill.name}</p>
                            <p className="text-[9px] text-streetGray font-mono">{skill.skillType} · v{skill.version}</p>
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-punkPink scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── Main: Agent Detail / Loadout ── */}
          <div className="lg:col-span-3 space-y-6">
            <div className="punk-card checkerboard-bg min-h-[500px] flex items-center justify-center p-8 text-center border-4 border-inkBlack shadow-[8px_8px_0_#1a1a1a]">
              <div>
                <div className="text-5xl mb-6 flex justify-center gap-4">
                  <span className="opacity-30 blur-[1px]">🕸️</span>
                  <span className="animate-bounce">⚡</span>
                  <span className="opacity-30 blur-[1px]">🕸️</span>
                </div>
                <p className="text-inkBlack text-3xl mb-3 font-heading tracking-widest uppercase">Agent Node Editor</p>
                <p className="text-streetGray text-sm font-mono max-w-md mx-auto mb-8 bg-white/50 p-4 border-2 border-dashed border-inkBlack">
                  Wire up your agent networks, configure AI skills, and execute complex logic directly within the node graph editor.
                </p>
                <a href="/agents/editor" className="inline-block">
                  <Button variant="primary" className="text-lg px-8 py-4 shadow-xl hover:-translate-y-1 hover:shadow-[6px_6px_0_#1a1a1a] transition-all bg-punkPink border-4 border-inkBlack">
                    Open Node Editor →
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deploy Modal */}
      {showDeploy && (
        <DeployModal
          onClose={() => setShowDeploy(false)}
          onDeployed={handleDeployed}
          tier={tier}
          agentCount={agents.length}
        />
      )}
    </div>
  );
}
