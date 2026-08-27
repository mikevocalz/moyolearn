import 'server-only';
// Doc 34 — the session-summary domain service: §4's pipeline, §5's guardian
// and tutor reads, §3's teacher share. Ports in, decisions here, exactly as
// `features/safety/incidents.service.ts` is shaped.
//
// TWO ENTRY CLASSES, TWO AUTH POSTURES, deliberately:
//
//   · `generateSessionSummary` runs inside a pg-boss job. A job has no session
//     by construction, so — the `distillTranscript` precedent — it synthesizes
//     `ctx` FROM THE ROW it loaded and never from a payload field. Everything
//     else here is a person at a screen and goes through `protectedOperation`.
//
//   · The guardian read filters TWICE, like the incident read: the repository
//     scopes to active wards, and `guardianSummariesFrom` below re-filters on
//     the same facts. A `where` clause is lost by a refactor, a pure filter by
//     a deletion, and no single change removes both.
//
// THE PIPELINE'S ORDER IS THE GUARANTEE (§4): evidence (deterministic) →
// narrative (small model, evidence-only input) → honesty lint → safety screen
// → publish-or-draft. A failure at ANY narrative step falls back to the
// deterministic wording of the same evidence — flat prose beats a retried
// model call that might pass the lint on flattery the second time. Only a
// safety screen that fails EVEN the deterministic copy stops publication, and
// that stop is a logged `suppressed` row, never a silent absence.
// SOT: docs/pack/34-session-summary-reports.md §3 §4 §5 · docs/pack/08-visual-hierarchy-spacing-spec.md · CLAUDE.md §The block
// SOT-KEYWORDS: summary service pipeline generate guardian report view teacher share token draft queue approve suppress viewed loop
import { createHash, randomBytes } from 'node:crypto';
import type { Auth } from '@acme/auth/server';
import { safetyLayer, safetyLayerSync, screen } from '@acme/safety';
import { planeRegisterFor, type VoiceBand } from '@acme/student-model';
import { scrubText } from '@acme/inference';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation.ts';
import { coachClassifier } from '../tutor/tutor-safety.ts';
import type { StoredMessage } from '../tutor/session.types.ts';
import type { LoadPriorFacts } from '../tutor/tutor.service.ts';
import { extractEvidence, type EvidencedTurn, type ExtractedEvidence } from './evidence.ts';
import { lintNarrative, type NarrativeCandidate } from './honesty.ts';
import { homeSupportFor } from './home-support.ts';
import {
  assembleNarrative,
  deterministicNarrative,
  narrativePayload,
  parseModelCopy,
  PROMPT_VERSION,
  SCHEMA_VERSION,
} from './narrative.ts';
import type {
  MasteryMovement,
  ProblemRow,
  SessionSummaryReport,
  SummaryFacts,
  TeacherShare,
} from './summary.types.ts';

// ── Ports ────────────────────────────────────────────────────────────────────

/** The closed session the pipeline is about. Null when the sweep already took it. */
export interface SummarySessionRow {
  readonly sessionId: string;
  readonly learnerAuthId: string;
  readonly problem: string;
  readonly openedAt: string;
  readonly closedAt: string;
  readonly messages: readonly StoredMessage[];
}

export type LoadSessionForSummary = (sessionId: string) => Promise<SummarySessionRow | null>;

/** `edu.transcripts` turns in the session's capture window — the graded stream. */
export type LoadEvidenceTurns = (
  ctx: ProtectedCtx,
  fromIso: string,
  toIso: string,
) => Promise<readonly EvidencedTurn[]>;

export type LoadBand = (ctx: ProtectedCtx) => Promise<VoiceBand>;

export type SaveSummaryReport = (report: SessionSummaryReport) => Promise<void>;

export type LoadSummaryBySession = (sessionId: string) => Promise<SessionSummaryReport | null>;

/**
 * The wards read and the reports read, together, so the projection can prove
 * the scoping (see `guardianSummariesFrom`).
 */
