// The Incident Report store (doc 31 §4), as a repository.
//
// Split from `safety-event.repository.ts` next door because the two answer to
// different authorities and have different write rules. That file writes a
// verdict once and can never update it; this one is a case file whose whole
// point is that it moves. Keeping them in one module is how an append-only
// guarantee gets copied onto a collection that has an update path, or the other
// way around.
//
// THE APPEND-ONLY GUARANTEE IS ENFORCED HERE, not only upstream.
// `packages/safety/src/incidents.ts` makes a shorter timeline impossible to
// PRODUCE — `appendTimeline` spreads and returns a new report — but "impossible
// to produce" is a property of one module, and a repository is what any future
// module writes through. So `saveIncident` re-reads the stored trail and refuses
// a write that would shorten or rewrite it. A trail that can be truncated is a
// document, not an audit trail, and the audit trail is what answers a district's
// counsel.
//
// THE GUARDIAN READ RESOLVES GUARDIANSHIPS FIRST, exactly as the safety-event
// read does: `status: active` and not merely present, because an `invited`
// guardian has not finished doc 06 §2's ladder and a `revoked` one is a household
// that has changed. Neither is somebody to hand a child's safety file to.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4 · packages/payload/src/collections/IncidentReports.ts · docs/pack/12-systems-design-prompt.md §4
// SOT-KEYWORDS: incident repository payload guardian scope guardianship ward append only timeline legal hold triage queue org tutor reporter filed
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { IncidentReport as IncidentRow } from '@acme/payload';
import type {
  IncidentReport,
  IncidentTimelineEntry,
  LoadGuardianIncidents,
  LoadIncident,
  LoadIncidentQueue,
  LoadTutorIncidents,
  SaveIncident,
} from '@acme/app/server';

/**
 * How many rows a guardian's screen reads at once, and how deep a triage queue
 * goes in one page.
 *
 * Bounded because both are feeds rather than archives. A household that has
 * genuinely produced more than fifty incidents in the retention window has a
 * problem no list length solves, and a triage queue that cannot be cleared in a
 * shift is not made clearable by showing more of it.
 */
const FEED_LIMIT = 50;
const QUEUE_LIMIT = 200;

/** Two guardians per learner is normal (doc 06 §2); a whole classroom is not. */
const WARDS_LIMIT = 50;

async function withPayload<T>(
  fn: (payload: Awaited<ReturnType<typeof getPayload>>) => Promise<T>,
): Promise<T> {
  const payload = await getPayload({ config });
  return fn(payload);
}

/**
 * The two JSON columns, narrowed rather than asserted through.
 *
 * `timeline` and `transcriptExcerpt` are written by this file and by nothing
 * else, so the shapes below are what is there. A row that somehow holds
 * something else reads as an empty trail and an absent excerpt rather than
 * crashing a guardian's screen — the verdict and the summary are the parts they
 * need, and the trail is the part a reviewer needs.
 */
function timelineFrom(value: IncidentRow['timeline']): IncidentTimelineEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is IncidentTimelineEntry =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as IncidentTimelineEntry).at === 'string' &&
      typeof (entry as IncidentTimelineEntry).actor === 'string' &&
      typeof (entry as IncidentTimelineEntry).action === 'string',
  );
}

function excerptFrom(value: IncidentRow['transcriptExcerpt']): IncidentReport['transcriptExcerpt'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const sessionId = value.sessionId;
  if (typeof sessionId !== 'string') return null;
  const messageIds = Array.isArray(value.messageIds)
    ? value.messageIds.filter((id): id is string => typeof id === 'string')
    : [];
  return { sessionId, messageIds };
}

