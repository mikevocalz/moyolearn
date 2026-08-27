// Doc 31 §3 and §4, as a regression gate.
//
// Four rules are held here and each one fails silently in production if it is
// not: an escalation that stops climbing looks like a calm child, a generated
// S4 reply looks like a caring one, a hold that lapses looks like retention
// working, and an SLA derived twice looks right on both screens until they
// disagree.
//
// THE S4 TEST IS THE ONE THAT MATTERS. It does not check that the crisis path
// returns a nice string — it checks that the generator was NEVER CALLED and that
// what a child would see is byte-identical to the published script. A paraphrase
// passes every test that asks "is this caring" and is exactly what §3.2 forbids.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §3.2 §4 · docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: ladder test S2 repetition escalation rolling window S4 fixed script legal hold sla incident guardian visible

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  escalate,
  slaDueAt,
  tierFor,
  tierIsGuardianVisible,
  LADDER,
  REPETITION_THRESHOLD,
  REPETITION_WINDOW_MINUTES,
  SAFETY_TIERS,
  type PriorRung,
  type SafetyTier,
} from './ladder.ts';
import {
  acknowledgeIncident,
  incidentFromSafetyEvent,
  incidentFromSubmission,
  isHeld,
  markFannedOut,
  slaBreached,
  transitionIncident,
  INCIDENT_TTL_DAYS,
  LEGAL_HOLD_REASON,
} from './incidents.ts';
import { crisisResponse, isFixedCrisisScript, S4_SCRIPTS } from './crisis.ts';
import { escalatedSafetyEvent, pausedSafetyEvent, safetyEventFor } from './events.ts';
import { runSafetyPlane, runSafetyPlaneStream, type Classifier, type Generator, type IdentityContext, type StreamingGenerator } from './plane.ts';

const NOW = new Date('2026-08-27T16:00:00.000Z');
const at = (minutesAgo: number): Date => new Date(NOW.getTime() - minutesAgo * 60_000);
const rung = (tier: SafetyTier, minutesAgo: number): PriorRung => ({
  tier,
  at: at(minutesAgo).toISOString(),
});

describe('the S1–S4 ladder', () => {
  it('maps every plane verdict onto a rung, and the pause onto none', () => {
    assert.equal(tierFor('crisis'), 'S4');
    assert.equal(tierFor('safety'), 'S3');
    assert.equal(tierFor('boundary'), 'S1');
    /*
      The important null. A classifier that timed out is not a child's conduct,
      and filing it as S1 would put a system outage on a ladder whose every other
      rung is a judgement about a person.
    */
    assert.equal(tierFor('paused'), null);
  });

  it('keeps a fence-test off a parent’s screen and puts a blocked turn on it', () => {
    assert.equal(tierIsGuardianVisible('S1'), false);
    assert.equal(tierIsGuardianVisible('S2'), false);
    assert.equal(tierIsGuardianVisible('S3'), true);
    assert.equal(tierIsGuardianVisible('S4'), true);
    // Doc 12 §5: a paused tutor IS guardian-visible, by a different sentence.
    assert.equal(tierIsGuardianVisible(null), true);
  });

  it('files an incident from S3 up and from nowhere below it', () => {
    assert.deepEqual(
      SAFETY_TIERS.filter((tier) => LADDER[tier].filesIncident),
      ['S3', 'S4'],
    );
    assert.deepEqual(
      SAFETY_TIERS.filter((tier) => LADDER[tier].pagesHuman),
      ['S4'],
    );
  });

  it('reads §4.3’s clocks off the rung, so nothing can derive them twice', () => {
    assert.equal(LADDER.S3.slaHours, 48);
    assert.equal(LADDER.S4.slaHours, 2);
    assert.equal(slaDueAt('S4', NOW), new Date(NOW.getTime() + 2 * 3_600_000).toISOString());
    assert.equal(slaDueAt('S3', NOW), new Date(NOW.getTime() + 48 * 3_600_000).toISOString());
    assert.equal(slaDueAt('S1', NOW), null);
    assert.equal(slaDueAt('S2', NOW), null);
  });
});

