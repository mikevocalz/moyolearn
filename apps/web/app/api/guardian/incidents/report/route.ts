// POST /api/guardian/incidents/report — doc 31 §4's human intake door.
//
// THE SEVERITY IS NOT IN THE BODY, and no amount of client code can put it
// there. Doc 31 §5.1: "Severity is the *system's* judgment at triage, not a
// color the reporter must choose under stress." `incidentFromSubmission` opens
// every submission at S3 — the rung that files, notifies and starts a 48-hour
// clock — and a triager moves it from there.
//
// `subjectLearnerId` IS in the body and is CHECKED rather than trusted: the
// service intersects it with the caller's own active wards, so a report about a
// child the caller has no relationship with is not a report, it is a write into
// somebody else's record. Identity is never a parameter (CLAUDE.md §The block);
// the SUBJECT is a parameter, so it is a parameter that gets verified.
//
// An anonymous submission drops the reporter id in the ROW, not merely in the
// UI — §4's NIJ evidence is about people trusting that, and a row that still
// holds the id is a promise broken by the first person with a connection.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4 §4.3 §5.1 · packages/safety/src/incidents.ts
// SOT-KEYWORDS: incident intake api route submit anonymous severity at triage guardian staff learner ward check fan out
import { NextRequest, NextResponse } from 'next/server';
import { submitIncident, type IncidentCategory } from '@acme/app/server';
import { loadGuardianIncidents, saveIncident } from '@/lib/incident.repository';
import { fanOut } from '@/lib/incident.service';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

/**
 * The categories a REPORTER may pick, which is not the whole list.
 *
 * `self-harm` and `abuse-disclosure` are absent on purpose. Both carry a legal
 * hold and, in the second case, obligations counsel has not signed off
 * (`LEGAL_HOLD_REASON`), and neither is a box a frightened parent should be able
 * to tick from a form at 11pm — a mis-tick would put a permanent hold on a
 * record about a child who is fine. A human narrows a report into either of them
 * at triage, which is also where the hold is applied.
 */
const REPORTABLE: readonly IncidentCategory[] = [
  'profanity',
  'sexual-content',
  'bullying',
  'pii-shared',
  'violence',
  'substances',
  'tutor-behavior',
  'safety-concern',
  'other',
];

const REPORTER_ROLES = ['tutor', 'staff', 'guardian', 'learner'] as const;
type SubmitterRole = (typeof REPORTER_ROLES)[number];

/** §5.1's "one narrative box", bounded. Long enough for what was seen. */
const SUMMARY_MAX = 4_000;

interface ParsedBody {
  reporterRole: SubmitterRole;
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

  const reporterRole = REPORTER_ROLES.find((role) => role === raw.reporterRole);
  const category = REPORTABLE.find((option) => option === raw.category);
  if (reporterRole === undefined || category === undefined) return null;

  if (typeof raw.subjectLearnerId !== 'string' || raw.subjectLearnerId.length === 0) return null;
  if (typeof raw.summary !== 'string' || raw.summary.length === 0) return null;
  if (raw.summary.length > SUMMARY_MAX) return null;

  /*
    `occurredAt` is client-supplied because only the reporter knows WHEN — §5.1's
    who/when/where structured fields. It is parsed rather than trusted, and a
    future date is refused: the SLA clock is derived from it, and an incident
    dated next week would owe its answer next week.
  */
  const occurredAt = typeof raw.occurredAt === 'string' ? Date.parse(raw.occurredAt) : Date.now();
  if (Number.isNaN(occurredAt) || occurredAt > Date.now()) return null;

  return {
    reporterRole,
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
    const result = await submitIncident(
      auth,
      request.headers,
      /*
        Attachments are accepted as ids only and the list is empty from this
        door today: doc 29 §3's uploads are minted client-direct against Bunny by
        `/api/media`, so an id arriving here has not been shown to belong to this
        caller. Wiring it before that check exists would be an endpoint for
        attaching somebody else's object to a case file.
      */
      { ...input, attachmentIds: [] },
      { loadGuardianIncidents, saveIncident, fanOutIncident: fanOut },
    );
    /*
      404 rather than 403 when the subject is not one of the caller's learners,
      and the two are deliberately indistinguishable: a 403 confirms the learner
      exists, which is a membership oracle over a list of children.
    */
    if (result === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
