// POST /api/family/learners — S21's commit point: one drafted child becomes a
// real learner account (doc 06 §2's single server action), so the handoff step
// after it has an account to mint a code against (doc 36 §2).
//
// Behind `protectedOperation`: the guardian is the session's user, never a
// field in the body. The consent is READ, never received: the body names the
// id of a verification this server ran and recorded (consent.service.ts), and
// the grant's method, scope, policy version and evidence come from that row.
// A body that still carries a consent object is ignored — security finding
// H3 was exactly that a client could post a record it wrote itself.
// `createManagedLearner` validates the whole input and refuses a child without
// a consent, and its compensating rollback guarantees no learner row outlives
// a failed consent write.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §3.1 §5 · docs/pack/36-role-navigation-flows.md §2
// SOT-KEYWORDS: family learners api route create managed learner consent guardian protected h3
import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import {
  createManagedLearner,
  createPayloadLearnerWriter,
  CreateLearnerError,
} from '@acme/auth/server';
import { protectedOperation, readGuardianConsent } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { consentVerificationStore } from '@/lib/consent.repository';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

interface CreateLearnerBody {
  username: string;
  password: string;
  displayName: string;
  consentId: string;
}

function parseBody(body: unknown): CreateLearnerBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (
    typeof b.username !== 'string' ||
    typeof b.password !== 'string' ||
    typeof b.displayName !== 'string' ||
    typeof b.consentId !== 'string' ||
    b.consentId.length === 0
  ) {
    return null;
  }
  return { username: b.username, password: b.password, displayName: b.displayName, consentId: b.consentId };
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json(
      { error: 'username, password, displayName and consentId are required' },
      { status: 400 },
    );
  }

  try {
    const result = await protectedOperation(
      auth,
      request.headers,
      async (ctx) => {
        if (ctx.isLearner) throw new CreateLearnerError('Only a guardian can add a learner.');
        const consent = await readGuardianConsent(consentVerificationStore, ctx, body.consentId);
        if (!consent) {
          throw new CreateLearnerError('That permission record was not found. Verify your permission again.');
        }
        const payload = await getPayload({ config });
        return createManagedLearner(createPayloadLearnerWriter(auth, payload), {
          guardianAuthId: ctx.learnerId,
          username: body.username,
          password: body.password,
          displayName: body.displayName,
          consent,
        });
      },
      { telemetry: { op: 'family.createLearner', resource: 'users', action: 'write' } },
    );
    return NextResponse.json({ ok: true, learnerAuthId: result.learnerAuthId });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status =
      message === 'Unauthenticated' ? 401 : error instanceof CreateLearnerError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