/** One row back into the domain shape the services and the screens speak. */
function incidentFromDoc(doc: IncidentRow): IncidentReport {
  return {
    incidentId: doc.incidentId,
    source: doc.source,
    reporterRole: doc.reporterRole,
    reporterId: doc.reporterAuthId ?? null,
    anonymous: doc.anonymous,
    subjectLearnerId: doc.subjectLearnerAuthId,
    relatedSessionId: doc.relatedSessionId ?? null,
    relatedEventId: doc.relatedEventId ?? null,
    category: doc.category,
    severity: doc.severity,
    occurredAt: doc.occurredAt,
    summary: doc.summary,
    transcriptExcerpt: excerptFrom(doc.transcriptExcerpt),
    attachmentIds: doc.attachmentIds ?? [],
    immediateActionTaken: doc.immediateActionTaken ?? null,
    status: doc.status,
    assigneeId: doc.assigneeAuthId ?? null,
    slaDueAt: doc.slaDueAt ?? null,
    guardianVisible: doc.guardianVisible,
    guardianNotifiedAt: doc.guardianNotifiedAt ?? null,
    reviewPagedAt: doc.reviewPagedAt ?? null,
    guardianAcknowledgedAt: doc.guardianAcknowledgedAt ?? null,
    resolution: doc.resolution ?? null,
    timeline: timelineFrom(doc.timeline),
    expiresAt: doc.expiresAt,
    legalHold: doc.legalHold ?? null,
  };
}

/**
 * Spread field by field rather than cast, for the reason `saveTranscript` and
 * `recordSafetyEvent` both record: `timeline` is a readonly array on the domain
 * type and a mutable JSON column on the row's, and a cast through `unknown`
 * would hide that alongside every future field the two shapes stop agreeing on.
 */
const dataFrom = (report: IncidentReport) => ({
  incidentId: report.incidentId,
  source: report.source,
  reporterRole: report.reporterRole,
  reporterAuthId: report.reporterId,
  anonymous: report.anonymous,
  subjectLearnerAuthId: report.subjectLearnerId,
  relatedSessionId: report.relatedSessionId,
  relatedEventId: report.relatedEventId,
  category: report.category,
  severity: report.severity,
  occurredAt: report.occurredAt,
  summary: report.summary,
  transcriptExcerpt:
    report.transcriptExcerpt === null
      ? null
      : {
          sessionId: report.transcriptExcerpt.sessionId,
          messageIds: [...report.transcriptExcerpt.messageIds],
        },
  attachmentIds: [...report.attachmentIds],
  immediateActionTaken: report.immediateActionTaken,
  status: report.status,
  assigneeAuthId: report.assigneeId,
  slaDueAt: report.slaDueAt,
  guardianVisible: report.guardianVisible,
  guardianNotifiedAt: report.guardianNotifiedAt,
  reviewPagedAt: report.reviewPagedAt,
  guardianAcknowledgedAt: report.guardianAcknowledgedAt,
  resolution: report.resolution,
  timeline: report.timeline.map((entry) => ({ ...entry })),
  expiresAt: report.expiresAt,
  legalHold: report.legalHold,
});

/** One incident by its minted id. `null` when the sweep has already taken it. */
export const loadIncident: LoadIncident = async (incidentId) =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'incidentReports',
      where: { incidentId: { equals: incidentId } },
      limit: 1,
    });
    const doc = docs[0];
    return doc === undefined ? null : incidentFromDoc(doc);
  });

/**
 * Creates or advances one incident.
 *
 * ONE PORT FOR BOTH, because the timeline is append-only: every write is the
 * whole document, and a separate "patch" door is a door through which a shorter
 * trail could arrive.
 *
 * THE REFUSAL IS THE POINT OF THIS FUNCTION. Before an update it re-reads the
 * stored trail and throws if the incoming one is shorter, or if any entry that
 * already existed has changed. `packages/safety/src/incidents.ts` makes both
 * impossible to produce today; this is what keeps them impossible after somebody
 * writes a second producer. Throwing rather than silently repairing, because a
 * write that lost history is a bug in the caller and repairing it here would
 * hide the bug and keep the damage.
 */
export const saveIncident: SaveIncident = async (report) =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'incidentReports',
      where: { incidentId: { equals: report.incidentId } },
      limit: 1,
    });
    const existing = docs[0];

    if (existing === undefined) {
      await payload.create({ collection: 'incidentReports', data: dataFrom(report) });
      return;
    }

    const stored = timelineFrom(existing.timeline);
    if (report.timeline.length < stored.length) {
      throw new Error(
        `incidentReports ${report.incidentId}: refusing a write that shortens the audit trail ` +
          `(${stored.length} entries on record, ${report.timeline.length} incoming).`,
      );
    }
    for (const [index, entry] of stored.entries()) {
      const incoming = report.timeline[index];
      if (
        incoming === undefined ||
        incoming.at !== entry.at ||
        incoming.actor !== entry.actor ||
        incoming.action !== entry.action
      ) {
        throw new Error(
          `incidentReports ${report.incidentId}: refusing a write that rewrites timeline entry ${index}.`,
        );
      }
    }

    await payload.update({ collection: 'incidentReports', id: existing.id, data: dataFrom(report) });
  });

