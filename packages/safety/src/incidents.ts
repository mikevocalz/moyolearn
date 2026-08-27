// Doc 31 §4 — the Incident Report, as a shape and a lifecycle rather than a
// table.
//
// Two intake paths (automated from the Safety Plane, submitted by a human) and
// ONE collection, because a platform with a tips inbox and a separate case file
// has two versions of what happened and no answer to "was it dealt with". The
// lifecycle is intake → triage → escalation → documentation → resolution, and
// every step of it writes to `timeline`.
//
// THREE RULES ARE ENFORCED BY SHAPE HERE, NOT BY REVIEW:
//
// 1. THE TIMELINE IS APPEND-ONLY. `appendTimeline` is the only way to add an
//    entry and it takes and returns a whole report; there is no mutation of an
//    existing entry anywhere in this module, and the Payload collection has no
//    update access on the field. The audit trail is what protects a district's
//    counsel in a compliance question, and an audit trail with an edit path is a
//    document.
//
// 2. AN EXCERPT IS A REFERENCE, NEVER A COPY. `TranscriptExcerptRef` holds a
//    session id and message ids and has NO field wide enough to hold a sentence.
//    Doc 31 §4.1: "permission-gated render, never a copy". A copy of a child's
//    words in this store would be a second copy on a second retention clock,
//    which is the exact failure `SafetyEvents` was built to avoid one layer down
//    and `tooling/check-versions-off.mjs` guards one layer below that.
//
// 3. LEGAL HOLD IS A MARKER THE SWEEP REFUSES TO CROSS. `expiresAt` is always
//    written, so a released hold has a clock already under it; `legalHold` is a
//    nullable REASON, and `payload.incident_reports` is swept with
//    `legal_hold IS NULL` in the WHERE. See `LEGAL_HOLD_REASON` below for what
//    is and is not decided here.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4 · docs/pack/19-learning-outcomes-spec.md §S27 · docs/pack/23-crm-spec.md §2
// SOT-KEYWORDS: incident report collection shape timeline append only transcript excerpt reference legal hold retention sla guardian visible triage lifecycle

import { randomUUID } from 'node:crypto';
import type { SafetyEvent } from './events.ts';
import {
  LADDER,
  incidentCategoryFor,
  slaDueAt,
  tierIsGuardianVisible,
  type IncidentCategory,
  type SafetyTier,
} from './ladder.ts';

/** §4: the two doors. `automated` is the plane; `submitted` is a person. */
export const INCIDENT_SOURCES = ['automated', 'submitted'] as const;
export type IncidentSource = (typeof INCIDENT_SOURCES)[number];

export const REPORTER_ROLES = ['system', 'tutor', 'staff', 'guardian', 'learner'] as const;
export type ReporterRole = (typeof REPORTER_ROLES)[number];

