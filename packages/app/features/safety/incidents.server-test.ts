// Doc 31 §4.2's access model, held as a test.
//
// The rule this file exists for is one sentence — a guardian sees incidents
// about THEIR OWN learner where `guardianVisible` — and its failure mode is a
// parent reading a record of another family's child. So the test drives the
// projection with rows it was never supposed to be handed: another household's
// incident, a staff-workflow report, and a row that is both.
//
// It exercises the projection rather than the repository on purpose. The
// repository scopes with a `where`, this filters again, and the two fail in
// different ways — a `where` is lost by a refactor, a filter is lost by a
// deletion, and no single change removes both. This is the half that can be
// proved without a database.
//
// `.server-test.ts` because the service opens with `import 'server-only'`.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4.2 §5.2 §5.3
// SOT-KEYWORDS: incident access test guardian own learner guardian visible ward wall triage queue sla breach unassigned s4 assignee roster staff timeline
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  incidentFromSubmission,
  transitionIncident,
  type IncidentCategory,
  type IncidentReport,
} from '@acme/safety';
import type { Auth } from '@acme/auth/server';
import { MembershipDenied } from '../../core/membership-gate.ts';
import { setOperationSink } from '../../core/telemetry.ts';
import {
  guardianIncidentsFrom,
  incidentTriageQueue,
  submitTutorIncident,
  triageIncident,
  triageQueueFrom,
  tutorIncidentsFrom,
  CONVERSATION_STARTERS,
  TUTOR_REPORTABLE,
  type EngagedLearner,
  type IncidentStaffMember,
  type SubmitTutorIncidentInput,
} from './incidents.service.ts';

const NOW = new Date('2026-08-27T16:00:00.000Z');

/** The projection's viewer/roster arguments where neither matters to a test. */
const NOBODY = 'viewer_0';
const NO_STAFF: readonly IncidentStaffMember[] = [];

const report = (
  subjectLearnerId: string,
  category: IncidentCategory,
  reporterRole: 'guardian' | 'staff' = 'guardian',
): IncidentReport =>
  incidentFromSubmission(
    {
      reporterRole,
      anonymous: false,
      subjectLearnerId,
      relatedSessionId: 'sess_1',
      category,
      occurredAt: NOW.toISOString(),
      summary: 'Observed during a tutoring session.',
      immediateActionTaken: null,
      attachmentIds: [],
    },
    'guardian_2',
    NOW,
  );

describe('doc 31 §4.2 — the guardian access model', () => {
  it('shows a guardian their own learner’s incident', () => {
    const views = guardianIncidentsFrom([report('learner_1', 'bullying')], ['learner_1']);
    assert.equal(views.length, 1);
    assert.equal(views[0]?.learnerId, 'learner_1');
  });

  it('shows NOTHING about another household’s child, however the row arrived', () => {
    /*
      The row is well-formed, guardian-visible, and about somebody else. The only
      way it reaches this function is a repository query that was wrong, which is
      exactly the case the second filter exists for.
    */
    const views = guardianIncidentsFrom(
      [report('learner_1', 'bullying'), report('learner_99', 'bullying')],
      ['learner_1'],
    );
    assert.equal(views.length, 1);
    assert.equal(views[0]?.learnerId, 'learner_1');
  });

  it('shows nothing at all to a session with no wards — a learner’s own file is not theirs', () => {
    assert.deepEqual(guardianIncidentsFrom([report('learner_1', 'bullying')], []), []);
  });

  it('withholds a report that is not guardianVisible, even about their own learner', () => {
    // A tutor-behaviour report is an employment matter before it is a family
    // matter; putting it in front of a parent at intake decides that by accident.
    const staffReport = report('learner_1', 'tutor-behavior', 'staff');
    assert.equal(staffReport.guardianVisible, false);
    assert.deepEqual(guardianIncidentsFrom([staffReport], ['learner_1']), []);
  });

  it('renders §5.2’s four sections in order, and the excerpt as a LINK', () => {
    const view = guardianIncidentsFrom([report('learner_1', 'self-harm')], ['learner_1'])[0];
    assert.ok(view);
    assert.ok(view.whatHappened.length > 0);
    assert.ok(view.whatTheTutorDid.length > 0);
    assert.ok(view.whatHappensNext.includes('48'), 'the SLA is what "what happens next" says');
    assert.equal(view.talkAboutIt, CONVERSATION_STARTERS['self-harm']);
    assert.equal(view.sessionId, 'sess_1');
    // A link, never the words. The view has nowhere to put an excerpt's text.
    assert.equal(Object.hasOwn(view, 'transcript'), false);
    assert.equal(Object.hasOwn(view, 'excerpt'), false);
  });

  it('has a human-written conversation starter for every category', () => {
    for (const [category, line] of Object.entries(CONVERSATION_STARTERS)) {
      assert.ok(line.length > 0, `${category} has no conversation starter`);
    }
  });

  it('tells a parent it is closed once it is, instead of a clock that has run out', () => {
    const resolved = transitionIncident(
      report('learner_1', 'bullying'),
      { status: 'resolved', resolution: 'Spoke with both families.' },
      'staff_7',
      NOW,
    );
    const view = guardianIncidentsFrom([resolved], ['learner_1'])[0];
    assert.equal(view?.whatHappensNext, 'Spoke with both families.');
  });
});