describe('doc 31 §3.2’s rolling-window escalation', () => {
  it('does not escalate a first, second, or isolated S2', () => {
    assert.equal(escalate('S2', [], NOW), 'S2');
    assert.equal(escalate('S2', [rung('S2', 5)], NOW), 'S2');
  });

  it('escalates the third S2 inside the window to S3', () => {
    const priors = [rung('S2', 5), rung('S2', 20)];
    assert.equal(priors.length + 1, REPETITION_THRESHOLD);
    assert.equal(escalate('S2', priors, NOW), 'S3');
  });

  it('does not escalate when the repetition is older than the window', () => {
    /*
      The window is the whole reason this is not punishment. Two words on Monday
      and one on Friday is not "continued after a redirect" — it is a child who
      was redirected, and it must not reach a parent as a case number.
    */
    const stale = REPETITION_WINDOW_MINUTES + 1;
    assert.equal(escalate('S2', [rung('S2', stale), rung('S2', stale + 30)], NOW), 'S2');
  });

  it('counts only the SAME rung — an S1 does not help an S2 climb', () => {
    assert.equal(escalate('S2', [rung('S1', 5), rung('S1', 10), rung('S2', 15)], NOW), 'S2');
  });

  it('climbs S1 → S2 by the same rule, which is what "after redirect" means', () => {
    assert.equal(escalate('S1', [rung('S1', 5), rung('S1', 15)], NOW), 'S2');
    assert.equal(escalate('S1', [rung('S1', 5)], NOW), 'S1');
  });

  it('never climbs into S4 — a crisis is a disclosure, never an accumulation', () => {
    const manyS2 = Array.from({ length: 40 }, (_, i) => rung('S2', i));
    assert.equal(escalate('S2', manyS2, NOW), 'S3');
    // And S3 itself is terminal for the climb.
    assert.equal(escalate('S3', manyS2, NOW), 'S3');
  });

  it('re-judges the event, and the escalation is what a guardian is told by', () => {
    const event = safetyEventFor(
      { kind: 'redirect', text: 'back to the problem', storeInStudentModel: false },
      [{ layer: '4-fence', detail: 'redirect' }],
      { learnerId: 'learner_1', sessionId: 'sess_1' },
      at(0),
    );
    assert.ok(event);
    assert.equal(event.tier, 'S1');
    assert.equal(event.guardianVisible, false);

    const climbed = escalatedSafetyEvent(event, 'S3');
    assert.equal(climbed.tier, 'S3');
    assert.equal(climbed.guardianVisible, true);
    // The original is untouched — the record is judged once, not edited.
    assert.equal(event.tier, 'S1');
  });
});