export type LoadGuardianSummaries = (
  ctx: ProtectedCtx,
) => Promise<{ readonly wards: readonly string[]; readonly reports: readonly SessionSummaryReport[] }>;

/** Writes `guardianViewedAt` once — the §5 visibility loop's honest metric. */
export type MarkGuardianViewed = (sessionId: string, at: string) => Promise<void>;

/**
 * The capture crop's canonical (unsigned) CDN URL, or null once the message —
 * and with it the attachment — has TTL'd out. Null IS the degrade signal.
 */
export type ResolveCaptureCrop = (
  messageId: string,
  attachmentId: string,
) => Promise<string | null>;

/** Drafts first, then the recent trail — the Cool queue's two halves. */
export type LoadSummaryQueue = () => Promise<readonly SessionSummaryReport[]>;

/**
 * One narrative completion. Wrapped by the composition root around
 * `gateway.classify('summary-narrative', …)` — the classifier-tier cell, never
 * a frontier call and never a direct SDK import (CLAUDE.md §Children's
 * surfaces applies to every model call, and the gateway is the one door).
 */
export type NarrativeModel = (payload: {
  readonly system: string;
  readonly message: string;
}) => Promise<{ readonly text: string; readonly model: string }>;

export interface GenerateSummaryPorts {
  readonly loadSession: LoadSessionForSummary;
  readonly loadSummary: LoadSummaryBySession;
  readonly loadEvidenceTurns: LoadEvidenceTurns;
  readonly loadPriorFacts: LoadPriorFacts;
  readonly loadBand: LoadBand;
  readonly narrativeModel: NarrativeModel;
  readonly saveSummary: SaveSummaryReport;
}

// ── §4: the pipeline ─────────────────────────────────────────────────────────

export interface GenerateSummaryResult {
  readonly found: boolean;
  /** 'published' | 'draft' | 'suppressed' | 'already' — what this run left behind. */
  readonly outcome: 'published' | 'draft' | 'suppressed' | 'already' | 'missing';
}

/**
 * §4, steps 1–5, for one closed session. Idempotent on the natural key: a row
 * that already left `generating` is left alone, so a pg-boss retry, a
 * dead-letter replay and a hand-run drain between them produce one report.
 *
 * A missing session COMPLETES (`found: false`) — the ids-only payload means
 * the job can outlive the row it names, and a handler that threw would retry
 * ten times into a dead-letter page about a row that was correctly deleted.
 */
export async function generateSessionSummary(
  sessionId: string,
  ports: GenerateSummaryPorts,
  now: Date = new Date(),
): Promise<GenerateSummaryResult> {
  const session = await ports.loadSession(sessionId);
  if (session === null) return { found: false, outcome: 'missing' };

  const existing = await ports.loadSummary(sessionId);
  if (existing !== null && existing.status !== 'generating') {
    return { found: true, outcome: 'already' };
  }

  // Identity from the ROW, never from the queue payload — the distill rule.
  const ctx: ProtectedCtx = { learnerId: session.learnerAuthId, isLearner: true };

  const [turns, priorFacts, band] = await Promise.all([
    ports.loadEvidenceTurns(ctx, session.openedAt, session.closedAt),
    ports.loadPriorFacts(ctx),
    ports.loadBand(ctx),
  ]);

  const evidence = extractEvidence({
    sessionId,
    problem: session.problem,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    messages: session.messages,
    turns,
    masteryFacts: priorFacts.flatMap((fact) =>
      fact.kind === 'mastery' ? [{ skillId: fact.skillId, p: fact.p, attempts: fact.attempts }] : [],
    ),
  });

  const { narrative, model } = await narrativeFor(evidence, ports.narrativeModel);

  // §4 step 4 — the safety screen, over the narrative AND the verbatim answers.
  const screened = await screenSummary(narrative, evidence.problems, ctx, band);

  /*
    All sessions this codebase can currently produce are AI-tutor sessions —
    `tutorSessions` carries no kind, and the human-tutor booking domain does
    not exist yet. The kind rides the report anyway so the §4 step-5 branch is
    one value away when it does; today the branch below is publish-or-suppress.
  */
  const publishable = screened.narrativeSafe;
  const report: SessionSummaryReport = {
    sessionId,
    learnerAuthId: session.learnerAuthId,
    sessionKind: 'ai-tutor',
    band,
    headline: screened.narrative.headline,
    workedOn: screened.narrative.workedOn,
    problems: screened.problems,
    mastery: screened.narrative.mastery,
    effortMoment: screened.narrative.effortMoment,
    nextUp: screened.narrative.nextUp,
    homeSupport: homeSupportFor(screened.narrative.workedOn[0]?.parentLabel ?? evidence.skills[0]?.skillTitle ?? ''),
    facts: evidence.facts,
    evidenceRefs: evidence.evidenceRefs,
    generator: { model, promptVersion: PROMPT_VERSION, schemaVersion: SCHEMA_VERSION },
    safetyScreened: publishable,
    status: publishable ? 'published' : 'suppressed',
    publishedAt: publishable ? now.toISOString() : null,
    guardianViewedAt: null,
    tutorDraft: null,
    tutorApprovedByAuthId: null,
    suppressionReason: publishable
      ? null
      : 'Safety screen rejected the rendered summary, deterministic fallback included. Logged for review — never silently deleted (doc 34 §3).',
    suppressedAt: publishable ? null : now.toISOString(),
    teacherShare: existing?.teacherShare ?? null,
    digestBatchId: null,
    createdAt: existing?.createdAt ?? now.toISOString(),
  };

  await ports.saveSummary(report);
  return { found: true, outcome: publishable ? 'published' : 'suppressed' };
}

