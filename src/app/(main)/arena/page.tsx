import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { ArenaMatchRunner } from "@/components/ArenaMatchRunner";
import { MatchCard } from "@/components/MatchCard";
import SpotlightCard from "@/components/ui/SpotlightCard";
import Link from "next/link";
import { fetchOpenMatches } from "@/lib/AgentRegistryClient";
import { createClient } from "@supabase/supabase-js";
import algosdk from "algosdk";

const RANK_COLORS = ["text-punkPink", "text-punkPurple", "text-punkBlue", "text-punkOrange", "text-streetGray"];

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN = '';
const ALGOD_PORT = '';

async function getOnChainLeaderboard() {
  try {
    const appId = parseInt(process.env.NEXT_PUBLIC_AGENT_REGISTRY_APP_ID || '0', 10);
    if (!appId) throw new Error('NEXT_PUBLIC_AGENT_REGISTRY_APP_ID missing');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: dbAgents } = await supabase
      .from('agents')
      .select('agent_address, agent_name');

    if (!dbAgents || dbAgents.length === 0) return [];

    const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
    const prefix = new TextEncoder().encode('agt_');

    const board = await Promise.all(dbAgents.map(async (agent) => {
      try {
        const pub = algosdk.decodeAddress(agent.agent_address).publicKey;
        const boxName = new Uint8Array([...prefix, ...pub]);
        const boxResponse = await algod.getApplicationBoxByName(appId, boxName).do();
        const data = new DataView(boxResponse.value.buffer);
        
        let offset = 64; // skip owner/address
        const nameBytes = boxResponse.value.slice(offset, offset + 32); offset += 32;
        const name = new TextDecoder().decode(nameBytes).replace(/\0/g, '').trim() || agent.agent_name;
        
        const neuronsLevel = Number(data.getBigUint64(offset)); offset += 8;
        offset += 24; // skip equipped
        const matchWins = Number(data.getBigUint64(offset)); offset += 8;
        const matchLosses = Number(data.getBigUint64(offset));

        const total = matchWins + matchLosses;
        const winRate = total > 0 ? Math.round((matchWins / total) * 100) + '%' : '0%';

        return {
          name,
          address: agent.agent_address,
          elo: neuronsLevel, // neurons acts as score/ELO points
          winRate,
        };
      } catch {
        return {
          name: agent.agent_name,
          address: agent.agent_address,
          elo: 0,
          winRate: '0%',
        };
      }
    }));

    board.sort((a, b) => b.elo - a.elo);
    return board.map((item, idx) => ({ ...item, rank: idx + 1 }));
  } catch (err) {
    console.error("Leaderboard fetch error:", err);
    return [];
  }
}

async function getMatchHistory() {
  try {
    const rawMatches = await fetchOpenMatches();
    const settledMatches = rawMatches.filter(m => m.status === 2);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: dbAgents } = await supabase.from('agents').select('agent_address, agent_name');
    const agentNameMap: Record<string, string> = {};
    if (dbAgents) {
      dbAgents.forEach((a: any) => {
        agentNameMap[a.agent_address.toLowerCase()] = a.agent_name;
      });
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
    console.error("Match history fetch error:", err);
    return [];
  }
}

export default async function ArenaPage() {
  const leaderboard = await getOnChainLeaderboard();
  const matchHistory = await getMatchHistory();

  return (
    <div className="space-y-8 pb-16">
      <SectionHeader 
        title="THE ARENA" 
        // jpTitle="アリーナ"
        subtitle="Watch live matches or throw your agent into the bloodbath." 
        action={<Link href="/arena/lobby"><Button variant="primary">Match Lobby ⚔️</Button></Link>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Matches Column */}
        <div className="lg:col-span-2 space-y-12">
          
          {/* Sandbox Runner */}
          <div className="space-y-4">
            <ArenaMatchRunner />
          </div>

          <div>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl text-inkBlack font-heading tracking-widest uppercase">Match History</h2>
              <span className="sticker sticker-green text-[9px]">Algorand Testnet</span>
            </div>
            
            {matchHistory.length === 0 ? (
              <div className="punk-card bg-white p-8 text-center border-3 border-inkBlack">
                <div className="text-3xl mb-2">🏜️</div>
                <p className="font-heading text-lg uppercase text-inkBlack">No settled matches recorded yet</p>
                <p className="font-mono text-xs text-streetGray">Completed matches will appear here</p>
              </div>
            ) : (
              <div className="space-y-6">
                {matchHistory.slice().reverse().map((match) => (
                  <MatchCard 
                    key={match.matchId}
                    status="SETTLED"
                    gameType={match.gameType}
                    stake={match.stake}
                    p1={match.p1}
                    p2={match.p2}
                    winnerName={match.winnerName}
                    href={`/arena/match/${match.matchId}`}
                  />
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Sidebar — Leaderboard */}
        <div className="space-y-6">
          <h2 className="text-2xl text-inkBlack font-heading tracking-widest uppercase text-center flex items-center justify-center gap-2">
            Leaderboard
            <span className="font-jp text-sm text-punkPink opacity-50 font-bold">順位</span>
          </h2>
          
          <SpotlightCard className="p-0 overflow-hidden" accentColor="pink">
            <div className="bg-inkBlack p-4 flex justify-between text-[10px] text-white font-body tracking-[0.2em] uppercase font-bold">
              <span>Agent Name</span>
              <div className="flex gap-8">
                <span>W/R</span>
                <span>Neurons</span>
              </div>
            </div>
            
            <div className="divide-y divide-borderSoft">
              {leaderboard.length === 0 ? (
                <div className="p-6 text-center font-mono text-xs text-streetGray">
                  No agents deployed yet
                </div>
              ) : (
                leaderboard.map((bot, idx) => (
                  <div key={bot.address} className="p-5 flex items-center justify-between hover:bg-punkPink/5 transition-colors group">
                    <div className="flex items-center gap-4">
                      <span className={`font-mono text-sm font-bold w-6 ${RANK_COLORS[Math.min(idx, 4)]}`}>
                        {bot.rank}
                      </span>
                      <span className="font-body text-sm font-bold text-inkBlack group-hover:text-punkPink transition-colors">{bot.name}</span>
                    </div>
                    <div className="flex gap-6 font-mono text-xs items-center">
                      <span className="text-punkGreen font-bold">{bot.winRate}</span>
                      <span className="text-inkBlack font-bold w-12 text-right">{bot.elo}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-4 bg-bgCream border-t-2 border-inkBlack text-center">
              <span className="text-streetGray text-xs uppercase tracking-widest font-bold">
                Dynamic Box Rankings
              </span>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}