describe('doc 36 §3.3 — the tutor reporter access model', () => {
  const filed = (reporterId: string, anonymous = false): IncidentReport =>
    incidentFromSubmission(
      {
        reporterRole: 'tutor',
        anonymous,
        subjectLearnerId: 'learner_1',
        relatedSessionId: 'sess_1',
        category: 'safety-concern',
        occurredAt: NOW.toISOString(),
        summary: 'Observed during a tutoring session.',
        immediateActionTaken: 'Paused the session.',
        attachmentIds: [],
      },
      reporterId,
      NOW,
    );

  it('shows a reporter the incident they filed, with its whole trail', () => {
    const views = tutorIncidentsFrom([filed('tutor_1')], 'tutor_1');
    assert.equal(views.length, 1);
    assert.equal(views[0]?.status, 'new');
    assert.equal(views[0]?.timeline.length, 1);
  });

  it('shows NOTHING filed by somebody else, however the row arrived', () => {
    const views = tutorIncidentsFrom([filed('tutor_1'), filed('tutor_99')], 'tutor_1');
    assert.equal(views.length, 1);
  });

  it('hides an anonymous filing from its own filer — the null is the promise', () => {
    assert.deepEqual(tutorIncidentsFrom([filed('tutor_1', true)], 'tutor_1'), []);
  });

  it('coarsens timeline actors and carries no severity or raw ids', () => {
    const moved = transitionIncident(filed('tutor_1'), { status: 'triaged' }, 'staff_7', NOW);
    const view = tutorIncidentsFrom([moved], 'tutor_1')[0];
    assert.ok(view);
    assert.deepEqual(
      view.timeline.map((line) => line.actor),
      ['you', 'moyo'],
      'a staff auth id must never reach a reporter’s screen',
    );
    assert.equal(Object.hasOwn(view, 'severity'), false);
  });
});