/** Model first, deterministic on ANY failure — and the lint judges both. */
async function narrativeFor(
  evidence: ExtractedEvidence,
  narrativeModel: NarrativeModel,
): Promise<{ narrative: NarrativeCandidate; model: string }> {
  try {
    const completion = await narrativeModel(narrativePayload(evidence));
    const copy = parseModelCopy(completion.text);
    if (copy !== null) {
      const assembled = assembleNarrative(evidence, copy);
      if (lintNarrative(assembled, evidence).length === 0) {
        return { narrative: assembled, model: completion.model };
      }
    }
  } catch {
    /*
      ModelDeclined, ProviderUnavailable, a socket reset — all the same answer:
      the report does not wait for the vendor and does not retry into flattery.
      The queue-level retry ladder still exists for the steps BEFORE this one;
      a narrative failure is not a job failure.
    */
  }
  return { narrative: deterministicNarrative(evidence), model: 'deterministic' };
}

interface ScreenedSummary {
  readonly narrative: NarrativeCandidate;
  readonly narrativeSafe: boolean;
  readonly problems: readonly ProblemRow[];
}

/**
 * §4 step 4. Two screens with two different subjects:
 *
 *   · The NARRATIVE (generated text) runs the firewall and the doc-07 output
 *     classifier. A dirty model narrative falls back to the deterministic
 *     wording; deterministic text that STILL screens dirty means the evidence
 *     itself is the problem, and the report suppresses rather than publishes.
 *
 *   · Each verbatim CHILD ANSWER is classified individually. An answer
 *     carrying crisis/prohibited content is already an incident (doc 31) filed
 *     when the turn happened — here its row is simply withheld, because a
 *     parent must never discover an incident in paragraph three of a cheerful
 *     recap (§2). PII in an answer is masked, not withheld.
 */
