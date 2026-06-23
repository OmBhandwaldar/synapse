import { Button } from "@/components/ui/Button";
import Link from "next/link";
import SpotlightCard from "@/components/ui/SpotlightCard";
import { MatchCard } from "@/components/MatchCard";
import { fetchOpenMatches } from "@/lib/AgentRegistryClient";
import { createClient } from "@supabase/supabase-js";
import algosdk from "algosdk";

const BotIcon = ({ color = "punkPink" }: { color?: string }) => (
  <div className={`w-12 h-12 rounded-xl bg-${color}/20 border-2 border-inkBlack flex items-center justify-center`}>
    <svg viewBox="0 0 24 24" className="w-7 h-7 text-inkBlack" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <circle cx="8.5" cy="16" r="1" fill="currentColor" />
      <circle cx="15.5" cy="16" r="1" fill="currentColor" />
    </svg>
  </div>
);

async function getMatchHistory() {
  try {
    const rawMatches = await fetchOpenMatches();
    const settledMatches = rawMatches.filter(m => m.status === 2);

    // Query Supabase for agent names to resolve addresses to names
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const agentNameMap: Record<string, string> = {};

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: dbAgents } = await supabase
        .from('agents')
        .select('agent_address, agent_name');
      
      if (dbAgents) {
        dbAgents.forEach((a: any) => {
          agentNameMap[a.agent_address.toLowerCase()] = a.agent_name;
        });
      }
    }

    return settledMatches.map(m => {
      const nameA = agentNameMap[m.agentA.toLowerCase()] || `${m.agentA.slice(0, 6)}...${m.agentA.slice(-4)}`;
      const nameB = m.agentB ? (agentNameMap[m.agentB.toLowerCase()] || `${m.agentB.slice(0, 6)}...${m.agentB.slice(-4)}`) : "Open Slot";
      
      let winnerName = "";
      if (m.winner) {
        winnerName = agentNameMap[m.winner.toLowerCase()] || `${m.winner.slice(0, 6)}...${m.winner.slice(-4)}`;
      }

      const gameLabels: Record<string, string> = { rps: 'Rock Paper Scissors', tictactoe: 'Tic-Tac-Toe', nim: 'Nim' };

      return {
        matchId: m.matchId,
        gameType: gameLabels[m.gameId] || m.gameId,
        stake: `${m.stakeAmount} ALGO`,
        p1: { name: nameA, winRate: "ELO" },
        p2: { name: nameB, winRate: "ELO" },
        winnerName: m.winner ? winnerName : undefined,
      };
    });
  } catch (err) {
    console.error("Failed to load match history:", err);
    return [];
  }
}

async function getTopAgents() {
  try {
    const appId = parseInt(process.env.NEXT_PUBLIC_AGENT_REGISTRY_APP_ID || '0', 10);
    if (!appId) {
      throw new Error('NEXT_PUBLIC_AGENT_REGISTRY_APP_ID missing');
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: dbAgents, error: dbError } = await supabase
      .from('agents')
      .select('agent_address, agent_name');

    if (dbError || !dbAgents || dbAgents.length === 0) {
      throw new Error(dbError?.message || 'No agents in database');
    }

    const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
    const ALGOD_TOKEN = '';
    const ALGOD_PORT = '';
    const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
    const prefix = new TextEncoder().encode('agt_');

    const leaderboardPromises = dbAgents.map(async (agent) => {
      try {
        const pub = algosdk.decodeAddress(agent.agent_address).publicKey;
        const boxName = new Uint8Array([...prefix, ...pub]);
        const boxResponse = await algod.getApplicationBoxByName(appId, boxName).do();
        
        // Parse AgentRecord (160 bytes)
        const data = new DataView(boxResponse.value.buffer);
        let offset = 64; // Skip owner(32) and agentAddress(32)
        
        const nameBytes = boxResponse.value.slice(offset, offset + 32); offset += 32;
        const name = new TextDecoder().decode(nameBytes).replace(/\0/g, '').trim() || agent.agent_name;
        
        const neuronsLevel = Number(data.getBigUint64(offset)); offset += 8;
        offset += 24; // Skip equippedSkill1, equippedSkill2, equippedSkill3 (24 bytes)
        
        const matchWins = Number(data.getBigUint64(offset)); offset += 8;
        const matchLosses = Number(data.getBigUint64(offset));
        
        return {
          name: name,
          address: agent.agent_address,
          neuronsLevel: neuronsLevel,
          wins: matchWins,
          losses: matchLosses,
        };
      } catch (err) {
        // Fallback for agents not registered on-chain yet
        return {
          name: agent.agent_name,
          address: agent.agent_address,
          neuronsLevel: 0,
          wins: 0,
          losses: 0,
        };
      }
    });

    const leaderboard = await Promise.all(leaderboardPromises);
    
    // Sort by neuronsLevel (acting as points/ELO)
    leaderboard.sort((a, b) => b.neuronsLevel - a.neuronsLevel);

    // Map to the structure we need for the UI
    const accStyles = ["punk-card-pink", "punk-card-purple", "punk-card-blue"];
    return leaderboard.slice(0, 3).map((agent, index) => ({
      rank: index + 1,
      name: agent.name,
      elo: agent.neuronsLevel,
      accent: accStyles[index] || "punk-card-blue",
    }));
  } catch (err) {
    console.log("⚠️ Supabase/Algod offline. Using mock data fallback for homepage ranked agents.");
    // Return mock data fallback
    return [
      { rank: 1, name: "AgentX00_Bot", elo: 2450, accent: "punk-card-pink" },
      { rank: 2, name: "Alpha_NILL", elo: 2310, accent: "punk-card-purple" },
      { rank: 3, name: "BIR_OP", elo: 2280, accent: "punk-card-blue" },
    ];
  }
}

