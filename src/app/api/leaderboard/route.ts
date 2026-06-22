import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import algosdk from 'algosdk';

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN = '';
const ALGOD_PORT = '';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const appId = parseInt(process.env.NEXT_PUBLIC_AGENT_REGISTRY_APP_ID || '0', 10);
    if (!appId) {
      throw new Error('NEXT_PUBLIC_AGENT_REGISTRY_APP_ID missing');
    }

    const { data: dbAgents, error: dbError } = await supabase
      .from('agents')
      .select('agent_address, agent_name');

    if (dbError || !dbAgents) {
      console.warn("Supabase fetch agents failed for leaderboard:", dbError);
      return NextResponse.json({ leaderboard: [] });
    }

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
        
        const eggsLevel = Number(data.getBigUint64(offset)); offset += 8;
        offset += 24; // Skip equippedSkill1, equippedSkill2, equippedSkill3 (24 bytes)
        
        const matchWins = Number(data.getBigUint64(offset)); offset += 8;
        const matchLosses = Number(data.getBigUint64(offset));
        
        const totalMatches = matchWins + matchLosses;
        const winRate = totalMatches > 0 ? ((matchWins / totalMatches) * 100).toFixed(1) + '%' : '0.0%';

        return {
          name: name,
          address: agent.agent_address,
          eggsLevel: eggsLevel,
          wins: matchWins,
          losses: matchLosses,
          winRate,
        };
      } catch (err) {
        // Fallback for agents not registered on-chain yet
        return {
          name: agent.agent_name,
          address: agent.agent_address,
          eggsLevel: 0,
          wins: 0,
          losses: 0,
          winRate: '0.0%',
        };
      }
    });

    const leaderboard = await Promise.all(leaderboardPromises);
    
    // Sort by eggsLevel (acting as points/ELO)
    leaderboard.sort((a, b) => b.eggsLevel - a.eggsLevel);

    return NextResponse.json({ leaderboard });
  } catch (err: any) {
    console.error("Leaderboard API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