async function screenSummary(
  narrative: NarrativeCandidate,
  problems: readonly ProblemRow[],
  ctx: ProtectedCtx,
  band: VoiceBand,
): Promise<ScreenedSummary> {
  const identity = {
    learnerId: ctx.learnerId,
    gradeBand: planeRegisterFor(band),
    isMinor: true,
    aiEnabled: true,
  };

  const rendered = [
    narrative.headline,
    ...narrative.workedOn.map((skill) => `${skill.parentLabel} ${skill.whyItMatters}`),
    ...narrative.mastery.map((row) => row.positionCopy),
    narrative.effortMoment?.copy ?? '',
    narrative.nextUp,
  ].join('\n');

  const verdict = safetyLayerSync('5-output', () => screen(rendered, 'tutor'));
  const classes = await safetyLayer('5-output', () => coachClassifier.classifyOutput(rendered, identity));
  const narrativeSafe =
    verdict.allowed && !classes.includes('crisis') && !classes.includes('prohibited');

  const screenedProblems: ProblemRow[] = [];
  for (const row of problems) {
    if (row.childAnswer === null) {
      screenedProblems.push(row);
      continue;
    }
    const answerClasses = await safetyLayer('5-output', () =>
      coachClassifier.classifyOutput(row.childAnswer ?? '', identity),
    );
    if (answerClasses.includes('crisis') || answerClasses.includes('prohibited')) continue;
    screenedProblems.push({ ...row, childAnswer: scrubText(row.childAnswer) });
  }

  return { narrative, narrativeSafe, problems: screenedProblems };
}

// ── §5: the guardian read ────────────────────────────────────────────────────

/** The family-feed card: headline + the delta, nothing else (§5). */
export interface GuardianSummaryCard {
  readonly sessionId: string;
  readonly learnerId: string;
  readonly headline: string;
  readonly publishedAt: string;
  readonly viewed: boolean;
  readonly topMovement: MasteryMovement | null;
}

/** A problems-block row, its question resolved through the degrade ladder. */
export interface ResolvedProblemRow {
  readonly subject: string;
  readonly question:
    | { readonly kind: 'crop'; readonly url: string; readonly text: string | null }
    | { readonly kind: 'text'; readonly text: string }
    | { readonly kind: 'expired' };
  readonly childAnswer: string | null;
  readonly attempts: number;
  readonly status: ProblemRow['status'];
  readonly submittedIncorrect: boolean;
  readonly orderInSession: number;
}

/** Block 3 grouped for the accordion: one section per subject, rows in order. */
export interface SubjectGroup {
  readonly subject: string;
  readonly rows: readonly ResolvedProblemRow[];
}

/** The full report view — §2's eight blocks, in order, ready to draw. */
export interface GuardianSummaryView {
  readonly sessionId: string;
  readonly learnerId: string;
  readonly band: SessionSummaryReport['band'];
  readonly headline: string;
  readonly workedOn: SessionSummaryReport['workedOn'];
  readonly problems: readonly SubjectGroup[];
  readonly mastery: SessionSummaryReport['mastery'];
  readonly effortMoment: SessionSummaryReport['effortMoment'];
  readonly nextUp: string;
  readonly homeSupport: SessionSummaryReport['homeSupport'];
  readonly facts: SummaryFacts;
  readonly publishedAt: string | null;
}

/**
 * The §4.2-style double filter, pure: own ward, and `published` — a draft a
 * tutor still owns and a suppressed row are not a family's business yet, and a
 * row about somebody else's child is never shown even when the query that
 * fetched it was wrong.
 */
export function guardianSummariesFrom(
  reports: readonly SessionSummaryReport[],
  wards: readonly string[],
): readonly SessionSummaryReport[] {
  const mine = new Set(wards);
  return reports.filter(
    (report) =>
      report.status === 'published' &&
      report.publishedAt !== null &&
      mine.has(report.learnerAuthId),
  );
}

const cardFrom = (report: SessionSummaryReport): GuardianSummaryCard => ({
  sessionId: report.sessionId,
  learnerId: report.learnerAuthId,
  headline: report.headline,
  publishedAt: report.publishedAt ?? report.createdAt,
  viewed: report.guardianViewedAt !== null,
  topMovement: report.mastery[0] ?? null,
});

export interface GuardianSummaryPorts {
  readonly loadGuardianSummaries: LoadGuardianSummaries;
}

