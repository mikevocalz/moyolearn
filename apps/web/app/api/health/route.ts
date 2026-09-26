// GET /api/health — the web app's liveness answer, with the face host's line
// on it.
//
// UNAUTHENTICATED BY DESIGN, for the reason `/api/health/jobs` gives: an uptime
// prober cannot hold a secret worth having, and the body is two booleans and a
// null. The Audio2Face host's URL and bearer (ADR-112) are read inside the
// voice egress and never appear here — a prober learns whether a face host is
// configured and whether it answered, not where it lives or what opens it.
//
// `ok` is this app's own liveness and is `true` whenever the handler ran. The
// `face` field is diagnostic and NEVER fails the route: a face host that is
// down costs the tutor its face, not its voice (`packages/voice/src/a2f.ts`),
// and a health route that answers 500 for an extra the product already
// survives would page for a degradation, not an outage. `/api/health/jobs` is
// the fail-closed one.
// SOT: docs/decisions/adr-112-live-audio2face.md · packages/voice/src/a2f.ts · apps/web/lib/voice.ts · apps/web/proxy.ts
// SOT-KEYWORDS: health route liveness face host audio2face configured reachable probe unauthenticated by design
import { NextResponse } from 'next/server';
import { faceHostHealth } from '@/lib/voice';

export const dynamic = 'force-dynamic';

export async function GET() {
  const face = await faceHostHealth();
  return NextResponse.json({ ok: true, face }, { headers: { 'cache-control': 'no-store' } });
}
