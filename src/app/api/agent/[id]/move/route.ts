/**
 * [DEFERRED] agent/[id]/move
 *
 * Not part of the 0G Group Stage scope (battle arena / matches / predictions /
 * legacy Algorand skill txn-builders). These depended on the removed Algorand
 * stack and will be re-implemented on 0G in a later round. Stubbed to keep the
 * build green.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Not implemented in the 0G Group Stage build (deferred to a later round).' },
    { status: 501 }
  );
}
