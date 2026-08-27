// Doc 31 §4.2 — who may read an incident, and what they are shown.
//
// THE ACCESS MODEL IS THE FEATURE HERE, and it is enforced twice on purpose.
// The repository scopes its query to the acting guardian's active wards, and the
// projection below filters AGAIN on the same two facts — own learner, and
// `guardianVisible`. A single check in a `where` clause is one refactor away
// from being a check nobody notices is gone, and the row it would leak is a
// record of another family's child. So the rule that matters is stated as a pure
// function a test can drive with rows it was never supposed to see.
//
// §5.2's order is fixed and lives here rather than in a component: **What
// happened → What the tutor did → What happens next → Talk about it.** A
// guardian view assembled by a screen is a guardian view that reads differently
// on web and native, and the one thing this surface cannot afford is a parent on
// a phone seeing less than a parent on a laptop.
//
// THE CRM CANNOT REACH THIS MODULE. Doc 31 §4.2 extends doc 23's wall — "'child
// had a safety incident' must never become a sales signal, structurally" — and
// `tooling/check-crm-wall.mjs` fails the build if `features/ops`, the lead
// repository or the ops routes acquire an import path to it.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4.2 §4.3 §5.2 §5.3 · docs/pack/23-crm-spec.md §2 · docs/pack/19-learning-outcomes-spec.md §S27
// SOT-KEYWORDS: incident service guardian access own learner guardian visible triage queue sla breach conversation starter acknowledge submit fan out crm wall
import 'server-only';
import type { Auth } from '@acme/auth/server';
import {
  acknowledgeIncident,
  incidentFromSubmission,
  slaBreached,
  transitionIncident,
  LADDER,
  type IncidentCategory,
  type IncidentReport,
  type IncidentStatus,
  type SafetyTier,
  type SubmittedIncident,
} from '@acme/safety';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation.ts';

/**
 * Every incident about a learner this session is actually responsible for.
 *
 * Which learners those are is the repository's question: identity comes from
 * `ctx` and the guardianship rows are a Payload read, so resolving them here
 * would put a collection query in a service (CLAUDE.md §The block). The
 * repository returns the ward ids alongside the rows so the projection can prove
 * the scoping rather than assume it.
 */
export type LoadGuardianIncidents = (
  ctx: ProtectedCtx,
) => Promise<{ readonly wards: readonly string[]; readonly reports: readonly IncidentReport[] }>;

/** The org-scoped triage queue (§5.3). Staff-facing; never a learner surface. */
export type LoadIncidentQueue = (ctx: ProtectedCtx) => Promise<readonly IncidentReport[]>;

/** One incident by id, for a transition. Returns `null` when it has been swept. */
export type LoadIncident = (incidentId: string) => Promise<IncidentReport | null>;

/**
 * Writes a report. Creation and lifecycle share one port because the timeline is
 * append-only: every write is the whole document, and a repository with a
 * separate "patch" door is a door that could write a shorter trail.
 */
export type SaveIncident = (report: IncidentReport) => Promise<void>;

/** Doc 31 §4.3's fan-out, enqueued. The queues are the composition root's. */
export type FanOutIncident = (report: IncidentReport) => Promise<void>;

/**
 * §5.2's fourth section — "Talk about it" — as human-written copy, one line per
 * category.
 *
 * WRITTEN BY PEOPLE AND NOT GENERATED, which is the same rule as the S4 script
 * one layer down and for a sharper reason: this is the sentence a parent reads
 * before they go and find their child. A model that improvised it would be
 * improvising the opening of a conversation about abuse.
 *
 * Factual, non-condemning, and never about the child's motives — doc 31 §3.2's
 * closing note is that reports record observable behaviour, never inferred
 * intent, and the conversation starter is bound by it too.
 */
