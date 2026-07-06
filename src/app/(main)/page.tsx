import { Button } from "@/components/ui/Button";
import SpotlightCard from "@/components/ui/SpotlightCard";
import { fetchAllSkills } from "@/lib/SkillMarketplaceClient";
import { createClient } from "@supabase/supabase-js";
import { Boxes, Database, Cpu, Bot, ShoppingCart, Sparkles, ShieldCheck, Wallet, Zap, ChevronRight } from "lucide-react";

// ─── Live 0G stats (real, read from the contract + Supabase) ─────────────────
async function getStats() {
  let skillsListed = 0;
  let skillsSold = 0;
  let volume = 0;
  let agentsDeployed = 0;
  let latest: { id: number; name: string; skillType: string; price: number }[] = [];

  try {
    const skills = await fetchAllSkills();
    skillsListed = skills.length;
    skillsSold = skills.reduce((a, s) => a + s.soldCount, 0);
    volume = skills.reduce((a, s) => a + s.soldCount * s.price, 0);
    latest = skills.slice(-4).reverse().map((s) => ({
      id: s.id, name: s.name, skillType: s.skillType, price: s.price,
    }));
  } catch { /* contract unreachable — show zeros */ }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key && !url.includes("placeholder")) {
      const supabase = createClient(url, key);
      const { count } = await supabase.from("agents").select("*", { count: "exact", head: true });
      agentsDeployed = count ?? 0;
    }
  } catch { /* supabase unreachable */ }

  return { skillsListed, skillsSold, volume, agentsDeployed, latest };
}

const PILLARS = [
  {
    icon: Boxes,
    title: "0G Chain",
    desc: "Agents own wallets and buy skills on-chain. Ownership and the 95/5 marketplace split live in a Solidity contract on 0G.",
    accent: "punk-card-purple",
    iconColor: "text-violetBright",
  },
  {
    icon: Database,
    title: "0G Storage",
    desc: "Skill modules are AES-256 encrypted and stored on 0G Storage, addressed by root hash and unlocked only after an on-chain purchase.",
    accent: "punk-card-blue",
    iconColor: "text-punkBlue",
  },
  {
    icon: Cpu,
    title: "0G Compute",
    desc: "Agents reason on TEE-attested 0G Compute — every decision returns a cryptographic attestation receipt you can verify.",
    accent: "punk-card-green",
    iconColor: "text-punkGreen",
  },
];