describe('doc 31 §3.2 S4 — never a generated response in this tier', () => {
  const identity: IdentityContext = {
    learnerId: 'learner_1',
    gradeBand: 'young',
    isMinor: true,
    aiEnabled: true,
  };

  /** A generator that records every call and would fail the assertion if used. */
  const spyGenerator = (): { generator: Generator; stream: StreamingGenerator; calls: () => number } => {
    let calls = 0;
    return {
      generator: {
        generate: async () => {
          calls += 1;
          return 'I am so sorry you feel that way. Let us talk about it together.';
        },
      },
      stream: {
        generateStream: async function* () {
          calls += 1;
          yield 'I am so sorry you feel that way.';
        },
      },
      calls: () => calls,
    };
  };

  const crisisClassifier: Classifier = {
    classifyInput: async () => 'crisis',
    classifyOutput: async () => [],
  };

  it('publishes exactly two scripts and nothing composed', () => {
    assert.equal(crisisResponse('young').message, S4_SCRIPTS.young);
    assert.equal(crisisResponse('older').message, S4_SCRIPTS.older);
    assert.equal(crisisResponse('young').scripted, true);
    assert.equal(crisisResponse('young').safeMode, 'until-human-clears');
    assert.equal(isFixedCrisisScript(S4_SCRIPTS.young), true);
    // A paraphrase is the failure mode, and it fails.
    assert.equal(isFixedCrisisScript('I am stopping our work here. What you said matters.'), false);
  });

  it('answers a crisis turn with the script and never reaches the model', async () => {
    const spy = spyGenerator();
    const result = await runSafetyPlane('i want to die', identity, {
      classifier: crisisClassifier,
      generator: spy.generator,
    });

    assert.equal(result.outcome.kind, 'crisis');
    assert.ok(result.outcome.kind === 'crisis');
    assert.equal(isFixedCrisisScript(result.outcome.response.message), true);
    assert.equal(spy.calls(), 0, 'the model was consulted on an S4 turn');
  });

  it('does the same on the streaming path, where a chunk would already be on screen', async () => {
    const spy = spyGenerator();
    const frames = [];
    for await (const event of runSafetyPlaneStream('i want to die', identity, {
      classifier: crisisClassifier,
      generator: spy.stream,
    })) {
      frames.push(event);
    }

    assert.equal(frames.length, 1, 'an S4 turn emitted a chunk before stopping');
    const done = frames[0];
    assert.ok(done !== undefined && done.kind === 'done' && done.outcome.kind === 'crisis');
    assert.equal(isFixedCrisisScript(done.outcome.response.message), true);
    assert.equal(spy.calls(), 0, 'the model was consulted on an S4 turn');
  });

  it('files the S4 event at the top rung, guardian-visible', () => {
    const event = safetyEventFor(
      { kind: 'crisis', response: crisisResponse('young'), storeInStudentModel: false },
      [{ layer: '3-input', detail: 'crisis' }, { layer: '6-crisis' }],
      { learnerId: 'learner_1', sessionId: 'sess_1' },
      NOW,
    );
    assert.ok(event);
    assert.equal(event.tier, 'S4');
    assert.equal(event.guardianVisible, true);
  });
});