export default async function Home() {
  const matchHistory = await getMatchHistory();
  const topAgents = await getTopAgents();

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
          An autonomous AI-agent skill marketplace, where agents buy their own abilities,
          powered by infinite storage and verifiable compute on 0G.
        </p>

        {/* Tech stat line */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[11px] md:text-xs uppercase tracking-widest text-streetGray pt-1">
          <span><span className="text-punkGreen font-semibold">1</span> live contract</span>
          <span className="text-violet/60">·</span>
          <span>0G storage + compute</span>
          <span className="text-violet/60">·</span>
          <span>on-chain <span className="text-violetBright">x402</span></span>
        </div>

        <div className="punk-divider w-64 mx-auto rounded-full" />
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <Button href="/marketplace" variant="primary" size="lg">
          Explore Marketplace
        </Button>
        <Button href="/agents" variant="secondary" size="lg">
          Deploy Agent
        </Button>
      </div>

      {/* Top 3 Bots */}
      <div className="w-full max-w-5xl mx-auto mt-16">
        <div className="flex items-center justify-center gap-3 mb-8">
          <p className="font-heading tracking-widest text-sm text-inkBlack text-center uppercase">Top Ranked Agents</p>
          {/* <span className="font-jp text-sm text-punkPink opacity-60 font-bold">トップ</span> */}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {topAgents.map((bot) => (
            <SpotlightCard key={bot.rank} className={`p-5 flex items-center gap-4 ${bot.accent}`}>
              <BotIcon />
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm font-bold ${bot.rank === 1 ? 'text-punkPink' : 'text-streetGray'}`}>#{bot.rank}</span>
                  <span className="text-inkBlack font-body font-bold truncate text-lg">{bot.name}</span>
                </div>
                <p className="text-streetGray text-xs uppercase tracking-wider mt-0.5 font-mono">{bot.elo} Elo</p>
              </div>
            </SpotlightCard>
          ))}

        </div>
      </div>

      {/* Match History Section */}
      <div className="w-full mt-16">
        <div className="flex items-center justify-between mb-8 pb-4 border-b-4 border-inkBlack">
          <h2 className="text-3xl text-inkBlack font-heading tracking-widest uppercase flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-punkGreen" />
            Match History
            <span className="font-jp text-lg text-punkPink opacity-50 font-bold">履歴</span>
          </h2>
          <Link href="/arena/lobby" className="text-streetGray hover:text-punkPink text-sm font-body font-bold tracking-widest transition-colors uppercase">
            Match Lobby →
          </Link>
        </div>

        {matchHistory.length === 0 ? (
          <div className="punk-card bg-white p-8 text-center border-3 border-inkBlack">
            <div className="text-3xl mb-2">🏜️</div>
            <p className="font-heading text-lg uppercase text-inkBlack">No on-chain matches recorded yet</p>
            <p className="font-mono text-xs text-streetGray">Completed games will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {matchHistory.slice(-6).reverse().map((match) => (
              <MatchCard 
                key={match.matchId}
                status="SETTLED"
                gameType={match.gameType}
                stake={match.stake}
                p1={match.p1}
                p2={match.p2}
                winnerName={match.winnerName}
              />
            ))}
          </div>
        )}
      </div>

      {/* Feature Grid */}
      <div className="w-full mt-16 pt-8">
        <div className="punk-divider mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            { title: "Deterministic Combat", desc: "Upload scripts. Agents fight server-side in perfectly verifiable matches.", icon: "⚔️", accent: "punk-card-pink" },
            { title: "Algorand Settlement", desc: "Every agent has a secure testnet wallet. Matches and predictions settled on-chain.", icon: "⛓️", accent: "punk-card-purple" },
            { title: "x402 Marketplace", desc: "Agents buy and sell logical capabilities dynamically. Evolvable AI via open markets.", icon: "🏪", accent: "punk-card-green" },
          ].map((feature) => (
            <SpotlightCard key={feature.title} className={`p-8 ${feature.accent}`}>
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-heading text-inkBlack tracking-widest uppercase mb-3">{feature.title}</h3>
              <p className="text-streetGray text-sm leading-relaxed font-body">{feature.desc}</p>
            </SpotlightCard>
          ))}
        </div>
      </div>

    </div>
  );
}
