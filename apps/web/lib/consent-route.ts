// What the four /api/family/consent routes share: a JSON body read, and the
// status a refusal answers with. `ConsentVerificationError` carries its own
// status (a 404 for a row this guardian does not own, a 409 for a step out of
// order, a 503 for a server with no sender); everything else is the Block
// refusing (401) or a bug (500).
// SOT: packages/auth/src/consent-verification.ts · apps/web/app/api/family/consent/*
// SOT-KEYWORDS: consent route helper json body status refusal
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { ConsentVerificationError } from '@acme/auth/server';
import { reportRouteError } from '@/lib/report-error';

export async function readJsonBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const raw: unknown = await request.json();
    return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const string = (body: Record<string, unknown>, key: string): string | null =>
  typeof body[key] === 'string' && (body[key] as string).length > 0 ? (body[key] as string) : null;

export function consentRouteError(error: unknown): NextResponse {
  if (error instanceof ConsentVerificationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error) reportRouteError(error);
  const message = error instanceof Error ? error.message : 'Server error';
  return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
}