export const CONVERSATION_STARTERS = {
  profanity:
    'Words like that are normal to try out at this age. "I heard you used a word at tutoring — where did you hear it?" works better than "why did you say that".',
  'sexual-content':
    'Curiosity here is ordinary and not a warning sign on its own. Try: "You asked the tutor something it couldn’t answer. You can ask me anything, and I won’t be upset."',
  bullying:
    'Ask about the other child before the words: "Who were you thinking about when you said that?" Bullying language usually points at something happening elsewhere.',
  'pii-shared':
    'A good moment for the rule rather than the incident: "The tutor never needs our address or your school. Nobody online does."',
  violence:
    'Ask what they were picturing, not why. Most of the time it is a game, a video, or something they overheard — and occasionally it is not.',
  substances:
    'Curiosity, a joke among friends, or something seen at home — all three sound identical here. "What made you wonder about that?" opens all three.',
  'self-harm':
    'Go to them today, and lead with staying rather than with asking: "I heard you said something that made me want to sit with you." The 988 Lifeline is there for you as well as for them.',
  'abuse-disclosure':
    'Believe first and ask nothing that sounds like an investigation. "Thank you for saying that. You are not in trouble, and I am going to make sure you are safe."',
  'tutor-behavior':
    'This one is ours to answer. A member of staff will contact you with what we found.',
  'safety-concern':
    'Open it gently: "Something came up in tutoring today. Can you tell me about it in your own words?"',
  other:
    'Start with what they remember: "Tell me about tutoring today." Let them lead.',
} as const satisfies Record<IncidentCategory, string>;

/** §5.2's fixed structure. Four sections, always in this order. */
export interface GuardianIncidentView {
  incidentId: string;
  /** Whose it was, so a two-child household knows who to go and find. */
  learnerId: string;
  severity: SafetyTier;
  category: IncidentCategory;
  occurredAt: string;
  /** §5.2 §1 — what happened, in the words the reporter or the system used. */
  whatHappened: string;
  /** §5.2 §2 — what the tutor did, read off the rung rather than stored twice. */
  whatTheTutorDid: string;
  /** §5.2 §3 — what happens next, including who is on it and by when. */
  whatHappensNext: string;
  /** §5.2 §4 — the conversation starter. */
  talkAboutIt: string;
  /** The excerpt LINK, when there is an exchange to open. Never the words. */
  sessionId: string | null;
  acknowledgedAt: string | null;
}

const whatHappensNext = (report: IncidentReport): string => {
  if (report.status === 'resolved' || report.status === 'closed') {
    return report.resolution ?? 'This has been reviewed and closed.';
  }
  const hours = LADDER[report.severity].slaHours;
  if (hours === null) return 'This is on record. Nothing is required from you.';
  return LADDER[report.severity].pagesHuman
    ? `A member of our safety team was paged immediately and will contact you within ${hours} hours.`
    : `A member of our safety team is reviewing this and will follow up within ${hours} hours.`;
};

/**
 * §4.2's guardian read, as a pure projection.
 *
 * TWO FILTERS, DELIBERATELY REDUNDANT WITH THE REPOSITORY'S `where`:
 *
 *   · `wards.includes(subjectLearnerId)` — the S27 LearnerRef wall. A row about
 *     somebody else's child is not shown even if the query that fetched it was
 *     wrong, and "the query was wrong" is the only way such a row gets here.
 *   · `guardianVisible` — decided once, at write time, by
 *     `guardianVisibleByDefault`. Re-deciding it here would change what a parent
 *     is shown about something that already happened, and would put a
 *     tutor-behaviour report — an employment matter — in front of a family.
 *
 * Neither is belt-and-braces for its own sake. The repository's scoping and this
 * one fail in different ways: a `where` clause is lost by a refactor, a filter
 * here is lost by a deletion, and no single change removes both.
 */
export function guardianIncidentsFrom(
  reports: readonly IncidentReport[],
  wards: readonly string[],
): readonly GuardianIncidentView[] {
  const mine = new Set(wards);
  return reports
    .filter((report) => report.guardianVisible && mine.has(report.subjectLearnerId))
    .map((report) => ({
      incidentId: report.incidentId,
      learnerId: report.subjectLearnerId,
      severity: report.severity,
      category: report.category,
      occurredAt: report.occurredAt,
      whatHappened: report.summary,
      whatTheTutorDid: report.immediateActionTaken ?? LADDER[report.severity].behavior,
      whatHappensNext: whatHappensNext(report),
      talkAboutIt: CONVERSATION_STARTERS[report.category],
      sessionId: report.transcriptExcerpt?.sessionId ?? null,
      acknowledgedAt: report.guardianAcknowledgedAt,
    }));
}