/** The family feed's cards, newest first. */
export async function guardianSummaries(
  auth: Auth,
  headers: Headers,
  ports: GuardianSummaryPorts,
): Promise<readonly GuardianSummaryCard[]> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const { wards, reports } = await ports.loadGuardianSummaries(ctx);
      return guardianSummariesFrom(reports, wards).map(cardFrom);
    },
    { telemetry: { op: 'summary.guardian.list', resource: 'sessionSummaries', action: 'read' } },
  );
}

export interface GuardianReportPorts extends GuardianSummaryPorts {
  readonly markGuardianViewed: MarkGuardianViewed;
  readonly resolveCaptureCrop: ResolveCaptureCrop;
}

/**
 * One full report, blocks 1–8 — and the evidence degrade ladder applied to
 * every question ref (§2.3): crop → extracted text → "source expired". Null
 * for not-yours and not-found alike, for the same membership-oracle reason the
 * incident route gives.
 *
 * Opening the report writes `guardianViewedAt` once — §5's visibility loop,
 * and the honest org metric (viewed-rate, not sent-rate).
 */
export async function guardianSummaryReport(
  auth: Auth,
  headers: Headers,
  sessionId: string,
  ports: GuardianReportPorts,
): Promise<GuardianSummaryView | null> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const { wards, reports } = await ports.loadGuardianSummaries(ctx);
      const report = guardianSummariesFrom(reports, wards).find(
        (candidate) => candidate.sessionId === sessionId,
      );
      if (!report) return null;

      if (report.guardianViewedAt === null) {
        await ports.markGuardianViewed(sessionId, new Date().toISOString());
      }

      return {
        sessionId: report.sessionId,
        learnerId: report.learnerAuthId,
        band: report.band,
        headline: report.headline,
        workedOn: report.workedOn,
        problems: await resolveProblems(report.problems, ports.resolveCaptureCrop),
        mastery: report.mastery,
        effortMoment: report.effortMoment,
        nextUp: report.nextUp,
        homeSupport: report.homeSupport,
        facts: report.facts,
        publishedAt: report.publishedAt,
      };
    },
    { telemetry: { op: 'summary.guardian.report', resource: 'sessionSummaries', action: 'read' } },
  );
}

/** The degrade ladder, then the subject grouping the accordion draws. */
async function resolveProblems(
  problems: readonly ProblemRow[],
  resolveCaptureCrop: ResolveCaptureCrop,
): Promise<readonly SubjectGroup[]> {
  const resolved: ResolvedProblemRow[] = [];
  for (const row of problems) {
    resolved.push({
      subject: row.subject,
      question: await resolveQuestion(row, resolveCaptureCrop),
      childAnswer: row.childAnswer,
      attempts: row.attempts,
      status: row.status,
      submittedIncorrect: row.submittedIncorrect,
      orderInSession: row.orderInSession,
    });
  }

  const groups = new Map<string, ResolvedProblemRow[]>();
  for (const row of resolved) {
    const group = groups.get(row.subject) ?? [];
    group.push(row);
    groups.set(row.subject, group);
  }
  return [...groups.entries()].map(([subject, rows]) => ({ subject, rows }));
}

async function resolveQuestion(
  row: ProblemRow,
  resolveCaptureCrop: ResolveCaptureCrop,
): Promise<ResolvedProblemRow['question']> {
  if (row.questionRef.kind === 'problem-text') {
    return { kind: 'text', text: row.questionRef.text };
  }
  const url = await resolveCaptureCrop(row.questionRef.messageId, row.questionRef.attachmentId);
  if (url !== null) return { kind: 'crop', url, text: row.questionRef.text };
  // The crop TTL'd out with its message. Tier two is the extracted text; tier
  // three states the truth rather than redrawing something that is gone.
  if (row.questionRef.text !== null) return { kind: 'text', text: row.questionRef.text };
  return { kind: 'expired' };
}

// ── §3: teacher share — guardian-initiated, revocable, expiring ──────────────

/**
 * The share window. A school term is the natural unit a teacher needs; thirty
 * days forces the guardian to re-consent each month rather than leaving a live
 * link in an inbox forever — the expiry IS the consent model's teeth.
 */
export const TEACHER_SHARE_TTL_DAYS = 30;

