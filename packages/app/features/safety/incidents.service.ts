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
// SOT-KEYWORDS: incident service guardian access own learner guardian visible triage queue sla breach conversation starter acknowledge submit fan out crm wall tutor reporter filed append note staff roster assignee verification timeline engagement intake subject engaged learner
import 'server-only';
import type { MembershipRole } from '@acme/auth/membership';
import type { Auth } from '@acme/auth/server';
import {
  acknowledgeIncident,
  appendTimeline,
  incidentFromSubmission,
  slaBreached,
  tierAtLeast,
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

/**
 * One assignable member of the org's safety staff — what the assignment
 * control needs, and NOTHING more of the account.
 *
 * OWNER AND MANAGER ONLY, the same pair `requiresMembership` seats at this
 * queue: §4.2's "org staff see org-scoped queues by role" gives scheduler and
 * finance no seat at an incident, so neither can be made the owner of one — a
 * roster that offered them would let the picker assign a case to somebody the
 * wall refuses to show it to. `id` is the Better Auth user id because it is
 * the value the PATCH's `assigneeId` writes back; the name is for the picker
 * and the row, and no email, avatar, or wider profile travels.
 */
export interface IncidentStaffMember {
  readonly id: string;
  readonly name: string;
  readonly role: Extract<MembershipRole, 'owner' | 'manager'>;
}

/**
 * The org's assignable staff, read from the Better Auth member table by a
 * repository. `orgId` comes from `ctx` at the call site — never from input.
 */
export type LoadIncidentStaff = (orgId: string) => Promise<readonly IncidentStaffMember[]>;

/**
 * A roster row on the wire. `me` is decided by the SERVER against `ctx`, so
 * "assign to me" on a client is picking a server-marked row from a
 * server-verified roster — not posting its own identity, which is the move
 * CLAUDE.md §The block bans and the reason assignment was deferred until this
 * read existed.
 */
export interface StaffRosterEntry extends IncidentStaffMember {
  readonly me: boolean;
}

/**
 * What a timeline line's `actor` coarsens to for an ORG STAFF reader.
 *
 * Doc 31 §4.2 scopes what a reader is SHOWN, not just which rows: staff read
 * org-scoped queues by role, and the role is the fact triage needs ("has a
 * manager already moved this"). So a staff auth id resolves to the member's
 * roster role, the caller's own lines read as `you`, a reporter's lines read
 * as the `reporterRole` the row already stores, and anything else — the
 * system, an anonymous filer, an actor no longer on the roster — is `moyo`.
 * Raw auth ids stay server-side here exactly as they do for the reporter's
 * own view (`TutorIncidentTimelineLine`), which coarsens harder.
 */
export type StaffTimelineActor =
  | 'you'
  | IncidentStaffMember['role']
  | Exclude<IncidentReport['reporterRole'], 'system'>
  | 'moyo';

/** One line of the append-only trail, as the org queue's reader may see it. */
export interface StaffTimelineLine {
  at: string;
  actor: StaffTimelineActor;
  action: string;
  note: string | null;
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
  /**
   * The owner as the ROSTER names them, resolved at read time — never stored
   * on the row, because a timeline actor "is an id or the literal 'system',
   * never a display name" (`incidents.ts`) and the same staleness rule holds
   * here. `null` while unassigned, and `null` when the assignee has since
   * left the roster: the row then reads plain "Assigned" off the boolean
   * rather than reviving a name the org no longer holds.
   */
  assigneeName: string | null;
  /** The contract's five-second answer — "what is waiting on ME". */
  assignedToMe: boolean;
  /** The append-only trail, actors coarsened per `StaffTimelineActor`. */
  timeline: readonly StaffTimelineLine[];
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

/** The `StaffTimelineActor` coarsening, one entry at a time. */
const staffActorFrom = (
  actor: string,
  viewerId: string,
  staffById: ReadonlyMap<string, IncidentStaffMember>,
  report: IncidentReport,
): StaffTimelineActor => {
  if (actor === viewerId) return 'you';
  const member = staffById.get(actor);
  if (member !== undefined) return member.role;
  if (report.reporterId !== null && actor === report.reporterId && report.reporterRole !== 'system') {
    return report.reporterRole;
  }
  return 'moyo';
};

/**
 * §5.3's queue, sorted soonest-deadline-first.
 *
 * Rows with no clock sort LAST rather than first. An S1/S2 report in the queue
 * owes nobody an answer by a time, and a null sorting to the top would bury the
 * two-hour S4 underneath a week of fence-tests.
 *
 * `viewerId` and `staff` come from `ctx` and the roster read behind the same
 * wall — the projection resolves assignee names and coarsens timeline actors
 * HERE, server-side, so no id-to-person mapping ever has to happen on a
 * client that would need the ids to do it.
 */
export function triageQueueFrom(
  reports: readonly IncidentReport[],
  now: Date,
  viewerId: string,
  staff: readonly IncidentStaffMember[],
): TriageQueue {
  const staffById = new Map(staff.map((member) => [member.id, member]));
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
      assigneeName:
        report.assigneeId === null ? null : (staffById.get(report.assigneeId)?.name ?? null),
      assignedToMe: report.assigneeId !== null && report.assigneeId === viewerId,
      timeline: report.timeline.map((entry) => ({
        at: entry.at,
        actor: staffActorFrom(entry.actor, viewerId, staffById, report),
        action: entry.action,
        note: entry.note,
      })),
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

/**
 * Every incident the acting user FILED — doc 36 §3.3's tutor list.
 *
 * The repository scopes its query to `reporterAuthId = ctx.learnerId` and
 * returns the acting id alongside the rows, exactly as `LoadGuardianIncidents`
 * returns the wards: the projection filters AGAIN on the same fact, so no
 * single refactor removes both checks (this file's own two-layer law).
 *
 * SCOPE IS "MINE + MY SESSIONS" — doc 36 §3.3 in full, closed by ADR-110.
 * "My sessions" reads the `sessions` collection's tutorAuthId edge (the
 * SESSION→tutor fact ADR-108 recorded as missing; AI `tutorSessions` still
 * carry only a learnerAuthId and are never consulted). The repository returns
 * the session-id set alongside the rows for the same reason it returns the
 * reporter id: the projection filters AGAIN on both facts, so no single
 * refactor removes both checks (this file's own two-layer law).
 */
export type LoadTutorIncidents = (
  ctx: ProtectedCtx,
) => Promise<{
  readonly reporter: string;
  /** Ids of sessions the acting tutor runs — the "my sessions" half's fact. */
  readonly sessionIds: readonly string[];
  readonly reports: readonly IncidentReport[];
}>;

/**
 * One line of the trail, as a tutor may read it.
 *
 * `actor` is COARSENED to "you or not-you" on purpose: the stored entries hold
 * staff auth ids, and a reporter's lifecycle view has no business displaying
 * which member of staff moved their case — that is org information, shown on
 * the org surface. Doc 31 §4.2 scopes what a reader is shown, not just which
 * rows.
 */
export interface TutorIncidentTimelineLine {
  at: string;
  actor: 'you' | 'moyo';
  action: string;
  note: string | null;
}

/**
 * What the reporter of an incident is shown about it.
 *
 * NO SEVERITY, deliberately. Doc 31 §5.1 keeps the tier off the intake form
 * because "severity is the system's judgment at triage"; showing the reporter
 * the rung afterwards would turn this list into a triage mirror and put S4's
 * redpen on a surface whose contract bans red framing. Status is the
 * lifecycle answer the contract's five-second questions actually ask for.
 */
export interface TutorIncidentView {
  incidentId: string;
  category: IncidentCategory;
  status: IncidentStatus;
  occurredAt: string;
  summary: string;
  immediateActionTaken: string | null;
  /** Triage's closing text, once there is one — "did anything come of it". */
  resolution: string | null;
  timeline: readonly TutorIncidentTimelineLine[];
  /**
   * A REFERENCE and never the words: the row stores `{sessionId, messageIds}`
   * and no permission-gated resolver exists for a tutor read today, so the
   * view carries the pointer's existence and size for the screen to state
   * honestly — fabricating content from ids is the one thing it must not do.
   */
  excerptSessionId: string | null;
  excerptMessageCount: number;
  /** Ids only in the row (doc 29's token-auth class); no presigned read path
   * exists for a tutor, so the screen renders a count, never a link. */
  attachmentCount: number;
}

/**
 * The tutor read, as a pure projection — the second of the two filters.
 *
 * `reporterId !== null` is not a null-guard, it is the anonymity promise held
 * against the FILER TOO: an anonymous submission drops the reporter id in the
 * row (`incidentFromSubmission`), so the row cannot match any actor and the
 * filing is invisible to the person who made it. Re-attaching it here by any
 * other join would rebuild the link the null exists to sever.
 */
export function tutorIncidentsFrom(
  reports: readonly IncidentReport[],
  actorId: string,
  sessionIds: readonly string[],
): readonly TutorIncidentView[] {
  return reports
    .filter(
      (report) =>
        (report.reporterId !== null && report.reporterId === actorId) ||
        // The "my sessions" half (doc 31 §4.2): an incident ON a session the
        // actor runs, whoever filed it. Session ids are globally unique mints
        // (Payload serials here, the plane's own ids on AI rows), so a match
        // is the edge, never a namespace accident.
        (report.relatedSessionId !== null && sessionIds.includes(report.relatedSessionId)),
    )
    .map((report) => ({
      incidentId: report.incidentId,
      category: report.category,
      status: report.status,
      occurredAt: report.occurredAt,
      summary: report.summary,
      immediateActionTaken: report.immediateActionTaken,
      resolution: report.resolution,
      timeline: report.timeline.map((entry) => ({
        at: entry.at,
        actor: entry.actor === actorId ? ('you' as const) : ('moyo' as const),
        action: entry.action,
        note: entry.note,
      })),
      excerptSessionId: report.transcriptExcerpt?.sessionId ?? null,
      excerptMessageCount: report.transcriptExcerpt?.messageIds.length ?? 0,
      attachmentCount: report.attachmentIds.length,
    }));
}

export interface TutorIncidentPorts {
  loadTutorIncidents: LoadTutorIncidents;
  loadIncident: LoadIncident;
  saveIncident: SaveIncident;
}

/**
 * The tutor's filed-incident list, behind the boundary.
 *
 * NO MEMBERSHIP WALL, and the absence is the decision: tutors are not org
 * staff, so `requiresMembership` would lock every tutor out of their own
 * filings, and `requires` stays at the free floor for the same reason
 * `guardianIncidents` above runs there — a lapsed plan must never stand
 * between a person and the record of a safety report they made. What scopes
 * the read is the reporter identity, enforced twice.
 */
export async function tutorIncidents(
  auth: Auth,
  headers: Headers,
  ports: Pick<TutorIncidentPorts, 'loadTutorIncidents'>,
): Promise<readonly TutorIncidentView[]> {
  return protectedOperation(auth, headers, async (ctx) => {
    const { reports, sessionIds } = await ports.loadTutorIncidents(ctx);
    return tutorIncidentsFrom(reports, ctx.learnerId, sessionIds);
  });
}

/**
 * The contract's append-note secondary action, through the append-only door.
 *
 * Buildable HONESTLY in this slice because it needs nothing org-gated:
 * `appendTimeline` grows the trail and `saveIncident` refuses any write that
 * would shorten or rewrite it, so a reporter adding a line cannot damage the
 * record. The identity check runs HERE for `acknowledgeGuardianIncident`'s
 * reason one section up: an incident id is a claim, and a caller who posted
 * somebody else's id would otherwise write their note — and their user id —
 * into another case's audit trail. Not-theirs and not-found are the same
 * `null`, so the answer cannot be used as an existence oracle.
 */
export async function appendTutorIncidentNote(
  auth: Auth,
  headers: Headers,
  incidentId: string,
  note: string,
  ports: Pick<TutorIncidentPorts, 'loadIncident' | 'saveIncident'>,
  now: Date = new Date(),
): Promise<TutorIncidentView | null> {
  return protectedOperation(auth, headers, async (ctx) => {
    const report = await ports.loadIncident(incidentId);
    if (report === null) return null;
    if (report.reporterId === null || report.reporterId !== ctx.learnerId) return null;

    const annotated = appendTimeline(report, {
      at: now.toISOString(),
      actor: ctx.learnerId,
      action: 'noted',
      note,
    });
    await ports.saveIncident(annotated);
    // Empty session set on purpose: append rights stay REPORTER-ONLY (the
    // identity check above), so the row being re-projected is always the
    // actor's own filing and needs no session fact to pass the filter.
    // Whether a tutor may annotate an incident on their session that someone
    // else filed is a contract question, not a widening to slip in here.
    return tutorIncidentsFrom([annotated], ctx.learnerId, [])[0] ?? null;
  });
}

/**
 * One learner the acting tutor is ENGAGED with — what the intake's subject
 * picker needs, and NOTHING more of the child. Id and display name only, the
 * same projection discipline `IncidentStaffMember` holds one scope down: no
 * username, no band, no guardian, and nowhere to put any of them.
 */
export interface EngagedLearner {
  readonly learnerId: string;
  readonly name: string;
}

/**
 * The acting tutor's ACTIVE engagements — ADR-108's roster edge, read by a
 * repository. Active only, decided at the port: an ended engagement is history
 * that explains old records, not a relationship to file new ones through, and
 * a service that had to re-filter would be one deletion away from not doing so.
 */
export type LoadTutorEngagements = (ctx: ProtectedCtx) => Promise<readonly EngagedLearner[]>;

/**
 * The categories a TUTOR may pick, which is not the whole list — the same
 * exclusions as the guardian intake door, for the same reason:
 *
 * `self-harm` and `abuse-disclosure` are absent on purpose. Both carry a legal
 * hold and, in the second case, obligations counsel has not signed off
 * (`LEGAL_HOLD_REASON`), and neither is a box a worried reporter should be
 * able to tick from a form — a mis-tick would put a permanent hold on a record
 * about a child who is fine. A human narrows a report into either of them at
 * triage, which is also where the hold is applied.
 *
 * Held HERE rather than only in the route, because the route's parse is one
 * refactor away from being a check nobody notices is gone — the two fail in
 * different ways, this file's own two-layer law.
 */
export const TUTOR_REPORTABLE: readonly IncidentCategory[] = [
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

export interface TutorEngagementPorts {
  loadTutorEngagements: LoadTutorEngagements;
}

/**
 * The subject picker's read, behind the boundary. Same floor as
 * `tutorIncidents` above and for the same reason: this feeds the filing of a
 * safety report, and a lapsed plan must never stand between a person and
 * making one. What scopes it is `ctx` — the repository queries by the acting
 * id, never by input.
 */
export async function tutorEngagedLearners(
  auth: Auth,
  headers: Headers,
  ports: TutorEngagementPorts,
): Promise<readonly EngagedLearner[]> {
  return protectedOperation(auth, headers, async (ctx) => ports.loadTutorEngagements(ctx));
}

/**
 * What a tutor's submission carries. The subject is NOT free-form, and the
 * role is not carried at all — `submitTutorIncident` is the tutor door, so
 * `reporterRole` is a fact of the door rather than a field a client could set.
 */
export type SubmitTutorIncidentInput = Omit<SubmittedIncident, 'subjectLearnerId' | 'reporterRole'> & {
  /** Which of the caller's engaged learners this is about. Checked, not trusted. */
  readonly subjectLearnerId: string;
};

export interface SubmitTutorIncidentPorts {
  loadTutorEngagements: LoadTutorEngagements;
  saveIncident: SaveIncident;
  fanOutIncident: FanOutIncident;
}

/**
 * §4's human intake door, one relationship over — `submitIncident`'s exact
 * shape with the wards-intersection run against ADR-108's roster edge instead:
 * `subjectLearnerId` arrives from the form and is CHECKED against the caller's
 * own ACTIVE engagements, because a report filed about a child the caller has
 * no relationship with is not a report, it is a write into somebody else's
 * record. The severity is not on the form at all (§5.1), so there is nothing
 * to check there: `incidentFromSubmission` opens every submission at S3.
 *
 * The category check runs HERE as well as in the route (`TUTOR_REPORTABLE`'s
 * own comment), and a refused category gets the same `null` as a refused
 * subject — the answer is no oracle over which refusal happened.
 *
 * Fan-out happens after the save and its failure does NOT fail the submission,
 * for `submitIncident`'s recorded reason: a reporter who got an error would
 * file again, and the second copy is worse than a late notification.
 */
export async function submitTutorIncident(
  auth: Auth,
  headers: Headers,
  input: SubmitTutorIncidentInput,
  ports: SubmitTutorIncidentPorts,
  now: Date = new Date(),
): Promise<{ incidentId: string } | null> {
  return protectedOperation(auth, headers, async (ctx) => {
    if (!TUTOR_REPORTABLE.includes(input.category)) return null;

    const engaged = await ports.loadTutorEngagements(ctx);
    const subject = engaged.some((learner) => learner.learnerId === input.subjectLearnerId)
      ? input.subjectLearnerId
      : null;
    if (subject === null) return null;

    const report = incidentFromSubmission(
      { ...input, reporterRole: 'tutor', subjectLearnerId: subject },
      ctx.learnerId,
      now,
    );
    await ports.saveIncident(report);
    await ports.fanOutIncident(report);
    return { incidentId: report.incidentId };
  });
}

export interface TriagePorts {
  loadIncidentQueue: LoadIncidentQueue;
  loadIncident: LoadIncident;
  loadIncidentStaff: LoadIncidentStaff;
  saveIncident: SaveIncident;
  fanOutIncident: FanOutIncident;
}

/**
 * The staff roster behind the assignment control — the read whose absence
 * deferred assignment on both Safety surfaces.
 *
 * Same wall as the queue itself, set HERE so no route can lower it: the
 * roster exists to feed a triage control, and a caller the queue refuses has
 * no business enumerating who works incidents. Past that wall `ctx.orgId` is
 * always set (a held role needs an org to be held in); the empty roster is
 * the fail-closed answer for a ctx that somehow is not.
 */
export async function incidentStaffRoster(
  auth: Auth,
  headers: Headers,
  ports: Pick<TriagePorts, 'loadIncidentStaff'>,
): Promise<readonly StaffRosterEntry[]> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      if (ctx.orgId === undefined) return [];
      const staff = await ports.loadIncidentStaff(ctx.orgId);
      return staff.map((member) => ({ ...member, me: member.id === ctx.learnerId }));
    },
    { requires: 'write', requiresMembership: ['owner', 'manager'] },
  );
}

/** §5.3's queue, behind the boundary. Org scoping is the repository's. */
export async function incidentTriageQueue(
  auth: Auth,
  headers: Headers,
  ports: Pick<TriagePorts, 'loadIncidentQueue' | 'loadIncidentStaff'>,
  now: Date = new Date(),
): Promise<TriageQueue> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const [reports, staff] = await Promise.all([
        ports.loadIncidentQueue(ctx),
        ctx.orgId === undefined
          ? Promise.resolve<readonly IncidentStaffMember[]>([])
          : ports.loadIncidentStaff(ctx.orgId),
      ]);
      return triageQueueFrom(reports, now, ctx.learnerId, staff);
    },
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

      const staff = ctx.orgId === undefined ? [] : await ports.loadIncidentStaff(ctx.orgId);

      /*
        A posted `assigneeId` is a CLAIM until the roster says otherwise — the
        check that made client-posted identity unsafe, run against the server's
        own member read before anything writes. A foreign id gets the same
        `null` as a swept record, so the answer is no oracle over who is staff
        where. Explicit `null` (unassign) passes untouched: clearing an owner
        needs no roster, and refusing it would strand a case on somebody who
        left.
      */
      if (
        typeof change.assigneeId === 'string' &&
        !staff.some((member) => member.id === change.assigneeId)
      ) {
        return null;
      }

      const moved = transitionIncident(report, change, ctx.learnerId, now);
      await ports.saveIncident(moved);

      /*
        RAISED, not merely changed. The plain inequality re-fanned on a
        DOWNGRADE too, so a triager correcting an over-filed S4 to S3 enqueued
        a second guardian notification about an incident being de-escalated —
        the opposite of what the docstring above promises. `tierAtLeast` is in
        `ladder.ts` for exactly this comparison.
      */
      if (
        LADDER[moved.severity].slaHours !== null &&
        moved.severity !== report.severity &&
        tierAtLeast(moved.severity, report.severity)
      ) {
        await ports.fanOutIncident(moved);
      }

      return triageQueueFrom([moved], now, ctx.learnerId, staff).rows[0] ?? null;
    },
    // Same wall as the queue read: a lifecycle move is MORE staff-shaped than a
    // read, and it writes the audit trail — never a family session's to write.
    { requires: 'write', requiresMembership: ['owner', 'manager'] },
  );
}

