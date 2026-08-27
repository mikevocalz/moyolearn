import 'server-only';
// The session-summary store (doc 34 §3), as a repository — the only code that
// reads or writes the `sessionSummaries` collection.
//
// LEARNER-SCOPED WHERE IT MATTERS, UNSCOPED WHERE A JOB RUNS. The guardian
// read resolves ACTIVE guardianships first, exactly as the incident and
// safety-event repositories do, and returns the ward list beside the rows so
// the service's projection can prove the scoping a second time. The
// generation-side reads take a bare `sessionId` because a pg-boss handler has
// no session by construction — identity comes off the row it loads, never off
// the queue payload (the `distillTranscript` rule).
//
// THE UPSERT IS THE IDEMPOTENCY. `session_summaries.session_id` is UNIQUE, and
// `saveSummaryReport` is find-then-create-or-update on it — a replayed job or
// a racing drain lands on the same row rather than putting two reports about
// one session in front of a parent.
//
// `forgetSessionSummaries` IS THE RETENTION CLASS'S SECOND HALF. The table has
// no `expires_at` and the sweep cannot touch it (sweep.sql says so in place);
// this function is the one deleter, driven by the guardian's forget-all
// cascade, and `erasure.integration.test.mjs` mirrors it statement for
// statement. The CRM cannot import this module — `tooling/check-crm-wall.mjs`
// names it.
// SOT: docs/pack/34-session-summary-reports.md §3 · packages/payload/src/collections/SessionSummaries.ts · packages/payload/src/retention/sweep.sql
// SOT-KEYWORDS: summary repository payload guardian scope wards upsert natural key forget erasure crop resolve draft queue viewed
import { getPayload } from 'payload';
import config from '@payload-config';
import type { SessionSummary as SessionSummaryRow } from '@acme/payload';
import type {
  EvidenceRef,
  ForgetSessionSummaries,
  LoadGuardianSummaries,
  LoadGuardianWards,
  LoadSessionForSummary,
  LoadSummaryBySession,
  LoadSummaryQueue,
  MarkGuardianViewed,
  ResolveCaptureCrop,
  SaveSummaryReport,
  SessionSummaryReport,
  SummarySessionRow,
} from '@acme/app/server';

const WARDS_LIMIT = 50;
/** A feed, not an archive — same bound the incident feed carries. */
const FEED_LIMIT = 50;
const QUEUE_LIMIT = 100;

async function withPayload<T>(
  fn: (payload: Awaited<ReturnType<typeof getPayload>>) => Promise<T>,
): Promise<T> {
  const payload = await getPayload({ config });
  return fn(payload);
}

/*
  The JSON columns come back as Payload's wide `json` union. This file is their
  only writer, so the narrowing below trusts the discriminants it wrote and
  answers anything else with the empty/absent value — a hand-edited admin row
  costs one block, never a guardian's whole screen.
*/
type Wide = SessionSummaryRow['workedOn'];

const asArray = <T>(value: Wide): readonly T[] =>
  Array.isArray(value) ? (value as unknown as readonly T[]) : [];

const asShape = <T>(value: Wide): T | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as unknown as T)
    : null;

function reportFromDoc(doc: SessionSummaryRow): SessionSummaryReport {
  return {
    sessionId: doc.sessionId,
    learnerAuthId: doc.learnerAuthId,
    sessionKind: doc.sessionKind,
    band: doc.band,
    headline: doc.headline,
    workedOn: asArray<SessionSummaryReport['workedOn'][number]>(doc.workedOn),
    problems: asArray<SessionSummaryReport['problems'][number]>(doc.problems),
    mastery: asArray<SessionSummaryReport['mastery'][number]>(doc.mastery),
    effortMoment: asShape<SessionSummaryReport['effortMoment']>(doc.effortMoment ?? null),
    nextUp: doc.nextUp,
    homeSupport:
      asShape<SessionSummaryReport['homeSupport']>(doc.homeSupport) ?? {
        conversationStarter: '',
        activity: '',
      },
    facts:
      asShape<SessionSummaryReport['facts']>(doc.facts) ?? {
        durationMin: 0,
        attempted: 0,
        solvedIndependently: 0,
        solvedWithHelp: 0,
      },
    evidenceRefs: asArray<EvidenceRef>(doc.evidenceRefs),
    generator:
      asShape<SessionSummaryReport['generator']>(doc.generator) ?? {
        model: 'unknown',
        promptVersion: 'unknown',
        schemaVersion: 'unknown',
      },
    safetyScreened: doc.safetyScreened,
    status: doc.status,
    publishedAt: doc.publishedAt ?? null,
    guardianViewedAt: doc.guardianViewedAt ?? null,
    tutorDraft: doc.tutorDraft ?? null,
    tutorApprovedByAuthId: doc.tutorApprovedByAuthId ?? null,
    suppressionReason: doc.suppressionReason ?? null,
    suppressedAt: doc.suppressedAt ?? null,
    teacherShare: asShape<SessionSummaryReport['teacherShare']>(doc.teacherShare ?? null),
    digestBatchId: doc.digestBatchId ?? null,
    createdAt: doc.createdAt,
  };
}