/** §5.3's row. The queue sorts on `dueAt`; `breached` is what turns it redpen. */
export interface TriageRow {
  incidentId: string;
  severity: SafetyTier;
  category: IncidentCategory;
  status: IncidentStatus;
  occurredAt: string;
  dueAt: string | null;
  breached: boolean;
  assigned: boolean;
}

export interface TriageQueue {
  rows: readonly TriageRow[];
  /**
   * §5.3: "unassigned-S4 is the one thing allowed to interrupt". A count rather
   * than a boolean, because the banner says how many and a screen that had to
   * re-count would be re-deciding the rule.
   */
  unassignedS4: number;
}

/**
 * §5.3's queue, sorted soonest-deadline-first.
 *
 * Rows with no clock sort LAST rather than first. An S1/S2 report in the queue
 * owes nobody an answer by a time, and a null sorting to the top would bury the
 * two-hour S4 underneath a week of fence-tests.
 */
export function triageQueueFrom(reports: readonly IncidentReport[], now: Date): TriageQueue {
  const rows = reports
    .map((report) => ({
      incidentId: report.incidentId,
      severity: report.severity,
      category: report.category,
      status: report.status,
      occurredAt: report.occurredAt,
      dueAt: report.slaDueAt,
      breached: slaBreached(report, now),
      assigned: report.assigneeId !== null,
    }))
    .sort((left, right) => {
      if (left.dueAt === null && right.dueAt === null) return 0;
      if (left.dueAt === null) return 1;
      if (right.dueAt === null) return -1;
      return Date.parse(left.dueAt) - Date.parse(right.dueAt);
    });

  return {
    rows,
    unassignedS4: rows.filter(
      (row) =>
        row.severity === 'S4' &&
        !row.assigned &&
        row.status !== 'resolved' &&
        row.status !== 'closed',
    ).length,
  };
}

export interface GuardianIncidentPorts {
  loadGuardianIncidents: LoadGuardianIncidents;
  loadIncident: LoadIncident;
  saveIncident: SaveIncident;
}

/** §4.2's guardian list, behind the boundary. */
export async function guardianIncidents(
  auth: Auth,
  headers: Headers,
  ports: Pick<GuardianIncidentPorts, 'loadGuardianIncidents'>,
): Promise<readonly GuardianIncidentView[]> {
  return protectedOperation(auth, headers, async (ctx) => {
    const { wards, reports } = await ports.loadGuardianIncidents(ctx);
    return guardianIncidentsFrom(reports, wards);
  });
}

/**
 * §4.1's acknowledgment loop.
 *
 * The ward check runs again HERE rather than being inferred from the incident
 * id, because an id is a claim: a guardian who posted somebody else's incident
 * id would otherwise write `guardianAcknowledgedAt` onto another family's case
 * and put their own user id in its audit trail. Identity is never a parameter,
 * and neither is the subject.
 */
export async function acknowledgeGuardianIncident(
  auth: Auth,
  headers: Headers,
  incidentId: string,
  ports: GuardianIncidentPorts,
  now: Date = new Date(),
): Promise<GuardianIncidentView | null> {
  return protectedOperation(auth, headers, async (ctx) => {
    const { wards } = await ports.loadGuardianIncidents(ctx);
    const report = await ports.loadIncident(incidentId);
    if (report === null) return null;
    if (!report.guardianVisible || !wards.includes(report.subjectLearnerId)) return null;

    const acknowledged = acknowledgeIncident(report, ctx.learnerId, now);
    if (acknowledged !== report) await ports.saveIncident(acknowledged);
    return guardianIncidentsFrom([acknowledged], wards)[0] ?? null;
  });
}

/** What a submitted report carries from the form. The subject is NOT free-form. */
export type SubmitIncidentInput = Omit<SubmittedIncident, 'subjectLearnerId'> & {
  /** Which of the caller's own learners this is about. Checked, not trusted. */
  readonly subjectLearnerId: string;
};

