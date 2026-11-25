// POST /api/family/consent/record — write the consent record. The server
// requires its own row to show the code verified and the confirmation sent,
// mints the evidence reference, and answers with the id the children step
// sends to /api/family/learners. The guardian comes from the session.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1 §6 · packages/app/features/onboarding/consent/consent.service.ts
// SOT-KEYWORDS: consent api route record evidence guardian protected h3
import { NextRequest, NextResponse } from 'next/server';
import { recordGuardianConsent } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { consentDeps } from '@/lib/consent.repository';
import { consentRouteError, readJsonBody, string } from '@/lib/consent-route';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const challengeId = body ? string(body, 'challengeId') : null;
  const scope = body ? string(body, 'scope') : null;
  const policyVersion = body ? string(body, 'policyVersion') : null;
  if (!challengeId || !scope || !policyVersion) {
    return NextResponse.json({ error: 'challengeId, scope and policyVersion are required' }, { status: 400 });
  }
  try {
    const result = await recordGuardianConsent(auth, request.headers, { challengeId, scope, policyVersion }, consentDeps);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return consentRouteError(error);
  }
}
