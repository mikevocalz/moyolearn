'use client';
// The wire between the handoff routes and the onboarding screens. Response
// shapes are declared HERE and the routes answer in them (doc 11 §2's
// one-definition rule, same as entitlements.client.ts).
//
// Mock mode short-circuits BOTH calls: the mock session is a fixture, so its
// codes are fixtures too (protected-operation.ts: "if identity is a fixture,
// its attributes are too") — a dev walking S21 sees the real screens without a
// server, and the deterministic code makes the learner-redeem screen drivable
// in the same session.
// SOT: docs/pack/36-role-navigation-flows.md §2 · apps/web/app/api/handoff/route.ts
// SOT-KEYWORDS: handoff client fetch mint redeem code mock learner create

import { getAuthMode } from '../../../providers/session/auth-mode';

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3001';

/** The 15-minute promise, mirrored client-side for the mock path's expiry copy. */
const MOCK_TTL_MS = 15 * 60 * 1000;
const MOCK_CODE = 'MYK234';

export interface HandoffIssueResponse {
  code: string;
  url: string;
  expiresAt: string;
}

export type HandoffMintResult =
  | { kind: 'issued'; issue: HandoffIssueResponse }
  | { kind: 'failed'; message: string };

export async function mintHandoffCode(learnerAuthId: string): Promise<HandoffMintResult> {
  if (getAuthMode() !== 'live') {
    return {
      kind: 'issued',
      issue: {
        code: MOCK_CODE,
        url: `moyo://handoff?code=${MOCK_CODE}`,
        expiresAt: new Date(Date.now() + MOCK_TTL_MS).toISOString(),
      },
    };
  }
  try {
    const res = await fetch(`${API_URL}/api/handoff`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ learnerAuthId }),
    });
    if (!res.ok) return { kind: 'failed', message: 'Could not create a code. Try again.' };
    const issue = (await res.json()) as HandoffIssueResponse;
    return { kind: 'issued', issue };
  } catch {
    return { kind: 'failed', message: 'Could not reach Moyo. Check your connection and try again.' };
  }
}

export type HandoffRedeemResult = 'signed-in' | 'not-recognized' | 'offline';

/**
 * Redeeming IS signing in: on 200 the session cookie is already set and the
 * caller's next session read comes back as the learner.
 */
export async function redeemHandoffCode(code: string): Promise<HandoffRedeemResult> {
  if (getAuthMode() !== 'live') {
    return code.trim().toUpperCase() === MOCK_CODE ? 'signed-in' : 'not-recognized';
  }
  try {
    const res = await fetch(`${API_URL}/api/handoff/redeem`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    return res.ok ? 'signed-in' : 'not-recognized';
  } catch {
    return 'offline';
  }
}

export interface CreateLearnerResponse {
  learnerAuthId: string;
}

export type CreateLearnerResult =
  | { kind: 'created'; learnerAuthId: string }
  | { kind: 'failed'; message: string };

/** One child per call; the children step loops its rows. */
export async function createLearnerOnServer(input: {
  username: string;
  password: string;
  displayName: string;
  consent: { method: string; scope: string; policyVersion: string; evidenceRef?: string };
}): Promise<CreateLearnerResult> {
  if (getAuthMode() !== 'live') {
    return { kind: 'created', learnerAuthId: `mock-learner-${input.username}` };
  }
  try {
    const res = await fetch(`${API_URL}/api/family/learners`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { kind: 'failed', message: body?.error ?? 'Could not create the account. Try again.' };
    }
    const data = (await res.json()) as CreateLearnerResponse;
    return { kind: 'created', learnerAuthId: data.learnerAuthId };
  } catch {
    return { kind: 'failed', message: 'Could not reach Moyo. Check your connection and try again.' };
  }
}
