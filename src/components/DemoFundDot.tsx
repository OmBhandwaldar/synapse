'use client';

import { useState } from 'react';

/**
 * A tiny, near-invisible dot in the footer. Only the operator knows it's here.
 * Clicking it sends a small amount of 0G from the pre-funded demo wallet to the
 * most recently deployed agent (a live-demo funding convenience).
 * State via color: dim = idle, amber = sending, green = funded, red = error.
 */
export function DemoFundDot() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function fund() {
    if (state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch('/api/demo/fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Optional secret slug — set NEXT_PUBLIC_DEMO_FUND_SLUG to match DEMO_FUND_SLUG.
        body: JSON.stringify({ slug: process.env.NEXT_PUBLIC_DEMO_FUND_SLUG }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState('done');
      setTimeout(() => setState('idle'), 4000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 4000);
    }
  }

  const color =
    state === 'sending' ? 'rgba(251,191,36,0.9)'
    : state === 'done' ? 'rgba(74,222,128,0.95)'
    : state === 'error' ? 'rgba(248,113,113,0.9)'
    : 'rgba(139,92,246,0.10)';

  return (
    <button
      onClick={fund}
      aria-hidden="true"
      tabIndex={-1}
      title=""
      style={{
        width: 8,
        height: 8,
        borderRadius: 9999,
        background: color,
        border: 'none',
        padding: 0,
        cursor: 'default',
        transition: 'background 200ms ease',
      }}
    />
  );
}
