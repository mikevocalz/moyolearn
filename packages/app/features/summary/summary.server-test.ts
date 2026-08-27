// Doc 34 §4 step 4 and §5's ownership question, held as tests.
//
// Two claims, both about a failure that looks like nothing on a screen:
//
//  1. THE SCREEN HAS TWO STAGES. `screen()` is documented as accepting false
//     positives BECAUSE its callers regenerate, and §4 says only copy that
//     screens dirty after the deterministic pass stops publication. A
//     single-stage screen loses the parent the whole report over one unlucky
//     model phrase — and the parent never learns a report existed. This drives
//     the pipeline with a narrative model that returns a false positive and
//     asserts a published report in the deterministic voice.
//
//  2. OWNERSHIP IS NOT A PAGE OF A FEED. `guardianSummaryFrom` answers the
//     by-id question — is this MY ward's published report — against the ward
//     list alone. Deriving it from the feed instead bounded it at
//     `FEED_LIMIT`, which meant a share outliving the newest-50 window could
//     not be revoked by the guardian who minted it while the link still
//     resolved.
//
// `.server-test.ts` because the service opens with `import 'server-only'`.
// SOT: docs/pack/34-session-summary-reports.md §3 §4 §5
// SOT-KEYWORDS: summary pipeline test two stage screen deterministic fallback suppress ownership ward feed limit revoke share
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MasteryFact } from '@acme/student-model';
import type { StoredMessage } from '../tutor/session.types.ts';
import {
  generateSessionSummary,
  guardianSummaryFrom,
  type GenerateSummaryPorts,
  type SummarySessionRow,
} from './summary.service.ts';
import type { SessionSummaryReport } from './summary.types.ts';

const OPENED = '2026-08-27T10:00:00.000Z';
const CLOSED = '2026-08-27T10:20:00.000Z';

const session: SummarySessionRow = {
  sessionId: 'sess_1',
  learnerAuthId: 'learner_1',
  problem: '1/2 + 1/4',
  openedAt: OPENED,
  closedAt: CLOSED,
  messages: [] as readonly StoredMessage[],
};

const masteryFact: MasteryFact = {
  kind: 'mastery',
  id: 'fact_1',
  learnerId: 'learner_1',
  sentence: 'Sam is working within reach on fractions.',
  derivedFrom: ['t-1'],
  observedAt: CLOSED,
  expiresAt: '2027-08-27T10:20:00.000Z',
  skillId: 'Fractions',
  skillTitle: 'Fractions',
  p: 0.55,
  attempts: 9,
};

/**
 * Ports with one seam: what the narrative model answers. Everything else is a
 * fixed, graded fractions session — enough evidence for the deterministic
 * narrative to have something to say.
 */
function ports(
  narrativeModel: GenerateSummaryPorts['narrativeModel'],
  saved: SessionSummaryReport[],
): GenerateSummaryPorts {
  return {
    loadSession: async () => session,
    loadSummary: async () => null,
    loadEvidenceTurns: async () => [
      {
        transcriptId: 't-1',
        index: 0,
        skillId: 'Fractions',
        skillTitle: 'Fractions',
        correct: false,
        hintDepth: 0,
        storable: true,
      },
      {
        transcriptId: 't-2',
        index: 1,
        skillId: 'Fractions',
        skillTitle: 'Fractions',
        correct: true,
        hintDepth: 1,
        storable: true,
      },
    ],
    loadPriorFacts: async () => [masteryFact],
    loadBand: async () => '3-5',
    narrativeModel,
    saveSummary: async (report) => {
      saved.push(report);
    },
  };
}

/*
  A narrative a parent would want and the classifier cannot tell from a
  disclosure: the child's word problem was about walking home. `afraid to go
  home` is a CRISIS_PATTERN, so this is exactly the false positive the screen's
  own contract says callers absorb by regenerating.
*/
const FALSE_POSITIVE_COPY = JSON.stringify({
  headline: 'Worked a word problem about being afraid to go home in the dark.',
  workedOn: [
    {
      skillId: 'Fractions',
      parentLabel: 'splitting things into equal parts',
      whyItMatters: 'it is the ground division stands on',
    },
  ],
  positionCopy: { Fractions: 'Working within reach on this.' },
  effortCopy: null,
  nextUp: 'Next session picks Fractions back up.',
});