export interface SubmitIncidentPorts {
  loadGuardianIncidents: LoadGuardianIncidents;
  saveIncident: SaveIncident;
  fanOutIncident: FanOutIncident;
}

/**
 * §4's human intake door.
 *
 * `subjectLearnerId` arrives from the form and is CHECKED against the caller's
 * own wards rather than trusted — a report filed about a child the caller has no
 * relationship with is not a report, it is a write into somebody else's record.
 * The severity is not on the form at all (§5.1), so there is nothing to check
 * there: `incidentFromSubmission` opens every submission at S3.
 *
 * Fan-out happens after the save and its failure does NOT fail the submission.
 * A parent who filled in a form and got an error would fill it in again, and the
 * second copy is worse than a late notification — the record is the thing that
 * must land, and pg-boss's own retry ladder is what carries the notification.
 */
export async function submitIncident(
  auth: Auth,
  headers: Headers,
  input: SubmitIncidentInput,
  ports: SubmitIncidentPorts,
  now: Date = new Date(),
): Promise<{ incidentId: string } | null> {
  return protectedOperation(auth, headers, async (ctx) => {
    const { wards } = await ports.loadGuardianIncidents(ctx);
    const subject = wards.includes(input.subjectLearnerId) ? input.subjectLearnerId : null;
    if (subject === null) return null;

    const report = incidentFromSubmission({ ...input, subjectLearnerId: subject }, ctx.learnerId, now);
    await ports.saveIncident(report);
    await ports.fanOutIncident(report);
    return { incidentId: report.incidentId };
  });
}

export interface TriagePorts {
  loadIncidentQueue: LoadIncidentQueue;
  loadIncident: LoadIncident;
  saveIncident: SaveIncident;
  fanOutIncident: FanOutIncident;
}

/** §5.3's queue, behind the boundary. Org scoping is the repository's. */
export async function incidentTriageQueue(
  auth: Auth,
  headers: Headers,
  ports: Pick<TriagePorts, 'loadIncidentQueue'>,
  now: Date = new Date(),
): Promise<TriageQueue> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => triageQueueFrom(await ports.loadIncidentQueue(ctx), now),
    /*
      Staff work, gated on WHO the caller is before what they pay: doc 31 §5.3's
      triage is owner/manager work ("org staff see org-scoped queues by role",
      §4.2, and §4.3 fans S3 into the org OWNER queue) — scheduler and finance
      have no seat at an incident. `requiresMembership` is the wall; `write`
      alone was a billing capability any active family plan satisfied, which put
      this queue in front of paying guardians. `write` stays so a lapsed org
      cannot silently keep triaging. Set HERE, not in the route, so no route can
      lower it.
    */
    { requires: 'write', requiresMembership: ['owner', 'manager'] },
  );
}

/**
 * A triage move. Re-fans-out when the transition RAISED the severity, because an
 * S2 that a human re-reads as S4 is a page that has not happened yet.
 *
 * `transitionIncident` re-derives the hold and the guardian visibility, so an
 * escalation at triage carries its retention consequence with it rather than
 * needing a second action somebody forgets.
 */
export async function triageIncident(
  auth: Auth,
  headers: Headers,
  incidentId: string,
  change: {
    readonly status?: IncidentStatus;
    readonly severity?: SafetyTier;
    readonly category?: IncidentCategory;
    readonly assigneeId?: string | null;
    readonly resolution?: string | null;
  },
  ports: TriagePorts,
  now: Date = new Date(),
): Promise<TriageRow | null> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const report = await ports.loadIncident(incidentId);
      if (report === null) return null;

      const moved = transitionIncident(report, change, ctx.learnerId, now);
      await ports.saveIncident(moved);

      if (LADDER[moved.severity].slaHours !== null && moved.severity !== report.severity) {
        await ports.fanOutIncident(moved);
      }

      return triageQueueFrom([moved], now).rows[0] ?? null;
    },
    // Same wall as the queue read: a lifecycle move is MORE staff-shaped than a
    // read, and it writes the audit trail — never a family session's to write.
    { requires: 'write', requiresMembership: ['owner', 'manager'] },
  );
}
