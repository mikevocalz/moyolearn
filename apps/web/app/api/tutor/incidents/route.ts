// GET  /api/tutor/incidents — the acting user's filed incidents, lifecycle view.
// POST /api/tutor/incidents — append one note to an incident the caller filed.
//
// UNDER `/api/tutor`, NEVER `/api/ops`, and the address is the wall. Doc 31
// §4.2: "'child had a safety incident' must never become a sales signal,
// structurally" — `tooling/check-crm-wall.mjs` walks the CRM roots and fails
// the build if an ops surface acquires a path to an incident module, so this
// route lives beside the other tutor surfaces, outside that wing.
//
// NO MEMBERSHIP WALL, unlike `/api/safety/incidents` — the gate is set inside
// `tutorIncidents` (none) rather than here, and its absence is the decision:
// tutors are not org staff, and the read is scoped by reporter identity,
// enforced twice (repository `where` + service projection). The intake POST
// lives at `./report`, the same subroute split the guardian wing makes:
// filing verifies its subject against the caller's active engagements
// (ADR-108's roster edge), while the POST here appends a note to a case the
// caller already filed.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4.2 · docs/pack/36-role-navigation-flows.md §3.3 · packages/app/features/safety/incidents.service.ts
// SOT-KEYWORDS: tutor incidents api route filed lifecycle append note reporter scope crm wall
import { NextRequest, NextResponse } from 'next/server';
import { appendTutorIncidentNote, tutorIncidents } from '@acme/app/server';
import {
  loadIncident,
  loadTutorIncidents,
  saveIncident,
} from '@/lib/incident.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

// "Where is my report in the lifecycle" is a question about now; a cached
// answer shows a tutor a case that has since been actioned as still new.
export const dynamic = 'force-dynamic';

/** Same bound as the intake's narrative box — a note is prose, not a document. */
const NOTE_MAX = 4_000;

const statusFor = (message: string): number => (message === 'Unauthenticated' ? 401 : 500);

export async function GET(request: NextRequest) {
  try {
    const incidents = await tutorIncidents(auth, request.headers, { loadTutorIncidents });
    return NextResponse.json({ ok: true, incidents });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  /*
    `incidentId` and `note`, nothing else. The acting identity comes from
    `ctx`, the clock from the server, and the id is still only a CLAIM — the
    service re-checks it against the row's own `reporterAuthId` before
    writing, so a caller posting somebody else's id gets the same 404 as a
    swept record. 404 rather than 403 on purpose: a 403 confirms the incident
    exists, which is an oracle over a list of children's safety cases.
  */
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  if (typeof raw.incidentId !== 'string' || raw.incidentId.length === 0) {
    return NextResponse.json({ error: 'incidentId is required' }, { status: 400 });
  }
  if (typeof raw.note !== 'string' || raw.note.trim().length === 0) {
    return NextResponse.json({ error: 'note is required' }, { status: 400 });
  }
  if (raw.note.length > NOTE_MAX) {
    return NextResponse.json({ error: 'note is too long' }, { status: 400 });
  }

  try {
    const incident = await appendTutorIncidentNote(
      auth,
      request.headers,
      raw.incidentId,
      raw.note.trim(),
      { loadIncident, saveIncident },
    );
    if (incident === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, incident });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