/**
 * The org queue's note-append — the contract's secondary action, through the
 * same append-only door as `appendTutorIncidentNote` one scope up.
 *
 * The identity check the tutor variant runs against `reporterId` has no
 * analogue here because the WALL is different: this is staff work behind
 * `requiresMembership`, the same gate as the queue read and the triage move,
 * set here so no route can lower it. The actor on the line is `ctx`'s, never
 * input, and `saveIncident` still refuses any write that would shorten or
 * rewrite what came before — a note can only grow the trail.
 */
export async function appendStaffIncidentNote(
  auth: Auth,
  headers: Headers,
  incidentId: string,
  note: string,
  ports: Pick<TriagePorts, 'loadIncident' | 'saveIncident' | 'loadIncidentStaff'>,
  now: Date = new Date(),
): Promise<TriageRow | null> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const report = await ports.loadIncident(incidentId);
      if (report === null) return null;

      const annotated = appendTimeline(report, {
        at: now.toISOString(),
        actor: ctx.learnerId,
        action: 'noted',
        note,
      });
      await ports.saveIncident(annotated);

      const staff = ctx.orgId === undefined ? [] : await ports.loadIncidentStaff(ctx.orgId);
      return triageQueueFrom([annotated], now, ctx.learnerId, staff).rows[0] ?? null;
    },
    { requires: 'write', requiresMembership: ['owner', 'manager'] },
  );
}