describe('doc 31 §4 — the Incident Report', () => {
  const eventAt = (
    outcome: Parameters<typeof safetyEventFor>[0],
    trace: Parameters<typeof safetyEventFor>[1],
  ) => {
    const event = safetyEventFor(outcome, trace, { learnerId: 'learner_1', sessionId: 'sess_1' }, NOW);
    assert.ok(event);
    return event;
  };

  const blocked = () => eventAt({ kind: 'blocked', broke: [], storeInStudentModel: false }, [
    { layer: '3-input', detail: 'prohibited' },
  ]);

  const crisis = () =>
    eventAt({ kind: 'crisis', response: crisisResponse('older'), storeInStudentModel: false }, [
      { layer: '3-input', detail: 'crisis' },
      { layer: '6-crisis' },
    ]);

  it('files nothing below S3 — a fence-test is a log line, not a case', () => {
    const fence = eventAt({ kind: 'redirect', text: 'back to it', storeInStudentModel: false }, [
      { layer: '4-fence', detail: 'redirect' },
    ]);
    assert.equal(incidentFromSafetyEvent(fence, NOW), null);
    assert.equal(
      incidentFromSafetyEvent(pausedSafetyEvent('3-input', { learnerId: 'l', sessionId: null }, NOW), NOW),
      null,
    );
  });

  it('files an S3 with a 48h clock, guardian-visible, and no hold', () => {
    const report = incidentFromSafetyEvent(blocked(), NOW);
    assert.ok(report);
    assert.equal(report.severity, 'S3');
    assert.equal(report.source, 'automated');
    assert.equal(report.reporterRole, 'system');
    assert.equal(report.status, 'new');
    assert.equal(report.guardianVisible, true);
    assert.equal(report.slaDueAt, new Date(NOW.getTime() + 48 * 3_600_000).toISOString());
    assert.equal(report.legalHold, null);
    assert.equal(report.timeline.length, 1);
    assert.equal(report.expiresAt, new Date(NOW.getTime() + INCIDENT_TTL_DAYS * 86_400_000).toISOString());
  });

  it('holds every S4 record, and names why', () => {
    const report = incidentFromSafetyEvent(crisis(), NOW);
    assert.ok(report);
    assert.equal(report.severity, 'S4');
    assert.equal(report.legalHold, LEGAL_HOLD_REASON);
    assert.equal(report.slaDueAt, new Date(NOW.getTime() + 2 * 3_600_000).toISOString());
    // The clock is still written: a released hold has to land on a schedule.
    assert.ok(report.expiresAt);
  });

  it('holds an abuse disclosure at any tier, because the category is the trigger too', () => {
    assert.equal(isHeld('S3', 'abuse-disclosure'), true);
    assert.equal(isHeld('S1', 'abuse-disclosure'), true);
    assert.equal(isHeld('S4', 'profanity'), true);
    assert.equal(isHeld('S3', 'profanity'), false);
  });

  it('applies a hold when a triager narrows a report to abuse-disclosure', () => {
    const report = incidentFromSafetyEvent(blocked(), NOW);
    assert.ok(report);
    assert.equal(report.legalHold, null);

    const triaged = transitionIncident(
      report,
      { status: 'triaged', category: 'abuse-disclosure' },
      'staff_7',
      NOW,
    );
    assert.equal(triaged.legalHold, LEGAL_HOLD_REASON);
    assert.equal(triaged.timeline.length, 2);
  });

  it('never lifts a hold, whatever the transition says', () => {
    const held = incidentFromSafetyEvent(crisis(), NOW);
    assert.ok(held);
    const downgraded = transitionIncident(
      held,
      { status: 'resolved', severity: 'S1', category: 'profanity' },
      'staff_7',
      NOW,
    );
    assert.equal(downgraded.legalHold, LEGAL_HOLD_REASON);
  });

  it('keeps the timeline append-only through every transition', () => {
    const report = incidentFromSafetyEvent(blocked(), NOW);
    assert.ok(report);
    const first = report.timeline[0];

    const walked = acknowledgeIncident(
      transitionIncident(
        transitionIncident(report, { status: 'triaged', assigneeId: 'staff_7' }, 'staff_7', NOW),
        { status: 'resolved', resolution: 'Spoke with the family.' },
        'staff_7',
        NOW,
      ),
      'guardian_2',
      NOW,
    );

    assert.equal(walked.timeline.length, 4);
    assert.deepEqual(walked.timeline[0], first, 'the opening entry was rewritten');
    assert.equal(walked.timeline[3]?.action, 'guardian-acknowledged');
    // The report it was derived from is untouched.
    assert.equal(report.timeline.length, 1);
  });

  it('acknowledges once, however many times a parent taps', () => {
    const report = incidentFromSafetyEvent(blocked(), NOW);
    assert.ok(report);
    const once = acknowledgeIncident(report, 'guardian_2', NOW);
    const twice = acknowledgeIncident(once, 'guardian_2', new Date(NOW.getTime() + 60_000));
    assert.equal(twice.timeline.length, once.timeline.length);
    assert.equal(twice.guardianAcknowledgedAt, once.guardianAcknowledgedAt);
  });

  it('carries a transcript excerpt as a reference and has nowhere to put a copy', () => {
    const report = incidentFromSafetyEvent(blocked(), NOW);
    assert.ok(report);
    assert.deepEqual(report.transcriptExcerpt, { sessionId: 'sess_1', messageIds: [] });
    assert.equal(
      Object.hasOwn(report.transcriptExcerpt ?? {}, 'text'),
      false,
      'an excerpt grew a field wide enough to hold a child’s words',
    );
  });

  it('does not let a reporter choose their own severity', () => {
    const submitted = incidentFromSubmission(
      {
        reporterRole: 'guardian',
        anonymous: false,
        subjectLearnerId: 'learner_1',
        relatedSessionId: null,
        category: 'bullying',
        occurredAt: NOW.toISOString(),
        summary: 'She said another student called her names during the session.',
        immediateActionTaken: null,
        attachmentIds: [],
      },
      'guardian_2',
      NOW,
    );
    // §5.1: severity is the system's judgment at triage, not a colour a
    // frightened parent picks off a form.
    assert.equal(submitted.severity, 'S3');
    assert.equal(submitted.reporterId, 'guardian_2');
  });

  it('drops the reporter id on an anonymous tip, in the row and not just the UI', () => {
    const tip = incidentFromSubmission(
      {
        reporterRole: 'staff',
        anonymous: true,
        subjectLearnerId: 'learner_1',
        relatedSessionId: null,
        category: 'safety-concern',
        occurredAt: NOW.toISOString(),
        summary: 'Observed a pattern worth someone looking at.',
        immediateActionTaken: null,
        attachmentIds: [],
      },
      'staff_7',
      NOW,
    );
    assert.equal(tip.reporterId, null);
    assert.equal(tip.anonymous, true);
    assert.equal(tip.timeline[0]?.actor, 'anonymous');
  });

  it('keeps a tutor-behaviour report off the family’s screen at intake', () => {
    const report = incidentFromSubmission(
      {
        reporterRole: 'staff',
        anonymous: false,
        subjectLearnerId: 'learner_1',
        relatedSessionId: null,
        category: 'tutor-behavior',
        occurredAt: NOW.toISOString(),
        summary: 'Tutor used a tone I want reviewed.',
        immediateActionTaken: null,
        attachmentIds: [],
      },
      'staff_7',
      NOW,
    );
    assert.equal(report.guardianVisible, false);
  });

  it('marks each fan-out leg once — the natural key behind both safety queues', () => {
    /*
      `docs/design/jobs.md` §3 wants two idempotency mechanisms per queue and is
      explicit they are not interchangeable: the `singletonKey` stops a double
      ENQUEUE and stops protecting the moment the job COMPLETES; this is the
      other half, and it is what a dead-letter replay hours later runs into. A
      guardian alert without it is a queue that tells a parent their child is in
      crisis twice.
    */
    const filed = incidentFromSafetyEvent(crisis(), NOW);
    assert.ok(filed);
    assert.equal(filed.guardianNotifiedAt, null);
    assert.equal(filed.reviewPagedAt, null);

    const notified = markFannedOut(filed, 'guardian', 'in-app', NOW);
    assert.equal(notified.guardianNotifiedAt, NOW.toISOString());
    assert.equal(notified.timeline.length, filed.timeline.length + 1);

    // The replay. Same report, later clock, and nothing moves.
    const replayed = markFannedOut(notified, 'guardian', 'in-app', new Date(NOW.getTime() + 3_600_000));
    assert.equal(replayed, notified, 'a replayed guardian alert wrote a second time');

    // The two legs are independent — an S4 owes both.
    const paged = markFannedOut(notified, 'review', 'on-call', NOW);
    assert.equal(paged.reviewPagedAt, NOW.toISOString());
    assert.equal(paged.guardianNotifiedAt, NOW.toISOString());
    assert.equal(paged.timeline.length, filed.timeline.length + 2);
  });

  it('breaches an SLA only while somebody still owes an answer', () => {
    const report = incidentFromSafetyEvent(blocked(), NOW);
    assert.ok(report);
    const late = new Date(NOW.getTime() + 49 * 3_600_000);
    assert.equal(slaBreached(report, NOW), false);
    assert.equal(slaBreached(report, late), true);
    assert.equal(
      slaBreached(transitionIncident(report, { status: 'resolved' }, 'staff_7', NOW), late),
      false,
    );
  });
});