const CLEAN_COPY = JSON.stringify({
  headline: 'Kept going on fractions until the second attempt landed.',
  workedOn: [
    {
      skillId: 'Fractions',
      parentLabel: 'splitting things into equal parts',
      whyItMatters: 'it is the ground division stands on',
    },
  ],
  positionCopy: { Fractions: 'Working within reach on this.' },
  effortCopy: null,
  nextUp: 'Next session picks Fractions back up.',
});

describe('doc 34 §4 step 4 — the safety screen has two stages', () => {
  it('falls back to the deterministic wording instead of suppressing the report', async () => {
    const saved: SessionSummaryReport[] = [];
    const result = await generateSessionSummary(
      'sess_1',
      ports(async () => ({ text: FALSE_POSITIVE_COPY, model: 'test-classifier' }), saved),
    );

    assert.equal(result.outcome, 'published', 'one unlucky model phrase cost the parent the whole report');
    const report = saved[0];
    assert.ok(report);
    assert.equal(report.status, 'published');
    assert.equal(report.safetyScreened, true);
    assert.equal(report.suppressionReason, null);
    assert.equal(
      report.generator.model,
      'deterministic',
      'the published copy must be attributable to the pass that actually wrote it',
    );
    assert.ok(
      !report.headline.includes('afraid to go home'),
      'the copy that failed the screen was published anyway',
    );
  });

  it('keeps a clean model narrative — the fallback is a fallback, not the default', async () => {
    const saved: SessionSummaryReport[] = [];
    const result = await generateSessionSummary(
      'sess_1',
      ports(async () => ({ text: CLEAN_COPY, model: 'test-classifier' }), saved),
    );

    assert.equal(result.outcome, 'published');
    assert.equal(saved[0]?.generator.model, 'test-classifier');
  });

  it('keys block 7 on the skill title, never on the model’s parent-facing rewording', async () => {
    /*
      `homeSupportFor` is a curated map keyed on `inferSkillTitle` output.
      Handing it `parentLabel` — "splitting things into equal parts" — silently
      returned DEFAULT_SUPPORT on every report the model narrated, so the block
      written for the kitchen table only ever shipped on the fallback path.
    */
    const saved: SessionSummaryReport[] = [];
    await generateSessionSummary(
      'sess_1',
      ports(async () => ({ text: CLEAN_COPY, model: 'test-classifier' }), saved),
    );

    assert.match(
      saved[0]?.homeSupport.activity ?? '',
      /fold one sheet of paper/,
      'the curated Fractions block did not survive a model narrative',
    );
  });
});

const report = (over: Partial<SessionSummaryReport> = {}): SessionSummaryReport => ({
  sessionId: 'sess_1',
  learnerAuthId: 'learner_1',
  sessionKind: 'ai-tutor',
  band: '3-5',
  headline: 'A session.',
  workedOn: [],
  problems: [],
  mastery: [],
  effortMoment: null,
  nextUp: 'Next session.',
  homeSupport: { conversationStarter: 'Ask them.', activity: '5 minutes: do it.' },
  facts: { durationMin: 20, attempted: 1, solvedIndependently: 0, solvedWithHelp: 1 },
  evidenceRefs: [],
  generator: { model: 'deterministic', promptVersion: 'v1', schemaVersion: 'v1' },
  safetyScreened: true,
  status: 'published',
  publishedAt: CLOSED,
  guardianViewedAt: null,
  tutorDraft: null,
  tutorApprovedByAuthId: null,
  suppressionReason: null,
  suppressedAt: null,
  teacherShare: null,
  digestBatchId: null,
  createdAt: CLOSED,
  ...over,
});

describe('doc 34 §5 — the by-id ownership question', () => {
  it('answers for a report far older than any feed page — a live share stays revocable', () => {
    const aged = report({ publishedAt: '2026-01-02T09:00:00.000Z' });
    assert.ok(
      guardianSummaryFrom(aged, ['learner_1']) !== null,
      'ownership was decided by a feed window, so the guardian lost the revoke button before the link expired',
    );
  });

  it('refuses another household’s report', () => {
    assert.equal(guardianSummaryFrom(report({ learnerAuthId: 'learner_9' }), ['learner_1']), null);
  });

  it('refuses a draft and a suppressed row — published is half the filter', () => {
    assert.equal(guardianSummaryFrom(report({ status: 'draft' }), ['learner_1']), null);
    assert.equal(guardianSummaryFrom(report({ status: 'suppressed' }), ['learner_1']), null);
  });

  it('refuses not-found the same way it refuses not-yours', () => {
    assert.equal(guardianSummaryFrom(null, ['learner_1']), null);
  });
});