describe('ADR-108 — tutor intake verifies its subject against the engagement edge', () => {
  /*
    A tutor-shaped session at the free floor, faked at the same seams the
    staff fake below uses: the session read and the subscription read both go
    through the `Auth` instance, so the REAL `protectedOperation` runs — and
    `submitTutorIncident` sets no membership wall and no capability above
    `practise`, which every subscription status satisfies, including none.
    Empty adapter answers are therefore the honest fixture, not a shortcut.
  */
  const tutorAuth = (): Auth => {
    const value: object = {
      api: {
        getSession: () =>
          Promise.resolve({ user: { id: 'tutor_1', guardianManaged: false, orgId: 'org_1' } }),
      },
      $context: Promise.resolve({
        adapter: { findMany: () => Promise.resolve([]) },
      }),
    };
    return value as Auth;
  };

  const roster: readonly EngagedLearner[] = [
    { learnerId: 'learner_1', name: 'Ivy Ito' },
    { learnerId: 'learner_2', name: 'Noel Boateng' },
  ];

  const submission = (
    subjectLearnerId: string,
    category: SubmitTutorIncidentInput['category'] = 'safety-concern',
  ): SubmitTutorIncidentInput => ({
    anonymous: false,
    subjectLearnerId,
    relatedSessionId: 'sess_1',
    category,
    occurredAt: NOW.toISOString(),
    summary: 'Observed during a tutoring session.',
    immediateActionTaken: 'Paused the session.',
    attachmentIds: [],
  });

  const drive = async (input: SubmitTutorIncidentInput, engaged: readonly EngagedLearner[]) => {
    const saved: IncidentReport[] = [];
    let fannedOut = 0;
    setOperationSink(() => {});
    try {
      const result = await submitTutorIncident(
        tutorAuth(),
        new Headers(),
        input,
        {
          loadTutorEngagements: async () => engaged,
          saveIncident: async (report) => {
            saved.push(report);
          },
          fanOutIncident: async () => {
            fannedOut += 1;
          },
        },
        NOW,
      );
      return { result, saved, fannedOut };
    } finally {
      setOperationSink(null);
    }
  };

  it('refuses a subject the caller holds no active engagement with, and never writes', async () => {
    const { result, saved, fannedOut } = await drive(submission('learner_99'), roster);
    // The same null as a refused category — no oracle over which wall refused.
    assert.equal(result, null);
    assert.equal(saved.length, 0, 'a refused subject must not touch the store');
    assert.equal(fannedOut, 0);
  });

  it('refuses the legal-hold categories however the input arrived, and never writes', async () => {
    for (const category of ['self-harm', 'abuse-disclosure'] as const) {
      const { result, saved } = await drive(submission('learner_1', category), roster);
      assert.equal(result, null, `${category} must never be reporter-selectable`);
      assert.equal(saved.length, 0);
    }
    // The allow-list itself holds the exclusion, so the route's parse and this
    // check can only drift by editing the same constant.
    assert.ok(!TUTOR_REPORTABLE.includes('self-harm'));
    assert.ok(!TUTOR_REPORTABLE.includes('abuse-disclosure'));
  });

  it('accepts an engaged subject: tutor role, opens at S3, fans out after the save', async () => {
    const { result, saved, fannedOut } = await drive(submission('learner_1'), roster);
    assert.ok(result);
    assert.equal(saved.length, 1);
    assert.equal(fannedOut, 1);

    const report = saved[0];
    assert.ok(report);
    assert.equal(report.incidentId, result.incidentId);
    assert.equal(report.reporterRole, 'tutor');
    assert.equal(report.reporterId, 'tutor_1');
    assert.equal(report.subjectLearnerId, 'learner_1');
    // §5.1: severity is triage's judgment — every submission opens at S3.
    assert.equal(report.severity, 'S3');
    assert.equal(report.status, 'new');
  });

  it('drops the reporter id from an anonymous filing — the stored promise, at this door too', async () => {
    const { saved } = await drive({ ...submission('learner_1'), anonymous: true }, roster);
    assert.equal(saved[0]?.reporterId, null);
    assert.equal(saved[0]?.anonymous, true);
  });

  it('refuses everything when the caller has no engagements at all', async () => {
    const { result, saved } = await drive(submission('learner_1'), []);
    assert.equal(result, null);
    assert.equal(saved.length, 0);
  });
});

