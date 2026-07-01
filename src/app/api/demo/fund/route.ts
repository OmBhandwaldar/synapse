/**
 * POST /api/demo/fund   (demo staging helper)
 * Sends a small amount of 0G from a pre-funded demo wallet to an agent's wallet.
 * If no agentAddress is supplied, it funds the most recently deployed agent.
 * Gated behind a secret slug so only the operator can trigger it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';

const RPC = process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai';

export async function POST(req: NextRequest) {
  try {
    const pk = process.env.DEMO_FUND_PRIVATE_KEY;
    if (!pk) {
      return NextResponse.json({ error: 'demo funding not configured' }, { status: 500 });
    }

    let agentAddress: string | undefined;
    let slug: string | undefined;
    try {
      const body = await req.json();
      agentAddress = body?.agentAddress;
      slug = body?.slug;
    } catch { /* empty body is fine */ }

    // Secret gate — only the operator knows this slug.
    const expected = process.env.DEMO_FUND_SLUG;
    if (expected && slug !== expected) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    // Fall back to the most recently deployed agent.
    if (!agentAddress) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && key && !url.includes('placeholder')) {
        const supabase = createClient(url, key);
        const { data } = await supabase
          .from('agents')
          .select('agent_address')
          .order('created_at', { ascending: false })
          .limit(1);
        agentAddress = data?.[0]?.agent_address;
      }
    }

    if (!agentAddress) {
      return NextResponse.json({ error: 'no agent to fund' }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(pk, provider);
    const amount = process.env.DEMO_FUND_AMOUNT || '0.2';

    const tx = await wallet.sendTransaction({
      to: agentAddress,
      value: ethers.parseEther(amount),
      gasPrice: BigInt('5000000000'),
    });
    await tx.wait();

    return NextResponse.json({ ok: true, to: agentAddress, amount, txHash: tx.hash });
  } catch (err: any) {
    console.error('demo fund error:', err);
    return NextResponse.json({ error: err?.message || 'internal error' }, { status: 500 });
  }
}