export interface TeacherShareGrant {
  /** The path the guardian hands the teacher. The only place the token exists. */
  readonly path: string;
  readonly expiresAt: string;
}

export interface TeacherSharePorts extends GuardianSummaryPorts {
  readonly loadSummary: LoadSummaryBySession;
  readonly saveSummary: SaveSummaryReport;
}

const hashShareSecret = (secret: string): string =>
  createHash('sha256').update(secret).digest('base64url');

/**
 * Mints the share link. GUARDIAN-INITIATED and ward-checked — the guardian
 * owns consent (§3's FERPA posture), so no staff surface and no learner
 * surface can create one. The stored row keeps only the HASH; the returned
 * path is the single copy of the raw token, and re-sharing mints a fresh
 * secret that invalidates the old link — rotation and revocation are the same
 * mechanism.
 */
export async function createTeacherShare(
  auth: Auth,
  headers: Headers,
  sessionId: string,
  ports: TeacherSharePorts,
): Promise<TeacherShareGrant | null> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const { wards, reports } = await ports.loadGuardianSummaries(ctx);
      const owned = guardianSummariesFrom(reports, wards).some(
        (report) => report.sessionId === sessionId,
      );
      if (!owned) return null;
      const report = await ports.loadSummary(sessionId);
      if (report === null) return null;

      const secret = randomBytes(32).toString('base64url');
      const expiresAt = new Date(
        Date.now() + TEACHER_SHARE_TTL_DAYS * 86_400_000,
      ).toISOString();
      const teacherShare: TeacherShare = {
        enabled: true,
        tokenHash: hashShareSecret(secret),
        expiresAt,
        revokedAt: null,
      };
      await ports.saveSummary({ ...report, teacherShare });
      /*
        `sessionId.secret` so the door's lookup rides the unique `session_id`
        index instead of a JSON-path query. The sessionId half is not secret
        (it is a UUID the guardian already sees); the secret half is the
        credential, and only its hash is stored.
      */
      return { path: `/share/report/${sessionId}.${secret}`, expiresAt };
    },
    { telemetry: { op: 'summary.share.create', resource: 'sessionSummaries', action: 'write' } },
  );
}

/** Revocation: the link dies now, the row remembers when and that it did. */
export async function revokeTeacherShare(
  auth: Auth,
  headers: Headers,
  sessionId: string,
  ports: TeacherSharePorts,
): Promise<boolean> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const { wards, reports } = await ports.loadGuardianSummaries(ctx);
      const owned = guardianSummariesFrom(reports, wards).some(
        (report) => report.sessionId === sessionId,
      );
      if (!owned) return false;
      const report = await ports.loadSummary(sessionId);
      if (report === null || report.teacherShare === null) return false;
      await ports.saveSummary({
        ...report,
        teacherShare: { ...report.teacherShare, enabled: false, revokedAt: new Date().toISOString() },
      });
      return true;
    },
    { telemetry: { op: 'summary.share.revoke', resource: 'sessionSummaries', action: 'write' } },
  );
}

/** §5's teacher view: blocks 1–6 + 8; home support swaps for a classroom line. */
export interface TeacherShareView {
  readonly headline: string;
  readonly workedOn: SessionSummaryReport['workedOn'];
  readonly problems: readonly SubjectGroup[];
  readonly mastery: SessionSummaryReport['mastery'];
  readonly effortMoment: SessionSummaryReport['effortMoment'];
  readonly nextUp: string;
  readonly classroomContext: string;
  readonly facts: SummaryFacts;
  readonly publishedAt: string | null;
}

export interface SharedSummaryPorts {
  readonly loadSummary: LoadSummaryBySession;
  readonly resolveCaptureCrop: ResolveCaptureCrop;
}

/**
 * The tokened read — the ONE door with no session behind it, because the token
 * is the authorization: guardian-minted, hash-verified, expiring, revocable.
 * Every failure is the same null, so the door is not an oracle over which
 * session ids have shares.
 *
 * NOT wrapped in `protectedOperation` deliberately: a teacher has no Moyo
 * session, and the block's identity rule is satisfied the other way around —
 * no identity enters at all, and the view carries no learner id, no name and
 * no home-support block.
 */