/**
 * Every incident about a learner this session is actually responsible for.
 *
 * The guardianship read comes FIRST and an empty result short-circuits, so the
 * incident query is never issued without a relationship behind it. The wards are
 * returned alongside the rows rather than dropped, because
 * `guardianIncidentsFrom` filters on them a second time — the `where` here and
 * the filter there fail in different ways, and no single change removes both.
 *
 * A learner signing in and opening this surface gets nothing, and that is
 * correct rather than an oversight: doc 07 §3 layer 4 logs boundary-testing
 * "never punished", and a child reading their own incident file is the
 * punishment.
 */
export const loadGuardianIncidents: LoadGuardianIncidents = async (ctx) =>
  withPayload(async (payload) => {
    const { docs: wards } = await payload.find({
      collection: 'guardianships',
      where: {
        guardianAuthId: { equals: ctx.learnerId },
        status: { equals: 'active' },
      },
      limit: WARDS_LIMIT,
    });

    const learnerIds = wards.map((ward) => ward.learnerAuthId);
    if (learnerIds.length === 0) return { wards: [], reports: [] };

    const { docs } = await payload.find({
      collection: 'incidentReports',
      where: {
        subjectLearnerAuthId: { in: learnerIds },
        guardianVisible: { equals: true },
      },
      sort: '-occurredAt',
      limit: FEED_LIMIT,
    });

    return { wards: learnerIds, reports: docs.map(incidentFromDoc) };
  });

/**
 * Every incident the acting user filed, newest first.
 *
 * `reporterAuthId = ctx.learnerId` and NOTHING WIDER — "mine" only in v1.
 * Doc 36 §3.3 names the tutor surface "Incidents (mine + my sessions)", but
 * the "my sessions" half is DEFERRED, and ADR-108 records the gap: the
 * tutor→LEARNER edge it built (`tutorEngagements`) is a roster fact, while
 * "my sessions" needs a SESSION→tutor edge that `tutorSessions` — which
 * carries only a `learnerAuthId` — still does not hold. Until that edge is
 * its own decision, a session-scoped read would be a guess, and a safety
 * surface does not guess.
 *
 * The acting id is echoed alongside the rows for the reason `wards` is above:
 * `tutorIncidentsFrom` filters again on the same fact, and the `where` here
 * and the filter there fail in different ways.
 *
 * An ANONYMOUS filing has `reporterAuthId: null` in the row (the NIJ promise,
 * see `IncidentReports.ts`), so it can never match this query — the filer's
 * own anonymous report is invisible to them, and that is the promise working,
 * not a bug to route around.
 */
export const loadTutorIncidents: LoadTutorIncidents = async (ctx) =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'incidentReports',
      where: { reporterAuthId: { equals: ctx.learnerId } },
      sort: '-occurredAt',
      limit: FEED_LIMIT,
    });
    return { reporter: ctx.learnerId, reports: docs.map(incidentFromDoc) };
  });

/**
 * §5.3's triage queue — the open cases, soonest deadline first.
 *
 * Deliberately NOT org-filtered in this query, and the reason is a gap worth
 * naming rather than papering over: `incidentReports` carries no `orgId`,
 * because an incident is about a LEARNER and doc 23 §2's object model puts the
 * learner behind a `LearnerRef` pointer rather than inside an org row. Until the
 * org→learner edge exists as a query this codebase can issue, the queue is
 * platform-scoped and the boundary that guards it is `requires: 'write'` on
 * `incidentTriageQueue` plus the session itself.
 *
 * The sort is `slaDueAt` ascending so the two-hour S4 is the first row a human
 * sees; the resolved and closed cases are excluded because a queue is what is
 * still owed.
 */
export const loadIncidentQueue: LoadIncidentQueue = async () =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'incidentReports',
      where: { status: { not_in: ['resolved', 'closed'] } },
      sort: 'slaDueAt',
      limit: QUEUE_LIMIT,
    });
    return docs.map(incidentFromDoc);
  });