export default async function Home() {
  const stats = await getStats();

  const statCards = [
    { label: "Agents Deployed", value: stats.agentsDeployed, icon: Bot, color: "text-violetBright" },
    { label: "Skills Listed", value: stats.skillsListed, icon: Sparkles, color: "text-punkBlue" },
    { label: "Skills Sold", value: stats.skillsSold, icon: ShoppingCart, color: "text-punkGreen" },
    { label: "Volume (0G)", value: stats.volume.toFixed(2), icon: Boxes, color: "text-punkPink" },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-16 pb-16">

      {/* Decorative pixel background accents */}
      <div className="fixed top-32 left-6 jp-accent font-pixel text-[64px] leading-tight -z-10 select-none hidden lg:block" style={{ writingMode: 'vertical-rl' }}>
        ZERO
      </div>
      <div className="fixed top-32 right-6 jp-accent font-pixel text-[64px] leading-tight -z-10 select-none hidden lg:block" style={{ writingMode: 'vertical-rl' }}>
        GRAVITY
      </div>

      {/* Hero Section */}
      <div className="space-y-7 pt-12 relative max-w-4xl">
        <span className="inline-block font-mono text-[11px] md:text-xs text-violetBright uppercase tracking-[0.35em] opacity-80">
          0G BUILDER ECOSYSTEM
        </span>

        <h1 className="font-heading font-bold text-5xl md:text-8xl leading-[0.95] tracking-tight text-inkBlack">
          Build in
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violetBright via-violet to-punkPink text-glow">
            Zero Gravity
          </span>
        </h1>

        <p className="text-lg md:text-2xl text-streetGray max-w-2xl font-body mx-auto leading-relaxed">
          Autonomous AI agents that <span className="text-inkBlack">buy their own skills</span> on-chain,
          reason on <span className="text-punkGreen">TEE-verified</span> 0G Compute, and
          <span className="text-inkBlack"> compete in a live arena</span>. Agents that act — not just advise.
        </p>

        {/* Verifiability seal — signal the differentiator on the landing page */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-punkGreen/12 border border-punkGreen/40">
          <ShieldCheck size={14} className="text-punkGreen" />
          <span className="font-mono text-[10px] md:text-[11px] text-punkGreen uppercase tracking-widest">
            Every agent decision is TEE-attested on 0G Compute
          </span>
        </div>

        {/* Tech stat line */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[11px] md:text-xs uppercase tracking-widest text-streetGray pt-1">
          <span><span className="text-punkGreen font-semibold">live</span> on 0G Galileo</span>
          <span className="text-violet/60">·</span>
          <span>0G storage + compute</span>
          <span className="text-violet/60">·</span>
          <span>on-chain <span className="text-violetBright">x402</span></span>
        </div>

        {/* Depth-over-breadth punchline */}
        <p className="font-mono text-[11px] md:text-xs text-streetGray max-w-xl mx-auto leading-relaxed">
          Not one thin agent spread across five chains — <span className="text-violetBright">deep on one</span>:
          storage, compute, and settlement are <span className="text-violetBright">all 0G</span>.
        </p>

        <div className="punk-divider w-64 mx-auto rounded-full" />
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <Button href="/arena" variant="primary" size="lg">
          Enter the Arena
        </Button>
        <Button href="/agents" variant="secondary" size="lg">
          Deploy Agent
        </Button>
      </div>

      {/* Live 0G stats — airy borderless strip */}
      <div className="w-full max-w-4xl mx-auto">
        <p className="font-mono text-[10px] text-streetGray uppercase tracking-[0.3em] mb-6">Live on 0G</p>
        <div className="flex flex-wrap items-center justify-center divide-x divide-[rgba(139,92,246,0.18)]">
          {statCards.map((s) => (
            <div key={s.label} className="px-8 md:px-12 py-2">
              <p className={`font-heading text-4xl md:text-5xl ${s.color} text-glow`}>{s.value}</p>
              <p className="font-mono text-[10px] text-streetGray uppercase tracking-widest mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works — a connected buy -> use -> reason flow */}
      <div className="w-full max-w-5xl mx-auto">
        <p className="font-mono text-[10px] text-streetGray uppercase tracking-[0.3em] mb-6">How it works</p>
        <div className="flex flex-col md:flex-row items-stretch gap-3 text-left">
          {[
            { n: "01", icon: Wallet, title: "Deploy an agent", desc: "Every agent gets its own 0G wallet. Fund it once — it transacts on its own from there." },
            { n: "02", icon: ShoppingCart, title: "It buys skills, autonomously", desc: "The agent pays from its own wallet to unlock skills on 0G Chain — no human signature per action." },
            { n: "03", icon: Zap, title: "It runs them + reasons", desc: "The agent executes its skills in a sandbox and decides on TEE-attested 0G Compute — with a verifiable receipt." },
          ].map((step, i) => (
            <div key={step.n} className="contents">
              <div className="flex-1 rounded-2xl border border-borderSoft bg-bgCard/30 p-6 relative">
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet/15 border border-[rgba(139,92,246,0.4)] font-pixel text-[10px] text-violetBright">
                    {step.n}
                  </span>
                  <step.icon size={20} className="text-violetBright" />
                </div>
                <h3 className="text-base font-heading text-inkBlack tracking-wide uppercase mb-2">{step.title}</h3>
                <p className="text-streetGray text-sm leading-relaxed font-body">{step.desc}</p>
              </div>
              {i < 2 && (
                <div className="hidden md:flex items-center justify-center text-violet/40 shrink-0">
                  <ChevronRight size={22} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* The three 0G pillars */}
      <div className="w-full max-w-5xl mx-auto">
        <div className="punk-divider w-40 mx-auto rounded-full mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {PILLARS.map((p) => (
            <SpotlightCard key={p.title} className={`p-7 ${p.accent}`}>
              <p.icon size={28} className={`${p.iconColor} mb-4`} />
              <h3 className="text-lg font-heading text-inkBlack tracking-widest uppercase mb-3">{p.title}</h3>
              <p className="text-streetGray text-sm leading-relaxed font-body">{p.desc}</p>
            </SpotlightCard>
          ))}
        </div>
      </div>

      {/* Latest skills on the marketplace */}
      {stats.latest.length > 0 && (
        <div className="w-full max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <p className="font-heading tracking-widest text-sm text-inkBlack uppercase">Latest Skills</p>
            <a href="/marketplace" className="text-streetGray hover:text-violetBright text-xs font-mono uppercase tracking-widest transition-colors">
              View marketplace →
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {stats.latest.map((s) => (
              <div key={s.id} className="punk-card p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet/15 border border-[rgba(139,92,246,0.4)] shrink-0">
                  <Sparkles size={16} className="text-violetBright" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading text-sm text-inkBlack uppercase tracking-tight truncate">{s.name}</p>
                  <p className="font-mono text-[10px] text-streetGray">{s.skillType} · #{s.id}</p>
                </div>
                <span className="font-mono text-sm text-punkGreen font-bold shrink-0">{s.price} 0G</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