/*
  Spread-into-data rather than field lists in two places. The write is the
  WHOLE report every time — the document is generated, approved or suppressed
  as one unit, and a partial-update door here is a door through which a
  narrative could change without its evidence.
*/
function dataFrom(report: SessionSummaryReport) {
  /*
    Every block is re-spread into fresh anonymous shapes because Payload's
    `json` column type is an index signature and TypeScript refuses an
    INTERFACE against one — the same reason `incident.repository.ts` spreads
    its timeline entries. The copies also make the write's independence from
    the caller's objects literal rather than assumed.
  */
  return {
    sessionId: report.sessionId,
    learnerAuthId: report.learnerAuthId,
    sessionKind: report.sessionKind,
    band: report.band,
    headline: report.headline,
    workedOn: report.workedOn.map((skill) => ({ ...skill })),
    problems: report.problems.map((row) => ({ ...row, questionRef: { ...row.questionRef } })),
    mastery: report.mastery.map((row) => ({ ...row })),
    effortMoment:
      report.effortMoment === null
        ? null
        : { copy: report.effortMoment.copy, evidenceRef: { ...report.effortMoment.evidenceRef } },
    nextUp: report.nextUp,
    homeSupport: { ...report.homeSupport },
    facts: { ...report.facts },
    evidenceRefs: report.evidenceRefs.map((ref) => ({ ...ref })),
    generator: { ...report.generator },
    safetyScreened: report.safetyScreened,
    status: report.status,
    publishedAt: report.publishedAt,
    guardianViewedAt: report.guardianViewedAt,
    tutorDraft: report.tutorDraft,
    tutorApprovedByAuthId: report.tutorApprovedByAuthId,
    suppressionReason: report.suppressionReason,
    suppressedAt: report.suppressedAt,
    teacherShare: report.teacherShare === null ? null : { ...report.teacherShare },
    digestBatchId: report.digestBatchId,
  };
}

export const saveSummaryReport: SaveSummaryReport = async (report) =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'sessionSummaries',
      where: { sessionId: { equals: report.sessionId } },
      limit: 1,
    });
    const existing = docs[0];
    if (existing) {
      await payload.update({
        collection: 'sessionSummaries',
        id: existing.id,
        data: dataFrom(report),
      });
      return;
    }
    await payload.create({ collection: 'sessionSummaries', data: dataFrom(report) });
  });

export const loadSummaryBySession: LoadSummaryBySession = async (sessionId) =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'sessionSummaries',
      where: { sessionId: { equals: sessionId } },
      limit: 1,
    });
    return docs[0] ? reportFromDoc(docs[0]) : null;
  });

/**
 * The session the pipeline is about, with its turns. UNSCOPED on purpose — the
 * caller is the job handler, and the learner id this returns is what the
 * handler builds its ctx from. Null once the retention sweep has taken the
 * row, which the pipeline treats as completion, not failure.
 */
export const loadSessionForSummary: LoadSessionForSummary = async (sessionId) =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'tutorSessions',
      where: { sessionId: { equals: sessionId } },
      limit: 1,
    });
    const doc = docs[0];
    if (!doc || !doc.closedAt) return null;

    const { docs: messages } = await payload.find({
      collection: 'tutorMessages',
      where: { sessionId: { equals: sessionId } },
      sort: 'createdAt',
      limit: 1000,
    });

    const row: SummarySessionRow = {
      sessionId: doc.sessionId,
      learnerAuthId: doc.learnerAuthId,
      problem: doc.problem ?? '',
      openedAt: doc.createdAt,
      closedAt: doc.closedAt,
      messages: messages.map((message) => ({
        id: message.messageId,
        role: message.role,
        text: message.text,
        attachments: Array.isArray(message.attachments)
          ? (message.attachments as SummarySessionRow['messages'][number]['attachments'][number][])
          : [],
        createdAt: message.createdAt,
      })),
    };
    return row;
  });

