// POST /api/family/learners — S21's commit point: one drafted child becomes a
// real learner account (doc 06 §2's single server action), so the handoff step
// after it has an account to mint a code against (doc 36 §2).
//
// Behind `protectedOperation`: the guardian is the session's user, never a
// field in the body. The consent record rides in from the client because the
// verification ran there (doc 06 §5's ConsentFlow) — `createManagedLearner`
// validates the whole input and refuses a child without one, and its
// compensating rollback guarantees no learner row outlives a failed consent
// write.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §5 · docs/pack/36-role-navigation-flows.md §2
// SOT-KEYWORDS: family learners api route create managed learner consent guardian protected
import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import {
  createManagedLearner,
  createPayloadLearnerWriter,
  CreateLearnerError,
} from '@acme/auth/server';
import type { ConsentMethod } from '@acme/auth';
import { protectedOperation } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

interface CreateLearnerBody {
  username: string;
  password: string;
  displayName: string;
  consent: { method: ConsentMethod; scope: string; policyVersion: string; evidenceRef?: string };
}

function parseBody(body: unknown): CreateLearnerBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.username !== 'string' || typeof b.password !== 'string' || typeof b.displayName !== 'string')
    return null;
  if (typeof b.consent !== 'object' || b.consent === null) return null;
  const c = b.consent as Record<string, unknown>;
  if (typeof c.method !== 'string' || typeof c.scope !== 'string' || typeof c.policyVersion !== 'string')
    return null;
  return {
    username: b.username,
    password: b.password,
    displayName: b.displayName,
    consent: {
      method: c.method as ConsentMethod,
      scope: c.scope,
      policyVersion: c.policyVersion,
      evidenceRef: typeof c.evidenceRef === 'string' ? c.evidenceRef : undefined,
    },
  };
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
      { error: 'username, password, displayName and consent are required' },
      { status: 400 },
    );
  }

  try {
    const result = await protectedOperation(
      auth,
      request.headers,
      async (ctx) => {
        if (ctx.isLearner) throw new CreateLearnerError('Only a guardian can add a learner.');
        const payload = await getPayload({ config });
        return createManagedLearner(createPayloadLearnerWriter(auth, payload), {
          guardianAuthId: ctx.learnerId,
          username: body.username,
          password: body.password,
          displayName: body.displayName,
          consent: body.consent,
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