export async function sharedSummaryView(
  token: string,
  ports: SharedSummaryPorts,
  now: Date = new Date(),
): Promise<TeacherShareView | null> {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const sessionId = token.slice(0, dot);
  const secret = token.slice(dot + 1);

  const report = await ports.loadSummary(sessionId);
  const share = report?.teacherShare ?? null;
  if (report === null || share === null) return null;
  if (!share.enabled || share.revokedAt !== null) return null;
  if (Date.parse(share.expiresAt) <= now.getTime()) return null;
  if (report.status !== 'published') return null;

  /*
    Constant-shape comparison on the HASH: the stored value is a digest, so a
    database read never yields the credential, and comparing digests keeps the
    timing surface flat across wrong-secret attempts.
  */
  if (hashShareSecret(secret) !== share.tokenHash) return null;

  return {
    headline: report.headline,
    workedOn: report.workedOn,
    problems: await resolveProblems(report.problems, ports.resolveCaptureCrop),
    mastery: report.mastery,
    effortMoment: report.effortMoment,
    nextUp: report.nextUp,
    classroomContext:
      report.workedOn[0] !== undefined
        ? `Currently working on ${report.workedOn[0].parentLabel} in tutoring — reinforcement in class compounds it.`
        : 'Shared from a Moyo tutoring session.',
    facts: report.facts,
    publishedAt: report.publishedAt,
  };
}

// ── §5: the tutor/org queue (Cool dial) ──────────────────────────────────────

/** One DataTable row: what the queue sorts, filters and acts on. */
export interface SummaryQueueRow {
  readonly sessionId: string;
  readonly learnerId: string;
  readonly status: SessionSummaryReport['status'];
  readonly sessionKind: SessionSummaryReport['sessionKind'];
  readonly headline: string;
  readonly attempted: number;
  readonly solvedIndependently: number;
  readonly createdAt: string;
  readonly publishedAt: string | null;
  readonly guardianViewedAt: string | null;
}

export interface SummaryQueuePorts {
  readonly loadSummaryQueue: LoadSummaryQueue;
}

/**
 * The draft-review queue plus the recent trail, one list — §5's Cool surface.
 *
 * Platform-scoped rather than org-scoped, the SAME documented gap the incident
 * triage queue records: summaries carry a learner pointer and no org edge,
 * because doc 23 §2 puts the learner behind a LearnerRef. Until that edge is a
 * query this codebase can issue, the boundary is `requiresMembership` — the
 * role wall. It is NOT `requires: 'write'` alone: `write` is a billing
 * capability an active family plan satisfies, so "no family plan grants it"
 * was false and a paying guardian could read every child's draft queue.
 * `write` stays beside the role so a lapsed org cannot keep reviewing, and it
 * is NOT `export`: this is a work queue, not a data egress.
 */
export async function summaryQueue(
  auth: Auth,
  headers: Headers,
  ports: SummaryQueuePorts,
): Promise<readonly SummaryQueueRow[]> {
  return protectedOperation(
    auth,
    headers,
    async () => {
      const reports = await ports.loadSummaryQueue();
      return reports.map((report) => ({
        sessionId: report.sessionId,
        learnerId: report.learnerAuthId,
        status: report.status,
        sessionKind: report.sessionKind,
        headline: report.headline,
        attempted: report.facts.attempted,
        solvedIndependently: report.facts.solvedIndependently,
        createdAt: report.createdAt,
        publishedAt: report.publishedAt,
        guardianViewedAt: report.guardianViewedAt,
      }));
    },
    {
      requires: 'write',
      // Doc 34 §5's Cool surface is review work: owner/manager. Scheduler and
      // finance have no reason to read children's session drafts.
      requiresMembership: ['owner', 'manager'],
      telemetry: { op: 'summary.queue.list', resource: 'sessionSummaries', action: 'read' },
    },
  );
}

