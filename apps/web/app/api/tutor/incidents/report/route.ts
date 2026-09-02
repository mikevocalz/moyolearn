// POST /api/tutor/incidents/report — doc 31 §4's human intake door, tutor
// edition. A SUBROUTE beside the lifecycle route, the same split the guardian
// wing makes (`/api/guardian/incidents/report`): the parent route's POST
// appends a note to an existing case, this one creates a case, and giving the
// two verbs two addresses keeps either body shape from being mistaken for the
// other.
//
// THE SEVERITY IS NOT IN THE BODY, and no amount of client code can put it
// there. Doc 31 §5.1: "Severity is the *system's* judgment at triage, not a
// color the reporter must choose under stress." `incidentFromSubmission` opens
// every submission at S3 and a triager moves it from there.
//
// `subjectLearnerId` IS in the body and is CHECKED rather than trusted:
// `submitTutorIncident` intersects it with the caller's own ACTIVE
// engagements (ADR-108's roster edge — the wards-intersection shape, one
// relationship over), so a report about a child the caller has no engagement
// with is not a report, it is a write into somebody else's record.
//
// `reporterRole` is NOT in the body at all: this is the tutor door, so the
// role is a fact of the address rather than a field a client could set.
//
// An anonymous submission drops the reporter id in the ROW, not merely in the
// UI — §4's NIJ evidence is about people trusting that — which also means the
// filing can never appear in the filer's own list (`loadTutorIncidents`'s
// recorded promise). The form says so before the box is ticked.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4 §4.3 §5.1 · docs/decisions/adr-108-tutor-learner-edge.md · packages/app/features/safety/incidents.service.ts
// SOT-KEYWORDS: tutor incident intake api route submit report engagement subject verification anonymous severity at triage
import { NextRequest, NextResponse } from 'next/server';
import { submitTutorIncident, TUTOR_REPORTABLE, type IncidentCategory } from '@acme/app/server';
import { saveIncident } from '@/lib/incident.repository';
import { loadTutorEngagements } from '@/lib/tutor-engagement.repository';
import { fanOut } from '@/lib/incident.service';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

/** §5.1's "one narrative box", bounded — the guardian door's own limit. */
const SUMMARY_MAX = 4_000;

interface ParsedBody {
  anonymous: boolean;
  subjectLearnerId: string;
  relatedSessionId: string | null;
  category: IncidentCategory;
  occurredAt: string;
  summary: string;
  immediateActionTaken: string | null;
}

/** Narrowed field by field rather than cast — every one of these is client input. */
function parse(body: unknown): ParsedBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = body as Record<string, unknown>;

  /*
    The allow-list is the service's own `TUTOR_REPORTABLE` — self-harm and
    abuse-disclosure are never reporter-selectable (legal hold; the list's
    comment carries the reasoning) — and the service checks it AGAIN, because
    this parse and that check fail in different ways.
  */
  const category = TUTOR_REPORTABLE.find((option) => option === raw.category);
  if (category === undefined) return null;

  if (typeof raw.subjectLearnerId !== 'string' || raw.subjectLearnerId.length === 0) return null;
  if (typeof raw.summary !== 'string' || raw.summary.length === 0) return null;
  if (raw.summary.length > SUMMARY_MAX) return null;

  /*
    `occurredAt` is client-supplied because only the reporter knows WHEN. It is
    parsed rather than trusted, and a future date is refused: the SLA clock is
    derived from it, and an incident dated next week would owe its answer next
    week.
  */
  const occurredAt = typeof raw.occurredAt === 'string' ? Date.parse(raw.occurredAt) : Date.now();
  if (Number.isNaN(occurredAt) || occurredAt > Date.now()) return null;

  return {
    anonymous: raw.anonymous === true,
    subjectLearnerId: raw.subjectLearnerId,
    relatedSessionId: typeof raw.relatedSessionId === 'string' ? raw.relatedSessionId : null,
    category,
    occurredAt: new Date(occurredAt).toISOString(),
    summary: raw.summary,
    immediateActionTaken:
      typeof raw.immediateActionTaken === 'string' && raw.immediateActionTaken.length > 0
        ? raw.immediateActionTaken
        : null,
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = parse(body);
  if (input === null) {
    return NextResponse.json({ error: 'Invalid report' }, { status: 400 });
  }

  try {
    const result = await submitTutorIncident(
      auth,
      request.headers,
      /*
        Attachments are accepted as ids only and the list is empty from this
        door today, for the guardian route's recorded reason: an id arriving
        here has not been shown to belong to this caller, and wiring it before
        that check exists would be an endpoint for attaching somebody else's
        object to a case file.
      */
      { ...input, attachmentIds: [] },
      { loadTutorEngagements, saveIncident, fanOutIncident: fanOut },
    );
    /*
      404 rather than 403 when the subject is not one of the caller's engaged
      learners, and the two are deliberately indistinguishable: a 403 confirms
      the learner exists, which is a roster oracle over a list of children.
    */
    if (result === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