/**
 * The guardian read: active wards first, then their published reports, newest
 * first. Empty wards short-circuits — the summary query is never issued
 * without a relationship behind it, and a learner opening this surface sees
 * nothing (a child browsing reports about themselves is a guardian surface
 * doing a learner's job).
 */
export const loadGuardianSummaries: LoadGuardianSummaries = async (ctx) =>
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
      collection: 'sessionSummaries',
      where: {
        learnerAuthId: { in: learnerIds },
        status: { equals: 'published' },
      },
      sort: '-publishedAt',
      limit: FEED_LIMIT,
    });
    return { wards: learnerIds, reports: docs.map(reportFromDoc) };
  });

/**
 * The wards half on its own, for the by-id paths. They name ONE report and
 * load it directly, so the feed's `FEED_LIMIT` — right for a feed, wrong for
 * an ownership question — never bounds which reports a guardian can open,
 * share or revoke.
 */
export const loadGuardianWards: LoadGuardianWards = async (ctx) =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'guardianships',
      where: {
        guardianAuthId: { equals: ctx.learnerId },
        status: { equals: 'active' },
      },
      limit: WARDS_LIMIT,
    });
    return docs.map((ward) => ward.learnerAuthId);
  });

/**
 * Written once, first open only — the read path re-checks so a second device
 * opening the report does not rewrite when the family first saw it.
 */
export const markGuardianViewed: MarkGuardianViewed = async (sessionId, at) =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'sessionSummaries',
      where: { sessionId: { equals: sessionId } },
      limit: 1,
    });
    const doc = docs[0];
    if (!doc || doc.guardianViewedAt) return;
    await payload.update({
      collection: 'sessionSummaries',
      id: doc.id,
      data: { guardianViewedAt: at },
    });
  });

/**
 * The capture crop's canonical URL, straight off the message row. Null when
 * the message — and with it the attachment — has TTL'd out or never finished
 * uploading; null IS the degrade signal the service's ladder consumes. The
 * URL returned is unsigned: signing happens at the door that serves it
 * (`/api/media/view`, or `signCdnUrl` in the share route), never in a store.
 */
export const resolveCaptureCrop: ResolveCaptureCrop = async (messageId, attachmentId) =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'tutorMessages',
      where: { messageId: { equals: messageId } },
      limit: 1,
    });
    const doc = docs[0];
    if (!doc || !Array.isArray(doc.attachments)) return null;
    for (const value of doc.attachments) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
      const attachment = value as { id?: string; url?: string };
      if (attachment.id === attachmentId && typeof attachment.url === 'string') {
        return attachment.url;
      }
    }
    return null;
  });

/** Drafts oldest-first (nothing rots), then the recent published trail. */
export const loadSummaryQueue: LoadSummaryQueue = async () =>
  withPayload(async (payload) => {
    const { docs: drafts } = await payload.find({
      collection: 'sessionSummaries',
      where: { status: { equals: 'draft' } },
      sort: 'createdAt',
      limit: QUEUE_LIMIT,
    });
    const { docs: trail } = await payload.find({
      collection: 'sessionSummaries',
      where: { status: { in: ['published', 'suppressed'] } },
      sort: '-createdAt',
      limit: QUEUE_LIMIT,
    });
    return [...drafts, ...trail].map(reportFromDoc);
  });

/**
 * The erasure cascade's summaries statement — S27's "forget everything"
 * reaching the one store that outlives the transcripts. Deletes by the
 * learner from `ctx` and returns the count the guardian dialog reports.
 * Suppression is NOT this: a takedown keeps its row; only the guardian's
 * erasure removes one.
 */
export const forgetSessionSummaries: ForgetSessionSummaries = async (ctx) =>
  withPayload(async (payload) => {
    const result = await payload.delete({
      collection: 'sessionSummaries',
      where: { learnerAuthId: { equals: ctx.learnerId } },
    });
    return result.docs.length;
  });
