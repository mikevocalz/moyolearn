// POST /api/family/consent/challenge — the server mints and mails a consent
// code to the guardian's own contact (doc 06 §3.1, email-plus's first contact).
// Behind `protectedOperation`: the guardian is the session's user. The code is
// in the mail and nowhere in the response; only the challenge id comes back.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1 · packages/app/features/onboarding/consent/consent.service.ts
// SOT-KEYWORDS: consent api route challenge code send guardian protected
import { NextRequest, NextResponse } from 'next/server';
import { issueConsentChallenge } from '@acme/app/server';
import type { ConsentMethod } from '@acme/auth';
import { auth } from '@/lib/auth';
import { consentDeps } from '@/lib/consent.repository';
import { consentRouteError, readJsonBody, string } from '@/lib/consent-route';

export const dynamic = 'force-dynamic';

const METHODS: readonly ConsentMethod[] = ['email-plus', 'text-plus', 'kba', 'card'];

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const method = body ? string(body, 'method') : null;
  const target = body ? string(body, 'target') : null;
  if (!method || !target || !METHODS.includes(method as ConsentMethod)) {
    return NextResponse.json({ error: 'method and target are required' }, { status: 400 });
  }
  try {
    const issue = await issueConsentChallenge(auth, request.headers, { method: method as ConsentMethod, target }, consentDeps);
    return NextResponse.json({ ok: true, ...issue });
  } catch (error) {
    return consentRouteError(error);
  }
}
