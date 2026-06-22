/**
 * POST /api/agent/reregister
 * 
 * Re-registers all existing agents from Supabase onto the new AgentRegistry contract.
 * Called once after a contract redeployment.
 * Uses the TESTNET_DEPLOYER_MNEMONIC to pay MBR fees on behalf of the owner.
 * 
 * Note: The owner field in the new contract will be the agent's original owner address.
 * The deployer just pays the fees — ownership stays correct.
 */
import { NextRequest, NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';

export async function POST(req: NextRequest) {
  try {
    const adminMnemonic = process.env.TESTNET_DEPLOYER_MNEMONIC;
    if (!adminMnemonic) {
      return NextResponse.json({ error: 'TESTNET_DEPLOYER_MNEMONIC not set in .env.local' }, { status: 500 });
    }

    const algod = new algosdk.Algodv2('', ALGOD_SERVER, 443);
    const appId = Number(process.env.NEXT_PUBLIC_AGENT_REGISTRY_APP_ID);
    const appAddress = algosdk.getApplicationAddress(appId);

    // We'll build and sign each registerAgent txn as the PLATFORM, specifying
    // the real owner address as the owner inside the agent record. But wait —
    // TEALScript uses txn.sender as the owner. So we need the OWNER to sign.
    // Instead, let's just return which agents need re-registration so the UI
    // can prompt re-registration for each owner when they next use the app.
    
    // Fetch all agents from supabase that are NOT yet on-chain
    const { data: agents, error } = await supabase
      .from('agents')
      .select('agent_address, owner_address, agent_name');

    if (error || !agents) {
      return NextResponse.json({ error: 'Failed to fetch agents from Supabase' }, { status: 500 });
    }

    // Check which ones are already on chain
    const pA = new TextEncoder().encode('agt_');
    const unregistered = [];
    const registered = [];

    for (const agent of agents) {
      try {
        const agentPub = algosdk.decodeAddress(agent.agent_address).publicKey;
        const boxName = new Uint8Array([...pA, ...agentPub]);
        await algod.getApplicationBoxByName(appId, boxName).do();
        registered.push(agent.agent_address);
      } catch {
        unregistered.push(agent);
      }
    }

    if (unregistered.length === 0) {
      return NextResponse.json({ message: 'All agents are already registered', registered, unregistered: [] });
    }

    // Re-register each unregistered agent using the platform deployer account
    // The contract uses txn.sender as the owner — so we need the owner to sign.
    // Instead, we return unsigned txns for the OWNER to sign.
    // Group them by owner so each owner signs their own agents.
    
    const byOwner: Record<string, typeof unregistered> = {};
    for (const a of unregistered) {
      if (!byOwner[a.owner_address]) byOwner[a.owner_address] = [];
      byOwner[a.owner_address].push(a);
    }

    const sp = await algod.getTransactionParams().do();
    const abiMethod = new algosdk.ABIMethod({
      name: 'registerAgent',
      args: [
        { type: 'pay', name: 'deployPayment' },
        { type: 'address', name: 'agentAddress' },
        { type: 'byte[32]', name: 'name' },
      ],
      returns: { type: 'void' },
    });

    // Return the txn groups per owner
    const txnGroups: Record<string, string[]> = {};

    for (const [ownerAddress, agentList] of Object.entries(byOwner)) {
      const ownerPub = algosdk.decodeAddress(ownerAddress).publicKey;
      const pO = new TextEncoder().encode('own_');
      const pC = new TextEncoder().encode('cnt_');
      const countBoxName = new Uint8Array([...new TextEncoder().encode('cnt_'), ...ownerPub]);

      let ownerCountValue = 0;
      try {
        const boxResponse = await algod.getApplicationBoxByName(appId, countBoxName).do();
        ownerCountValue = Number(algosdk.bytesToBigInt(boxResponse.value));
      } catch {}

      const agentTxns: string[] = [];

      for (let i = 0; i < agentList.length; i++) {
        const agent = agentList[i];
        const agentPub = algosdk.decodeAddress(agent.agent_address).publicKey;

        const nameBytes = new Uint8Array(32);
        const nameEncoded = new TextEncoder().encode((agent.agent_name || 'Agent').slice(0, 32));
        nameBytes.set(nameEncoded);

        const ownerCountBytes = algosdk.bigIntToBytes(ownerCountValue + i, 8);
        const underscore = new TextEncoder().encode('_');
        const lengthPrefix = new Uint8Array([0, 41]);
        const agentsByOwnerBoxName = new Uint8Array([...pO, ...lengthPrefix, ...ownerPub, ...underscore, ...ownerCountBytes]);

        // MBR payment to contract
        const feeTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: ownerAddress,
          receiver: appAddress,
          amount: 400_000,
          suggestedParams: sp,
        });

        // Fund agent wallet (so it can pay x402 fees later)
        const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: ownerAddress,
          receiver: agent.agent_address,
          amount: 500_000, // 0.5 ALGO minimum to be active
          suggestedParams: sp,
        });

        const callTxn = algosdk.makeApplicationCallTxnFromObject({
          sender: ownerAddress,
          appIndex: appId,
          onComplete: algosdk.OnApplicationComplete.NoOpOC,
          suggestedParams: { ...sp, fee: 2000, flatFee: true },
          appArgs: [abiMethod.getSelector(), agentPub, nameBytes],
          boxes: [
            { appIndex: appId, name: new Uint8Array([...pA, ...agentPub]) },
            { appIndex: appId, name: countBoxName },
            { appIndex: appId, name: agentsByOwnerBoxName },
          ],
        });

        const group = algosdk.assignGroupID([feeTxn, fundTxn, callTxn]);
        for (const txn of group) {
          agentTxns.push(Buffer.from(txn.toByte()).toString('base64'));
        }
      }

      txnGroups[ownerAddress] = agentTxns;
    }

    return NextResponse.json({
      message: `Found ${unregistered.length} unregistered agents`,
      registered,
      unregistered: unregistered.map(a => a.agent_address),
      txnGroups,
    });
  } catch (err: any) {
    console.error('[/api/agent/reregister]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