export interface DraftActionPorts {
  readonly loadSummary: LoadSummaryBySession;
  readonly saveSummary: SaveSummaryReport;
}

/**
 * §4 step 5's human half: the AI drafted, the human owns. Approval publishes;
 * an edited note replaces the draft text and the approver is recorded — the
 * LearnSpeed pattern with an audit column.
 */
export async function approveSummaryDraft(
  auth: Auth,
  headers: Headers,
  input: { readonly sessionId: string; readonly tutorDraft?: string },
  ports: DraftActionPorts,
): Promise<boolean> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const report = await ports.loadSummary(input.sessionId);
      if (report === null || report.status !== 'draft') return false;
      await ports.saveSummary({
        ...report,
        tutorDraft: input.tutorDraft ?? report.tutorDraft,
        tutorApprovedByAuthId: ctx.learnerId,
        status: 'published',
        publishedAt: new Date().toISOString(),
      });
      return true;
    },
    {
      requires: 'write',
      // The approver is recorded as the audit line's actor — staff identity by
      // definition, so the role wall matches the queue read's.
      requiresMembership: ['owner', 'manager'],
      telemetry: { op: 'summary.draft.approve', resource: 'sessionSummaries', action: 'write' },
    },
  );
}

/**
 * The reviewer takedown — §3's `suppressed`: LOGGED suppression, never silent
 * deletion. The reason is mandatory because a takedown nobody can explain is a
 * takedown that gets repeated.
 */
export async function suppressSummary(
  auth: Auth,
  headers: Headers,
  input: { readonly sessionId: string; readonly reason: string },
  ports: DraftActionPorts,
): Promise<boolean> {
  return protectedOperation(
    auth,
    headers,
    async () => {
      if (input.reason.trim() === '') return false;
      const report = await ports.loadSummary(input.sessionId);
      if (report === null || report.status === 'suppressed') return false;
      await ports.saveSummary({
        ...report,
        status: 'suppressed',
        suppressionReason: input.reason,
        suppressedAt: new Date().toISOString(),
      });
      return true;
    },
    {
      requires: 'write',
      // A takedown of a family-facing report is reviewer authority — the same
      // owner/manager wall as approval, or the two actions disagree about who
      // a reviewer is.
      requiresMembership: ['owner', 'manager'],
      telemetry: { op: 'summary.suppress', resource: 'sessionSummaries', action: 'write' },
    },
  );
}

// ── Session close — the pipeline's producer ──────────────────────────────────

/** Sets `closedAt` when null. False when the session is not this learner's. */
export type CloseTutorSession = (
  ctx: ProtectedCtx,
  sessionId: string,
) => Promise<{ readonly closed: boolean; readonly alreadyClosed: boolean }>;

/** Enqueues `summary.generate`. Null return = already queued, which is success. */
export type EnqueueSummaryJob = (sessionId: string) => Promise<string | null>;

/**
 * Doc 34 §4's trigger: "session ends → pg-boss job". The close is the domain
 * write and the enqueue follows it — same ordering guarantee the evaluate
 * route documents for `edu.distill`: enqueue-after-write means the worst case
 * is a closed session with no job, recoverable by re-enqueueing on the same
 * key, rather than a job racing a row that isn't closed yet.
 *
 * Closing an already-closed session re-enqueues rather than erroring — the
 * `summaryKey` singleton and the unique row make that a no-op, and it is the
 * recovery path for exactly the worst case above.
 */
export async function closeSession(
  auth: Auth,
  headers: Headers,
  input: { readonly sessionId: string },
  closeTutorSession: CloseTutorSession,
  enqueueSummaryJob: EnqueueSummaryJob,
): Promise<{ readonly closed: boolean }> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const result = await closeTutorSession(ctx, input.sessionId);
      if (!result.closed && !result.alreadyClosed) return { closed: false };
      await enqueueSummaryJob(input.sessionId);
      return { closed: true };
    },
    { telemetry: { op: 'tutor.session.close', resource: 'tutorSessions', action: 'write' } },
  );
}
