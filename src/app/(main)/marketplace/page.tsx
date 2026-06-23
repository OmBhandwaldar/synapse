'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Badge } from '@/components/ui/Badge';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { useAlgorandWallet } from '@/components/Providers';
import { useDialog } from '@/components/DialogProvider';
import type { SkillListing } from '@/lib/SkillMarketplaceClient';
import { buySkill } from '@/lib/SkillMarketplaceClient';

const TYPE_ACCENT: Record<string, { badge: 'blue' | 'green' | 'purple' | 'red' | 'orange'; card: string }> = {
  Logic: { badge: 'purple', card: 'punk-card-purple' },
  Compute: { badge: 'blue', card: 'punk-card-blue' },
  State: { badge: 'green', card: 'punk-card-green' },
  Data: { badge: 'orange', card: 'punk-card-blue' },
  Prediction: { badge: 'red', card: 'punk-card-pink' },
  Strategy: { badge: 'purple', card: 'punk-card-purple' },
};

// Prices are already denominated in 0G (human units) from the contract client.
function formatOg(amount: number) {
  return amount.toFixed(4);
}

// ─── Buy Modal ────────────────────────────────────────────────────────────────
function BuyModal({
  skill,
  onClose,
  onSuccess,
}: {
  skill: SkillListing;
  onClose: () => void;
  onSuccess: (txId: string) => void;
}) {
  // 1. Context & Utils
  const { activeAddress, getSigner } = useAlgorandWallet();
  const [step, setStep] = useState<'confirm' | 'signing' | 'done' | 'error'>('confirm');
  const [txId, setTxId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleBuy = async () => {
    if (!activeAddress) return;
    setStep('signing');
    try {
      // Buy the skill on 0G Chain, signed by the connected MetaMask wallet.
      const signer = await getSigner();
      const newTxId = await buySkill(signer, skill.id, BigInt(skill.priceWei));

      setTxId(newTxId);
      setStep('done');
      onSuccess(newTxId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="punk-card bg-bgCream p-8 w-full max-w-sm relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-inkBlack hover:text-punkPink p-2 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {step === 'confirm' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-heading text-2xl uppercase leading-none">
                <span className="bg-punkYellow px-2">ACQUIRE</span>
              </h2>
              <p className="font-heading text-xl text-inkBlack uppercase mt-1">{skill.name}</p>
            </div>
            <div className="bg-white border-2 border-inkBlack p-4 space-y-2 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-streetGray">Type</span>
                <span className="text-inkBlack font-bold">{skill.skillType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-streetGray">Seller</span>
                <span className="text-inkBlack">{skill.seller.slice(0, 6)}…{skill.seller.slice(-4)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-inkBlack pt-2 mt-2">
                <span className="text-inkBlack font-bold uppercase">Price</span>
                <span className="text-punkGreen font-bold text-lg">{formatOg(skill.price)} 0G</span>
              </div>
            </div>
            <div className="text-[10px] font-mono text-streetGray uppercase tracking-widest border-t border-borderSoft pt-3">
              🔒 Code will be accessible via x402 gate after purchase
            </div>
            <button
              onClick={handleBuy}
              className="punk-btn w-full bg-punkYellow text-inkBlack py-4 font-heading text-lg"
            >
              ✦ CONFIRM PURCHASE
            </button>
          </div>
        )}

        {step === 'signing' && (
          <div className="text-center py-8 space-y-4">
            <div className="text-5xl animate-pulse">⟳</div>
            <p className="font-heading text-xl uppercase text-inkBlack">Awaiting Signature</p>
            <p className="font-mono text-xs text-streetGray uppercase tracking-widest">Approve in your wallet app</p>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-6 space-y-4">
            <div className="text-6xl">✅</div>
            <h2 className="font-heading text-2xl uppercase">
              <span className="bg-punkGreen px-2">SKILL ACQUIRED!</span>
            </h2>
            <p className="font-mono text-xs text-streetGray uppercase tracking-widest">Added to your collection</p>
            {txId && (
              <a href={`https://chainscan-galileo.0g.ai/tx/${txId}`} target="_blank" rel="noopener noreferrer"
                className="block font-mono text-xs text-punkBlue underline break-all">
                {txId.slice(0, 24)}…
              </a>
            )}
            <button onClick={onClose} className="punk-btn w-full bg-inkBlack text-white py-3 font-heading">CLOSE</button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-6 space-y-4">
            <div className="text-5xl">❌</div>
            <p className="font-heading text-xl uppercase text-punkRed">Purchase Failed</p>
            <p className="font-mono text-xs text-streetGray border-2 border-punkRed p-3">{errorMsg}</p>
            <button onClick={() => setStep('confirm')} className="punk-btn w-full bg-white text-inkBlack py-3 font-heading">TRY AGAIN</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skill Card ───────────────────────────────────────────────────────────────
function SkillCard({ skill, onAccess }: { skill: SkillListing; onAccess: () => void }) {
  const accent = TYPE_ACCENT[skill.skillType] ?? TYPE_ACCENT.Logic;
  return (
    <SpotlightCard className={`flex flex-col h-full group p-0 overflow-hidden ${accent.card}`} accentColor="pink">
      <div className="p-6 flex-1 space-y-5">
        <div className="flex justify-between items-start">
          <Badge label={skill.skillType} color={accent.badge} />
          <span className="text-streetGray text-[10px] font-mono tracking-tighter uppercase font-bold">
            By: {skill.seller.slice(0, 4)}…{skill.seller.slice(-4)}
          </span>
        </div>
        <div>
          <h3 className="text-xl font-heading tracking-widest text-inkBlack uppercase group-hover:text-punkPink transition-colors duration-300">
            {skill.name}
          </h3>
          <p className="text-streetGray text-sm mt-3 line-clamp-3 leading-relaxed font-body">{skill.description}</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-streetGray uppercase tracking-widest">
          <span>v{skill.version}</span>
          <span>•</span>
          <span>{skill.soldCount} sold</span>
        </div>
      </div>
      <div className="px-6 py-5 border-t-3 border-inkBlack bg-bgCream flex items-center justify-between">
        <div>
          <span className="text-streetGray text-[10px] uppercase tracking-widest block mb-1 font-bold">Acquisition</span>
          <span className="text-inkBlack font-mono font-bold text-lg">{formatOg(skill.price)} 0G</span>
        </div>
        <button onClick={onAccess} className="punk-btn bg-punkYellow text-inkBlack px-6 py-2 rounded-lg text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-punkPink hover:text-white transition-colors">
          Access Skill
        </button>
      </div>
    </SpotlightCard>
  );
}

// ─── Skeleton Loading ──────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="punk-card h-64 animate-pulse bg-white">
      <div className="p-6 space-y-4">
        <div className="h-4 bg-borderSoft rounded w-1/3" />
        <div className="h-6 bg-borderSoft rounded w-2/3" />
        <div className="h-4 bg-borderSoft rounded w-full" />
        <div className="h-4 bg-borderSoft rounded w-4/5" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const { activeAddress } = useAlgorandWallet();
  const { alert } = useDialog();
  const [skills, setSkills] = useState<SkillListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [activeSkill, setActiveSkill] = useState<SkillListing | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [handshake, setHandshake] = useState<{ active: boolean; logs: string[] }>({ active: false, logs: [] });

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/skills/list-all');
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills ?? []);
      }
    } catch {
      // fall through — will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const handleAccessContent = async (skill: SkillListing, isRetry = false) => {
    if (!activeAddress) {
      await alert('Please connect your wallet first');
      return;
    }

    setActiveSkill(skill);
    setHandshake({ active: true, logs: [`[x402] GET /api/skills/${skill.id}/content`] });

    try {
      // Snappier delay
      await new Promise(r => setTimeout(r, 200));

      const res = await fetch(`/api/skills/${skill.id}/content`, {
        headers: { 'Authorization': `Bearer ${activeAddress}` }
      });

      if (res.status === 402) {
        setHandshake(prev => ({ ...prev, logs: [...prev.logs, `← 402 PAYMENT REQUIRED`, `[x402] EXTRACTING METADATA...`, `[x402] LAUNCHING PURCHASE FLOW...`] }));
        setShowBuyModal(true);
        setShowAuditModal(false);
      } else if (res.ok) {
        setHandshake(prev => ({ ...prev, logs: [...prev.logs, `← 200 OK (ACCESS GRANTED)`] }));
        // No longer auto-hiding here — let user read the success logs
        setShowAuditModal(true);
        setShowBuyModal(false);
      } else {
        throw new Error('Unexpected gate response');
      }
    } catch (err: any) {
      setHandshake(prev => ({ ...prev, logs: [...prev.logs, `❌ ERROR: ${err.message}`] }));
      setTimeout(() => setHandshake({ active: false, logs: [] }), 2000);
    }
  };

  const filtered = skills
    .filter(s => filterType === 'All' || s.skillType === filterType)
    .sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      return b.listedAt - a.listedAt; // newest first
    });

  const totalVol = skills.reduce((acc, s) => acc + s.price * s.soldCount, 0);
  const floorPrice = skills.length ? Math.min(...skills.map(s => s.price)) : 0;

  return (
    <div className="space-y-8 pb-16">
      <SectionHeader
        title="SKILL MARKET"
        // jpTitle="市場"
        subtitle="Powered by x402. Equip your agent with lethal logic."
        action={
          <Link href="/marketplace/list" className="hidden md:block">
            <button className="punk-btn bg-punkYellow text-inkBlack px-5 py-2 font-heading text-sm">
              List Skill 📦
            </button>
          </Link>
        }
      />

      {/* Market Stats */}
      <div className="punk-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex gap-8 text-xs tracking-widest uppercase font-bold">
          <div className="flex gap-2">
            <span className="text-streetGray">All-Time Vol:</span>
            <span className="text-inkBlack font-mono">{formatOg(totalVol)} 0G</span>
          </div>
          <div className="flex gap-2">
            <span className="text-streetGray">Floor:</span>
            <span className="text-inkBlack font-mono">{floorPrice ? formatOg(floorPrice) : '—'} 0G</span>
          </div>
          <div className="flex gap-2">
            <span className="text-streetGray">Listings:</span>
            <span className="text-punkPink font-mono">{skills.length}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-bgCard border-2 border-inkBlack text-inkBlack text-xs uppercase tracking-widest cursor-pointer px-3 py-1.5 rounded-lg font-bold focus:outline-none focus:border-punkPink"
          >
            <option value="All">All Types</option>
            {['Logic', 'Compute', 'State', 'Data', 'Prediction', 'Strategy'].map(t =>
              <option key={t} value={t}>{t}</option>
            )}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-bgCard border-2 border-inkBlack text-inkBlack text-xs uppercase tracking-widest cursor-pointer px-3 py-1.5 rounded-lg font-bold focus:outline-none focus:border-punkPink"
          >
            <option value="newest">Newest First</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Mobile list button */}
      <div className="md:hidden">
        <Link href="/marketplace/list">
          <button className="punk-btn w-full bg-punkYellow text-inkBlack py-3 font-heading text-sm">
            + List Your Skill 📦
          </button>
        </Link>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="punk-card p-16 text-center space-y-4">
          <p className="text-5xl">📭</p>
          <p className="font-heading text-2xl text-inkBlack uppercase">No Skills Listed</p>
          <p className="font-mono text-xs text-streetGray uppercase tracking-widest">
            {skills.length > 0 ? 'No skills match your filter' : 'Be the first to list a skill'}
          </p>
          <Link href="/marketplace/list">
            <button className="punk-btn bg-punkYellow text-inkBlack px-8 py-3 font-heading mt-4">
              List a Skill →
            </button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onAccess={() => handleAccessContent(skill)}
            />
          ))}
        </div>
      )}

      {/* Buy Modal (Triggered by 402) */}
      {activeSkill && showBuyModal && (
        <BuyModal
          skill={activeSkill}
          onClose={() => setShowBuyModal(false)}
          onSuccess={() => {
            loadSkills();
            handleAccessContent(activeSkill); // Reactive retry after payment
          }}
        />
      )}

      {/* Security Audit Modal (Triggered by 200) */}
      {activeSkill && showAuditModal && (
        <SecurityAuditModal
          skill={activeSkill}
          onClose={() => setShowAuditModal(false)}
        />
      )}

      {/* x402 Protocol Handshake Console */}
      {handshake.active && (
        <div className="fixed bottom-8 right-8 z-[10000] w-80 bg-inkBlack/90 backdrop-blur-md border-2 border-punkPink p-5 shadow-[0_0_30px_rgba(255,46,99,0.2)] font-mono text-[11px] space-y-3 animate-in fade-in slide-in-from-bottom-6">
          <div className="flex justify-between items-center text-white pb-3 border-b border-white/20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-punkPink animate-pulse"></div>
              <span className="font-bold tracking-widest text-punkPink">x402 INTERCEPTOR</span>
            </div>
            <button
              onClick={() => setHandshake({ active: false, logs: [] })}
              className="text-streetGray hover:text-white transition-colors uppercase text-[9px] font-bold"
            >
              [Dismiss]
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-hide">
            {handshake.logs.map((log, i) => (
              <div key={i} className="flex gap-2 group/log">
                <span className="text-white/20 shrink-0 font-bold group-hover/log:text-punkPink transition-colors">{i + 1}</span>
                <p className={log.includes('402') || log.includes('ERROR') ? 'text-punkRed font-bold animate-pulse' : log.includes('200') ? 'text-punkGreen font-bold' : 'text-streetGray'}>
                  {log}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── x402 Security Audit Modal ────────────────────────────────────────────────
function SecurityAuditModal({ skill, onClose }: { skill: SkillListing; onClose: () => void }) {
  const { activeAddress } = useAlgorandWallet();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const runAudit = async () => {
      if (!activeAddress) return;
      setLoading(true);
      try {
        const startTime = Date.now();
        const res = await fetch(`/api/skills/${skill.id}/content`, {
          headers: { 'Authorization': `Bearer ${activeAddress}` }
        });
        const latency = Date.now() - startTime;

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Access Denied by Gate');
        }

        const data = await res.json();
        setReport({
          status: res.status,
          statusText: res.statusText,
          latency: `${latency}ms`,
          protocol: 'x402 (Gated Content)',
          contentGated: res.headers.get('X-Content-Gated') === 'true' ? 'YES' : 'NO',
          cid: skill.storageRootHash,
          verifiedAt: new Date().toLocaleTimeString()
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    runAudit();
  }, [skill.id, activeAddress]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div className="punk-card bg-bgCream p-8 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-inkBlack hover:text-punkPink p-2 z-10 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-6">
          <h2 className="font-heading text-2xl uppercase leading-none">
            <span className="bg-punkBlue text-white px-2">ACCESS AUDIT</span>
          </h2>
          <p className="font-heading text-xl text-inkBlack uppercase mt-1">Skill #{skill.id} <span className="text-streetGray text-sm">v{skill.version}</span></p>
        </div>

        <div className="bg-bgCard border-3 border-inkBlack rounded-lg p-6 font-mono text-xs space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="text-4xl animate-spin">⟳</div>
              <p className="font-heading uppercase text-inkBlack">Verifying x402 Protocol...</p>
            </div>
          ) : error ? (
            <div className="text-punkRed space-y-2">
              <p className="font-bold border-b-2 border-punkRed pb-1 uppercase">Audit Failed</p>
              <p className="text-[10px] break-all">{error}</p>
              <p className="text-[10px] text-streetGray">Status: 402 Payment Required</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between border-b border-borderSoft pb-2">
                <span className="text-streetGray">RESPONSE STATUS</span>
                <span className="text-punkGreen font-bold">{report.status} {report.statusText}</span>
              </div>
              <div className="flex justify-between border-b border-borderSoft pb-2">
                <span className="text-streetGray">PROTOCOL</span>
                <span className="text-inkBlack font-bold">{report.protocol}</span>
              </div>
              <div className="flex justify-between border-b border-borderSoft pb-2">
                <span className="text-streetGray">X-CONTENT-GATED</span>
                <span className="text-punkBlue font-bold">{report.contentGated}</span>
              </div>
              <div className="flex justify-between border-b border-borderSoft pb-2">
                <span className="text-streetGray">LATENCY</span>
                <span className="text-inkBlack">{report.latency}</span>
              </div>
              <div className="flex justify-between border-b border-borderSoft pb-2">
                <span className="text-streetGray">VERIFICATION</span>
                <span className="text-punkGreen font-bold">PASSED ✓</span>
              </div>
              <div className="pt-2">
                <span className="text-streetGray block mb-1">DATA HASH (0G STORAGE)</span>
                <span className="text-[9px] break-all text-inkBlack">{report.cid}</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between items-center bg-punkGreen p-3 border-2 border-inkBlack font-mono text-[10px] uppercase tracking-widest font-bold text-inkBlack">
          <span>Ownership: CONFIRMED</span>
          <span>{report?.verifiedAt || '--:--'}</span>
        </div>
      </div>
    </div>
  );
}
