// GET  /api/safety/incidents — doc 31 §5.3's triage queue.
// PATCH /api/safety/incidents — one lifecycle move, with its audit line.
//
// UNDER `/api/safety`, NOT `/api/ops`, AND THAT IS THE WALL. Doc 31 §4.2: "**The
// CRM never reads incidents** — doc 23's wall applies; 'child had a safety
// incident' must never become a sales signal, structurally." Filing the triage
// queue under the ops surface would put an incident read inside the module tree
// the CRM already imports, and `tooling/check-crm-wall.mjs` fails the build if
// it ever does. Same building, different door, and the door is what the check
// watches.
//
// STAFF WORK, walled by ROLE: `requiresMembership: ['owner', 'manager']` — set
// inside `incidentTriageQueue` and `triageIncident` rather than here, so no
// route can lower it. The role is the wall because `requires: 'write'` alone is
// a billing capability an active FAMILY plan satisfies — it stays only so a
// lapsed org cannot keep triaging. A guardian, whatever they pay, and a child on
// the free floor cannot reach this at all.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4.2 §4.3 §5.3 · docs/pack/23-crm-spec.md §2 · tooling/check-crm-wall.mjs
// SOT-KEYWORDS: safety incidents triage queue api route patch transition sla breach unassigned s4 crm wall staff
import { NextRequest, NextResponse } from 'next/server';
import {
  CapabilityDenied,
  MembershipDenied,
  incidentTriageQueue,
  triageIncident,
  type IncidentCategory,
  type IncidentStatus,
  type SafetyTier,
} from '@acme/app/server';
import {
  loadIncident,
  loadIncidentQueue,
  saveIncident,
} from '@/lib/incident.repository';
import { fanOut } from '@/lib/incident.service';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

// An SLA countdown is a claim about now. A cached queue is a queue whose
// breaches are all in the past by the time anybody reads it.
export const dynamic = 'force-dynamic';

const STATUSES: readonly IncidentStatus[] = [
  'new',
  'triaged',
  'in-review',
  'actioned',
  'resolved',
  'closed',
];
const TIERS: readonly SafetyTier[] = ['S1', 'S2', 'S3', 'S4'];
const CATEGORIES: readonly IncidentCategory[] = [
  'profanity',
  'sexual-content',
  'bullying',
  'pii-shared',
  'violence',
  'substances',
  'self-harm',
  'abuse-disclosure',
  'tutor-behavior',
  'safety-concern',
  'other',
];

const RESOLUTION_MAX = 4_000;

function respond(error: unknown): NextResponse {
  // Two different refusals, one wire shape: the role wall (403 by nature) and
  // the plan gate, which this staff route also flattens to 403 — an incident
  // queue is never an upsell surface, so a 402 has no business leaving it.
  if (error instanceof MembershipDenied || error instanceof CapabilityDenied) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof Error) reportRouteError(error);
  const message = error instanceof Error ? error.message : 'Server error';
  return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
}

export async function GET(request: NextRequest) {
  try {
    const queue = await incidentTriageQueue(auth, request.headers, { loadIncidentQueue });
    return NextResponse.json({ ok: true, ...queue });
  } catch (error) {
    return respond(error);
  }
}

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;

  if (typeof raw.incidentId !== 'string' || raw.incidentId.length === 0) {
    return NextResponse.json({ error: 'incidentId is required' }, { status: 400 });
  }
  if (typeof raw.resolution === 'string' && raw.resolution.length > RESOLUTION_MAX) {
    return NextResponse.json({ error: 'resolution is too long' }, { status: 400 });
  }

  /*
    Every field is OPTIONAL and `undefined` means "unchanged" — `transitionIncident`
    distinguishes an absent key from an explicit `null`, which is how a triager
    clears an assignee without accidentally clearing a resolution they never
    touched. `actor` is not accepted at all: it comes from `ctx`, because an audit
    trail whose actor is client-supplied is a document.
  */
  const change = {
    status: STATUSES.find((option) => option === raw.status),
    severity: TIERS.find((option) => option === raw.severity),
    category: CATEGORIES.find((option) => option === raw.category),
    assigneeId:
      raw.assigneeId === null
        ? null
        : typeof raw.assigneeId === 'string'
          ? raw.assigneeId
          : undefined,
    resolution:
      raw.resolution === null
        ? null
        : typeof raw.resolution === 'string'
          ? raw.resolution
          : undefined,
  };

  try {
    const row = await triageIncident(auth, request.headers, raw.incidentId, change, {
      loadIncidentQueue,
      loadIncident,
      saveIncident,
      fanOutIncident: fanOut,
    });
    if (row === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, incident: row });
  } catch (error) {
    return respond(error);
  }
}
