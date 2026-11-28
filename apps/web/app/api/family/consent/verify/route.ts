// POST /api/family/consent/verify — compare the typed code against the hash
// the server stored. The verdict is the consent machine's (wrong, expired,
// burnt, verified) and the attempt count is written back, so a guess costs
// something across requests.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1 · packages/app/features/onboarding/consent/consent.service.ts
// SOT-KEYWORDS: consent api route verify code hash attempts guardian protected
import { NextRequest, NextResponse } from 'next/server';
import { checkConsentCode } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { consentDeps } from '@/lib/consent.repository';
import { consentRouteError, readJsonBody, string } from '@/lib/consent-route';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const challengeId = body ? string(body, 'challengeId') : null;
  const code = body ? string(body, 'code') : null;
  if (!challengeId || !code) {
    return NextResponse.json({ error: 'challengeId and code are required' }, { status: 400 });
  }
  try {
    const result = await checkConsentCode(auth, request.headers, { challengeId, code }, consentDeps);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return consentRouteError(error);
  }
}
