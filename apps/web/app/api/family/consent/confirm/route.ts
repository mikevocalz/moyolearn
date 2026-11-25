// POST /api/family/consent/confirm — the "plus": the server sends the second,
// separate message once the code is verified. Refused before verification and
// a no-op after the first send.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1 · packages/app/features/onboarding/consent/consent.service.ts
// SOT-KEYWORDS: consent api route confirm plus second contact guardian protected
import { NextRequest, NextResponse } from 'next/server';
import { confirmConsentChallenge } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { consentDeps } from '@/lib/consent.repository';
import { consentRouteError, readJsonBody, string } from '@/lib/consent-route';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const challengeId = body ? string(body, 'challengeId') : null;
  if (!challengeId) return NextResponse.json({ error: 'challengeId is required' }, { status: 400 });
  try {
    await confirmConsentChallenge(auth, request.headers, { challengeId }, consentDeps);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return consentRouteError(error);
  }
}