describe('doc 31 §5.3 — the triage queue', () => {
  it('sorts by deadline, and puts the rows that owe nothing last', () => {
    const soon = transitionIncident(report('learner_1', 'self-harm'), { severity: 'S4' }, 's', NOW);
    const later = report('learner_2', 'bullying');
    const noClock = transitionIncident(report('learner_3', 'profanity'), { severity: 'S1' }, 's', NOW);

    const queue = triageQueueFrom([noClock, later, soon], NOW, NOBODY, NO_STAFF);
    assert.deepEqual(
      queue.rows.map((row) => row.severity),
      ['S4', 'S3', 'S1'],
      'a row with no clock sorted above a two-hour S4',
    );
  });

  it('counts unassigned S4 — §5.3’s one thing allowed to interrupt', () => {
    const open = transitionIncident(report('learner_1', 'self-harm'), { severity: 'S4' }, 's', NOW);
    const assigned = transitionIncident(open, { assigneeId: 'staff_7' }, 'staff_7', NOW);
    const closed = transitionIncident(open, { status: 'closed' }, 'staff_7', NOW);

    assert.equal(triageQueueFrom([open], NOW, NOBODY, NO_STAFF).unassignedS4, 1);
    assert.equal(triageQueueFrom([assigned], NOW, NOBODY, NO_STAFF).unassignedS4, 0);
    assert.equal(triageQueueFrom([closed], NOW, NOBODY, NO_STAFF).unassignedS4, 0);
  });

  it('marks a breach only while somebody still owes an answer', () => {
    const late = new Date(NOW.getTime() + 49 * 3_600_000);
    const open = report('learner_1', 'bullying');
    assert.equal(triageQueueFrom([open], late, NOBODY, NO_STAFF).rows[0]?.breached, true);

    const done = transitionIncident(open, { status: 'resolved' }, 'staff_7', NOW);
    assert.equal(triageQueueFrom([done], late, NOBODY, NO_STAFF).rows[0]?.breached, false);
  });

  it('names the assignee off the roster, and answers "assigned to me" for the viewer', () => {
    const roster: readonly IncidentStaffMember[] = [
      { id: 'staff_7', name: 'Sam Vega', role: 'manager' },
    ];
    const assigned = transitionIncident(
      report('learner_1', 'bullying'),
      { assigneeId: 'staff_7' },
      'staff_7',
      NOW,
    );

    const theirs = triageQueueFrom([assigned], NOW, 'owner_1', roster).rows[0];
    assert.equal(theirs?.assigneeName, 'Sam Vega');
    assert.equal(theirs?.assignedToMe, false);

    const mine = triageQueueFrom([assigned], NOW, 'staff_7', roster).rows[0];
    assert.equal(mine?.assignedToMe, true);

    // An assignee the roster no longer holds keeps the boolean, drops the name.
    const departed = triageQueueFrom([assigned], NOW, 'owner_1', NO_STAFF).rows[0];
    assert.equal(departed?.assigned, true);
    assert.equal(departed?.assigneeName, null);
  });

  it('coarsens staff timeline actors to roles — no auth id reaches the queue', () => {
    const roster: readonly IncidentStaffMember[] = [
      { id: 'staff_7', name: 'Sam Vega', role: 'manager' },
    ];
    const moved = transitionIncident(
      report('learner_1', 'bullying'),
      { status: 'triaged' },
      'staff_7',
      NOW,
    );

    const row = triageQueueFrom([moved], NOW, 'owner_1', roster).rows[0];
    assert.ok(row);
    assert.deepEqual(
      row.timeline.map((line) => line.actor),
      // The filing guardian coarsens to the reporterRole the row stores; the
      // triaging manager to their roster role. Neither line carries an id.
      ['guardian', 'manager'],
    );

    const own = triageQueueFrom([moved], NOW, 'staff_7', roster).rows[0];
    assert.equal(own?.timeline[1]?.actor, 'you');
  });
});