/** §4's lifecycle, in order. Nothing skips; `closed` is terminal. */
export const INCIDENT_STATUSES = [
  'new',
  'triaged',
  'in-review',
  'actioned',
  'resolved',
  'closed',
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

/**
 * One line of the audit trail.
 *
 * `actor` is an id or the literal `'system'` — never a display name, because a
 * name copied at write time is a name that goes stale and a name that has to be
 * erased twice.
 */
export interface IncidentTimelineEntry {
  readonly at: string;
  readonly actor: string;
  readonly action: string;
  /** Observable behaviour, never inferred intent (§3.2's closing note). */
  readonly note: string | null;
}

/**
 * A POINTER at an exchange, rendered under permission at read time.
 *
 * There is deliberately no `text` field and there must never be one. The words
 * live in `sessionTranscripts`, on the transcript's own 30-day clock, and doc 07
 * §S26's "view conversation excerpt" reads them from there.
 */
export interface TranscriptExcerptRef {
  readonly sessionId: string;
  readonly messageIds: readonly string[];
}

export interface IncidentReport {
  /** Client-minted, so a retried file is a collision rather than a duplicate. */
  readonly incidentId: string;
  readonly source: IncidentSource;
  readonly reporterRole: ReporterRole;
  /** `null` when anonymous, and `null` when the reporter is the system. */
  readonly reporterId: string | null;
  readonly anonymous: boolean;
  /** Who this is about. From `ctx` or from a guardianship — never from a body. */
  readonly subjectLearnerId: string;
  readonly relatedSessionId: string | null;
  /** The `safetyEvents.eventId` that filed it, when the plane did. */
  readonly relatedEventId: string | null;
  readonly category: IncidentCategory;
  readonly severity: SafetyTier;
  readonly occurredAt: string;
  /** "What was observed" — behaviour, not intent. */
  readonly summary: string;
  readonly transcriptExcerpt: TranscriptExcerptRef | null;
  /** Bunny media ids (doc 29's token-auth class). Ids only, never URLs. */
  readonly attachmentIds: readonly string[];
  readonly immediateActionTaken: string | null;
  readonly status: IncidentStatus;
  readonly assigneeId: string | null;
  /** §4.3, set from severity at creation. `null` below S3, which owes no clock. */
  readonly slaDueAt: string | null;
  readonly guardianVisible: boolean;
  /**
   * When §4.3's fan-out actually reached the guardian.
   *
   * THIS IS THE NATURAL KEY behind `safety.alert.guardian`. `docs/design/jobs.md`
   * §3 requires two idempotency mechanisms per queue and is explicit they are not
   * interchangeable: the `singletonKey` stops a double ENQUEUE, and a natural key
   * makes a second EXECUTION a no-op. This field is the second one, and its
   * absence is precisely why that queue sat `declared` — a guardian alert with no
   * durable dedupe tells a parent the same thing twice.
   */
  readonly guardianNotifiedAt: string | null;
  /** The same, for §4.3's S4 page. `null` on every rung that pages nobody. */
  readonly reviewPagedAt: string | null;
  readonly guardianAcknowledgedAt: string | null;
  readonly resolution: string | null;
  readonly timeline: readonly IncidentTimelineEntry[];
  /**
   * The learner-content clock. Always written, including under a hold — a hold
   * that is later released has to land on a schedule, and a null `expiresAt`
   * would leave the row immortal by omission rather than by decision.
   */
  readonly expiresAt: string;
  /**
   * The reason this row is exempt from the sweep, or `null`.
   *
   * A REASON rather than a boolean, because "why is this eleven-month-old record
   * still here" is the question a hold has to be able to answer, and a `true`
   * cannot answer it.
   */
  readonly legalHold: string | null;
}

/**
 * The retention window for an ordinary incident.
 *
 * Doc 31 §4.1: "retention follows the learner-content schedule". That schedule
 * is `TRANSCRIPT_TTL_DAYS` in `packages/student-model/src/facts.ts`, and the
 * number is restated here rather than imported for the reason
 * `packages/jobs/src/keys.ts:utcDay` restates its own: `@acme/safety` has no
 * dependencies, and acquiring one on the student model — the store doc 07 §3
 * layer 7 keeps safety events OUT of — to read a single integer would invert the
 * separation this package exists to hold.
 */
export const INCIDENT_TTL_DAYS = 30;

/**
 * WHY A HOLD EXISTS, AND WHAT THIS FILE DELIBERATELY DOES NOT DECIDE.
 *
 * ── COUNSEL SIGNOFF REQUIRED · doc 31 §3.2's own note ─────────────────────────
 * Abuse disclosures and CSAM-adjacent content carry reporting obligations that
 * are SEPARATE FROM AND SENIOR TO guardian notification: platform NCMEC
 * obligations under 18 U.S.C. §2258A, and mandated-reporter duties that vary by
 * state and by staff role. Doc 31 requires a legal-review checkpoint before
 * launch and this repository does not have one.
 *
 * So what is built here is the WORKFLOW and nothing else: the record is
 * preserved, the sweep cannot delete it, the tier pages a human, and the human
 * is the one who decides what is reported to whom. There is no NCMEC submission
 * path, no report-generation, and no jurisdiction table in this codebase, and
 * inventing any of them would be inventing legal process.
 *
 * THE GAP, NAMED: nothing in this repository discharges a reporting obligation.
 * `LADDER.S4.pagesHuman` is the entirety of the escalation, and it escalates to
 * a person, not to an authority.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export const LEGAL_HOLD_REASON = 's4-or-abuse-disclosure · pending counsel signoff';

/**
 * Whether a report is held, keyed on TIER first.
 *
 * Doc 31 says "S4 and abuse-disclosure records". Both, and the `or` matters in
 * both directions: the automated path cannot tell a self-harm disclosure from an
 * abuse disclosure (see `incidentCategoryFor`), so keying the hold on the
 * category alone would let a machine's coarse guess release a record it had no
 * business releasing — while a human who narrows a lower-tier report TO
 * `abuse-disclosure` at triage puts it under hold by that act.
 */
export const isHeld = (severity: SafetyTier, category: IncidentCategory): boolean =>
  severity === 'S4' || category === 'abuse-disclosure';

export const incidentExpiry = (occurredAt: Date): string =>
  new Date(occurredAt.getTime() + INCIDENT_TTL_DAYS * 86_400_000).toISOString();

/**
 * §4.1's `guardianVisible` default.
 *
 * S3/S4 true, and a staff-workflow report false — a report ABOUT a tutor is an
 * employment matter before it is a family matter, and putting it in front of a
 * parent at intake would decide that question by accident.
 */
export const guardianVisibleByDefault = (
  severity: SafetyTier,
  category: IncidentCategory,
): boolean => category !== 'tutor-behavior' && tierIsGuardianVisible(severity);

/** The first line of every trail: how the record came to exist. */
const openingEntry = (
  source: IncidentSource,
  actor: string,
  at: string,
  severity: SafetyTier,
): IncidentTimelineEntry => ({
  at,
  actor,
  action: source === 'automated' ? 'auto-filed' : 'submitted',
  note: `Filed at ${severity}. ${LADDER[severity].behavior}`,
});

/**
 * §4's automated door: the Incident Report a safety event earns.
 *
 * Returns `null` for every event that does not reach S3, and that null is the
 * ladder's central promise kept. An S1 fence-test and an S2 redirect are
 * RECORDED — they are already rows in `safetyEvents`, which is what "Safety event
 * log only" means in §3.2's table — and filing an incident on them would forward
 * a curious nine-year-old to their parents as a case number.
 *
 * `null` for a pause, too. A classifier that timed out is not a child's conduct
 * and has no severity on this ladder; doc 12 §5 already routes it to the
 * guardian STATUS line, which is a different sentence on the same screen.
 */
export function incidentFromSafetyEvent(
  event: SafetyEvent,
  now: Date = new Date(),
): IncidentReport | null {
  const severity = event.tier;
  if (severity === null || !LADDER[severity].filesIncident) return null;

  const category = incidentCategoryFor(severity, event.category);
  const occurredAt = event.occurredAt;
  const at = now.toISOString();

  return {
    incidentId: randomUUID(),
    source: 'automated',
    reporterRole: 'system',
    reporterId: null,
    anonymous: false,
    subjectLearnerId: event.learnerId,
    relatedSessionId: event.sessionId,
    relatedEventId: event.eventId,
    category,
    severity,
    occurredAt,
    /*
      OBSERVABLE BEHAVIOUR, and for the automated path the observable behaviour
      is what the SYSTEM did — which layer stopped the turn and what verdict it
      reached. The summary deliberately does not characterise the child: a
      machine-written sentence about a nine-year-old's motives is the exact
      "inferred intent" §3.2's closing note bans, and the reviewer has the
      excerpt reference for the rest.
    */
    summary: `The Safety Plane stopped a turn at ${event.stoppedAt} (${event.disposition}).`,
    /*
      A REFERENCE, and only when there is a conversation to point at. Message ids
      are left empty by the automated path: the plane holds a turn, not the
      transcript's own ids, and inventing one here would produce a link that
      renders nothing. The reviewer opens the session; §5.2 renders the exchange
      in the chat's own visual language from `sessionTranscripts`.
    */
    transcriptExcerpt: event.sessionId === null ? null : { sessionId: event.sessionId, messageIds: [] },
    attachmentIds: [],
    immediateActionTaken: LADDER[severity].behavior,
    status: 'new',
    assigneeId: null,
    slaDueAt: slaDueAt(severity, new Date(occurredAt)),
    guardianVisible: guardianVisibleByDefault(severity, category),
    guardianNotifiedAt: null,
    reviewPagedAt: null,
    guardianAcknowledgedAt: null,
    resolution: null,
    timeline: [openingEntry('automated', 'system', at, severity)],
    expiresAt: incidentExpiry(new Date(occurredAt)),
    legalHold: isHeld(severity, category) ? LEGAL_HOLD_REASON : null,
  };
}

/** What a human hands the submitted door. Identity is NOT among these fields. */
export interface SubmittedIncident {
  readonly reporterRole: Exclude<ReporterRole, 'system'>;
  readonly anonymous: boolean;
  readonly subjectLearnerId: string;
  readonly relatedSessionId: string | null;
  readonly category: IncidentCategory;
  readonly occurredAt: string;
  readonly summary: string;
  readonly immediateActionTaken: string | null;
  readonly attachmentIds: readonly string[];
}

/**
 * §4's human door, and §5.1's rule made structural: **the reporter does not
 * choose a severity.**
 *
 * "Severity is the system's judgment at triage, not a color the reporter must
 * choose under stress." So a submitted report opens at S3 — the rung that files,
 * notifies and starts a 48h clock — and a triager moves it. Opening at S1 would
 * be a report that nobody was ever paged about; opening at S4 would page an
 * on-call human for every form a worried parent fills in.
 *
 * `reporterId` is passed separately and dropped when `anonymous`, so the
 * anonymity is a property of the stored row rather than of the UI that wrote it
 * — the NIJ evidence §4 cites is about people trusting that, and a row that
 * still holds the id is a promise broken by the first person with a database
 * connection.
 */
export function incidentFromSubmission(
  input: SubmittedIncident,
  reporterId: string,
  now: Date = new Date(),
): IncidentReport {
  const severity: SafetyTier = 'S3';
  const at = now.toISOString();

  return {
    incidentId: randomUUID(),
    source: 'submitted',
    reporterRole: input.reporterRole,
    reporterId: input.anonymous ? null : reporterId,
    anonymous: input.anonymous,
    subjectLearnerId: input.subjectLearnerId,
    relatedSessionId: input.relatedSessionId,
    relatedEventId: null,
    category: input.category,
    severity,
    occurredAt: input.occurredAt,
    summary: input.summary,
    transcriptExcerpt:
      input.relatedSessionId === null
        ? null
        : { sessionId: input.relatedSessionId, messageIds: [] },
    attachmentIds: input.attachmentIds,
    immediateActionTaken: input.immediateActionTaken,
    status: 'new',
    assigneeId: null,
    slaDueAt: slaDueAt(severity, new Date(input.occurredAt)),
    guardianVisible: guardianVisibleByDefault(severity, input.category),
    guardianNotifiedAt: null,
    reviewPagedAt: null,
    guardianAcknowledgedAt: null,
    resolution: null,
    timeline: [openingEntry('submitted', input.anonymous ? 'anonymous' : reporterId, at, severity)],
    expiresAt: incidentExpiry(new Date(input.occurredAt)),
    legalHold: isHeld(severity, input.category) ? LEGAL_HOLD_REASON : null,
  };
}

/**
 * The append. Returns a NEW report; nothing here mutates the one it was given.
 *
 * Every other transition in this file goes through it, which is what makes "every
 * status change writes to the timeline" a property of the module rather than a
 * habit of its callers.
 */
export function appendTimeline(
  report: IncidentReport,
  entry: IncidentTimelineEntry,
): IncidentReport {
  return { ...report, timeline: [...report.timeline, entry] };
}

/**
 * A lifecycle move, with its audit line written in the same call.
 *
 * Re-derives `legalHold` and `guardianVisible` from the tier and category the
 * transition lands on, because a triager narrowing a report to
 * `abuse-disclosure` or raising it to S4 has just changed what may be deleted —
 * and a hold that had to be applied as a second, separate action is a hold
 * somebody forgets on the record that most needed it.
 *
 * A hold is never LIFTED here. Once `legalHold` holds a reason it survives every
 * subsequent transition: releasing it is a decision for counsel, taken outside
 * this codebase, and there is deliberately no function that performs it.
 */
export function transitionIncident(
  report: IncidentReport,
  change: {
    readonly status?: IncidentStatus;
    readonly severity?: SafetyTier;
    readonly category?: IncidentCategory;
    readonly assigneeId?: string | null;
    readonly resolution?: string | null;
  },
  actor: string,
  now: Date = new Date(),
): IncidentReport {
  const severity = change.severity ?? report.severity;
  const category = change.category ?? report.category;
  const status = change.status ?? report.status;

  const moved = [
    change.status === undefined || change.status === report.status ? null : `status → ${status}`,
    change.severity === undefined || change.severity === report.severity
      ? null
      : `severity → ${severity}`,
    change.category === undefined || change.category === report.category
      ? null
      : `category → ${category}`,
    change.assigneeId === undefined || change.assigneeId === report.assigneeId
      ? null
      : `assignee → ${change.assigneeId ?? 'unassigned'}`,
    change.resolution === undefined || change.resolution === report.resolution
      ? null
      : 'resolution recorded',
  ].filter((line): line is string => line !== null);

  return appendTimeline(
    {
      ...report,
      status,
      severity,
      category,
      assigneeId: change.assigneeId === undefined ? report.assigneeId : change.assigneeId,
      resolution: change.resolution === undefined ? report.resolution : change.resolution,
      slaDueAt:
        severity === report.severity
          ? report.slaDueAt
          : slaDueAt(severity, new Date(report.occurredAt)),
      guardianVisible:
        severity === report.severity && category === report.category
          ? report.guardianVisible
          : guardianVisibleByDefault(severity, category),
      legalHold: report.legalHold ?? (isHeld(severity, category) ? LEGAL_HOLD_REASON : null),
    },
    {
      at: now.toISOString(),
      actor,
      action: moved.length === 0 ? 'noted' : moved.join(', '),
      note: change.resolution ?? null,
    },
  );
}

/**
 * §4.3's fan-out, recorded — and the handler's own no-op condition.
 *
 * Returns the report unchanged when it has already been marked, so a pg-boss
 * retry, a dead-letter replay and a hand-run drain all produce one notification
 * and one timeline line. `docs/design/jobs.md` §3's natural key, made a
 * function so the handler asks rather than remembers.
 *
 * `channel` is free text (`'guardian'`, `'on-call'`) because the delivery
 * mechanism is the composition root's business and this module must not learn
 * what an email provider is.
 */
export function markFannedOut(
  report: IncidentReport,
  leg: 'guardian' | 'review',
  channel: string,
  now: Date = new Date(),
): IncidentReport {
  const already = leg === 'guardian' ? report.guardianNotifiedAt : report.reviewPagedAt;
  if (already !== null) return report;

  const at = now.toISOString();
  return appendTimeline(
    leg === 'guardian' ? { ...report, guardianNotifiedAt: at } : { ...report, reviewPagedAt: at },
    {
      at,
      actor: 'system',
      action: leg === 'guardian' ? 'guardian-notified' : 'human-review-paged',
      note: channel,
    },
  );
}

/**
 * §4.1's acknowledgment loop. Idempotent: a parent who taps twice is not two
 * acknowledgments, and the timeline should not read as though they were.
 */
export function acknowledgeIncident(
  report: IncidentReport,
  guardianId: string,
  now: Date = new Date(),
): IncidentReport {
  if (report.guardianAcknowledgedAt !== null) return report;
  const at = now.toISOString();
  return appendTimeline(
    { ...report, guardianAcknowledgedAt: at },
    { at, actor: guardianId, action: 'guardian-acknowledged', note: null },
  );
}

/** §4.3's queue column: past due, and not yet answered. */
export const slaBreached = (report: IncidentReport, now: Date): boolean => {
  if (report.slaDueAt === null) return false;
  if (report.status === 'resolved' || report.status === 'closed') return false;
  return Date.parse(report.slaDueAt) < now.getTime();
};
