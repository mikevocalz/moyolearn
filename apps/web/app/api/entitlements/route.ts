// GET /api/entitlements — the caller's own plans, for the client entitlement store.
//
// It carries no `requires`, so it runs at the default `practise` floor: reading
// what you are paying for must never itself depend on what you are paying for,
// or a lapsed account can never see why its features went away.
//
// Nothing here decides anything. The client uses this to choose what to SHOW;
// every operation that costs money is refused independently inside its own
// `protectedOperation` (packages/app/core/capability-gate.ts).
// SOT: docs/pack/06-auth-onboarding-spec.md §4 · CLAUDE.md (The block)
// SOT-KEYWORDS: entitlements api subscriptions plan protected operation route store
import { NextRequest, NextResponse } from 'next/server';
import { protectedOperation } from '@acme/app/server';
import { readSessionSubscriptions } from '@acme/auth/server';
import type { EntitlementsResponse } from '@acme/app';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const subscriptions = await protectedOperation(auth, request.headers, (ctx) =>
      // `ctx.learnerId`, never a query parameter: the orgs are derived from the
      // session's user id inside the reader.
      readSessionSubscriptions(auth, ctx.learnerId),
    );
    return NextResponse.json({ subscriptions } satisfies EntitlementsResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json(
      { error: message },
      { status: message === 'Unauthenticated' ? 401 : 500 },
    );
  }
}