describe('doc 31 §5.3 — the assignee is server truth, never a client claim', () => {
  /*
    A staff-shaped session, faked at the same seams production uses: the
    session read, the member-table role read and the subscription read all go
    through the `Auth` instance, so this one object drives the REAL
    `protectedOperation` — host step, membership wall, plan gate — without a
    database. `object as Auth` because the three touched paths are the ones
    production touches and `Auth`'s full surface is Better Auth's.
  */
  const staffAuth = (): Auth => {
    const value: object = {
      api: {
        getSession: () =>
          Promise.resolve({ user: { id: 'staff_7', guardianManaged: false, orgId: 'org_1' } }),
      },
      $context: Promise.resolve({
        adapter: {
          findMany: ({ model }: { model: string }) => {
            if (model === 'member') return Promise.resolve([{ role: 'manager' }]);
            if (model === 'subscription') {
              return Promise.resolve([
                { plan: 'ops-studio', status: 'active', referenceId: 'org_1', periodEnd: null },
              ]);
            }
            return Promise.resolve([]);
          },
        },
      }),
    };
    return value as Auth;
  };

  const roster: readonly IncidentStaffMember[] = [
    { id: 'staff_7', name: 'Sam Vega', role: 'manager' },
    { id: 'owner_1', name: 'Ada Okafor', role: 'owner' },
  ];

  it('refuses an assignee who is not current staff of the caller’s org, and never writes', async () => {
    setOperationSink(() => {});
    try {
      let saves = 0;
      const row = await triageIncident(
        staffAuth(),
        new Headers(),
        report('learner_1', 'bullying').incidentId,
        { assigneeId: 'intruder_9' },
        {
          loadIncidentQueue: async () => [],
          loadIncident: async () => report('learner_1', 'bullying'),
          loadIncidentStaff: async () => roster,
          saveIncident: async () => {
            saves += 1;
          },
          fanOutIncident: async () => {},
        },
        NOW,
      );
      // The same null as a swept record — no oracle over who is staff where.
      assert.equal(row, null);
      assert.equal(saves, 0, 'a refused assignment must not touch the record');
    } finally {
      setOperationSink(null);
    }
  });

  it('accepts an assignee picked from the roster — including the caller themselves', async () => {
    setOperationSink(() => {});
    try {
      let saves = 0;
      const row = await triageIncident(
        staffAuth(),
        new Headers(),
        report('learner_1', 'bullying').incidentId,
        { assigneeId: 'staff_7' },
        {
          loadIncidentQueue: async () => [],
          loadIncident: async () => report('learner_1', 'bullying'),
          loadIncidentStaff: async () => roster,
          saveIncident: async () => {
            saves += 1;
          },
          fanOutIncident: async () => {},
        },
        NOW,
      );
      assert.ok(row);
      assert.equal(saves, 1);
      assert.equal(row.assignedToMe, true, '"assign to me" is the caller picking themselves');
      assert.equal(row.assigneeName, 'Sam Vega');
    } finally {
      setOperationSink(null);
    }
  });
});

describe('doc 31 §5.3 — the queue is staff-only, and a paying family is not staff', () => {
  // Through the real service in mock mode: the dev mock carries an ACTIVE family
  // plan and an ACTIVE org plan, so `requires: 'write'` alone waves it through —
  // which is exactly the hole this describe holds shut. The mock identity is a
  // guardian-managed learner with no role in any org's member table, and that
  // absence, not its card, is what must refuse it.
  it('refuses the dev mock the triage queue and never reads a row', async () => {
    process.env.NEXT_PUBLIC_AUTH_MODE = 'mock';
    process.env.NODE_ENV = 'development';
    setOperationSink(() => {});
    try {
      let reads = 0;
      await assert.rejects(
        () =>
          incidentTriageQueue({} as Auth, new Headers(), {
            loadIncidentQueue: async () => {
              reads += 1;
              return [report('learner_1', 'bullying')];
            },
            loadIncidentStaff: async () => {
              reads += 1;
              return [];
            },
          }),
        MembershipDenied,
      );
      assert.equal(reads, 0, 'a refused caller must not cause a queue or roster read');
    } finally {
      delete process.env.NEXT_PUBLIC_AUTH_MODE;
      setOperationSink(null);
    }
  });
});
