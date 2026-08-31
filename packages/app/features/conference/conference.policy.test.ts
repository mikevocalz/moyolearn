// Conference Room policy tests — the hard safeguarding rules from the brief.
// SOT: Conference Room brief §safeguarding · §testing
// SOT-KEYWORDS: conference policy guardian student admit safety test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { admitStudent, admitParticipant, hasPresentGuardian, safetyStateForStudent } from './conference.policy.ts';
import type { Conference, ConferenceParticipant, GuardianshipSnapshot, UserAuthId } from './conference.types.ts';

const BASE_CONFERENCE = (overrides?: Partial<Conference>): Conference => {
  const actualStart = new Date();
  return {
    id: 'conf-1',
    orgId: 'lincoln',
    title: 'Parent-teacher conference',
    createdBy: 'teacher-1',
    scheduledStart: actualStart,
    scheduledEnd: new Date(actualStart.getTime() + 30 * 60 * 1000),
    actualStart,
    endedAt: null,
    expiresAt: new Date(actualStart.getTime() + 30 * 60 * 1000),
    state: 'active',
    policy: {
      kind: 'student' as const,
      allowGuestInvites: false,
      allowAi: true,
      allowScreenShare: true,
      maxDurationMinutes: 30,
      recordingAllowed: false,
    },
    ...overrides,
  };
};

const adult = (id: string, role: ConferenceParticipant['conferenceRole'] = 'participant'): ConferenceParticipant => ({
  authId: id,
  conferenceId: 'conf-1',
  displayName: id,
  conferenceRole: role,
  educationRole: 'teacher',
  isLearner: false,
  isMinor: false,
  isGuest: false,
  isAi: false,
  status: 'joined',
  admittedAt: new Date('2025-01-15T09:00:00Z'),
  joinedAt: new Date('2025-01-15T09:00:00Z'),
  leftAt: null,
});

const student = (id: string, withGuardian?: UserAuthId): ConferenceParticipant => ({
  authId: id,
  conferenceId: 'conf-1',
  displayName: id,
  conferenceRole: 'participant',
  educationRole: 'learner',
  isLearner: true,
  isMinor: true,
  isGuest: false,
  isAi: false,
  status: withGuardian ? 'joined' : 'waiting',
  admittedAt: new Date('2025-01-15T09:00:00Z'),
  joinedAt: withGuardian ? new Date('2025-01-15T09:00:00Z') : null,
  leftAt: null,
});

const guardian = (id: string, of: string): GuardianshipSnapshot => ({
  guardianAuthId: id,
  learnerAuthId: of,
  relationship: 'guardian',
  status: 'active',
});

describe('conference guardian policy', () => {
  it('lets a student join when a qualifying guardian is present', () => {
    const s = student('student-1', 'guardian-1');
    const g = adult('guardian-1');
    const result = admitStudent(s, [s, g], [guardian('guardian-1', 'student-1')]);
    assert.equal(result.kind, 'admit');
  });

  it('waits when no qualifying guardian is present', () => {
    const s = student('student-1');
    const result = admitStudent(s, [s], [guardian('guardian-1', 'student-1')]);
    assert.equal(result.kind, 'wait');
    assert.equal(result.kind === 'wait' && result.reason, 'guardianRequired');
  });

  it('does not admit a student when an unrelated parent is present', () => {
    const s = student('student-1');
    const unrelated = adult('parent-of-other');
    const result = admitStudent(s, [s, unrelated], [
      guardian('guardian-1', 'student-1'),
      guardian('parent-of-other', 'other-student'),
    ]);
    assert.equal(result.kind, 'wait');
  });

  it('does not count a guardian from another student as qualifying', () => {
    const s = student('student-1');
    const otherGuardian = adult('guardian-of-other');
    const result = admitStudent(s, [s, otherGuardian], [
      guardian('guardian-of-other', 'other-student'),
    ]);
    assert.equal(result.kind, 'wait');
  });

  it('does not count the AI Tutor as a qualifying guardian', () => {
    const s = student('student-1');
    const ai: ConferenceParticipant = {
      ...adult('ai-tutor'),
      isAi: true,
      conferenceRole: 'ai',
      isLearner: false,
      isMinor: false,
    };
    const result = admitStudent(s, [s, ai], [guardian('ai-tutor', 'student-1')]);
    assert.equal(result.kind, 'wait');
  });

  it('does not count a teacher as a guardian unless policy explicitly authorizes it', () => {
    const s = student('student-1');
    const teacher = adult('teacher-1');
    const result = admitStudent(s, [s, teacher], [
      { guardianAuthId: 'teacher-1', learnerAuthId: 'student-1', relationship: 'teacher', status: 'active' },
    ]);
    assert.equal(result.kind, 'wait');
  });

  it('keeps a student active when one guardian disconnects but a second remains', () => {
    const s = student('student-1');
    const g1 = adult('guardian-1');
    const g2 = adult('guardian-2');
    g1.status = 'left';
    const result = safetyStateForStudent(
      s,
      [s, g1, g2],
      [guardian('guardian-1', 'student-1'), guardian('guardian-2', 'student-1')],
      new Date('2025-01-15T09:05:00Z'),
      new Date('2025-01-15T09:10:00Z'),
    );
    assert.equal(result.kind, 'admit');
  });

  it('moves a student into hold when the last guardian disconnects', () => {
    const s = student('student-1');
    const g = adult('guardian-1');
    g.status = 'left';
    const result = safetyStateForStudent(
      s,
      [s, g],
      [guardian('guardian-1', 'student-1')],
      new Date('2025-01-15T09:05:00Z'),
      new Date('2025-01-15T09:10:00Z'),
    );
    assert.equal(result.kind, 'hold');
  });

  it('removes a student when the guardian grace period expires', () => {
    const s = student('student-1');
    const g = adult('guardian-1');
    g.status = 'left';
    const result = safetyStateForStudent(
      s,
      [s, g],
      [guardian('guardian-1', 'student-1')],
      new Date('2025-01-15T09:11:00Z'),
      new Date('2025-01-15T09:10:00Z'),
    );
    assert.equal(result.kind, 'remove');
  });

  it('restores admission when a guardian reconnects', () => {
    const s = student('student-1');
    const g = adult('guardian-1');
    const result = safetyStateForStudent(
      s,
      [s, g],
      [guardian('guardian-1', 'student-1')],
      new Date('2025-01-15T09:06:00Z'),
      new Date('2025-01-15T09:10:00Z'),
    );
    assert.equal(result.kind, 'admit');
  });

  it('denies a student when the conference has expired', () => {
    const s = student('student-1', 'guardian-1');
    const g = adult('guardian-1');
    const conference = BASE_CONFERENCE();
    const result = admitParticipant(s, conference, [s, g], [guardian('guardian-1', 'student-1')]);
    assert.equal(result.kind, 'admit');

    const expired = BASE_CONFERENCE({
      expiresAt: new Date(Date.now() - 1),
    });
    const expiredResult = admitParticipant(s, expired, [s, g], [guardian('guardian-1', 'student-1')]);
    assert.equal(expiredResult.kind, 'deny');
    assert.equal(expiredResult.kind === 'deny' && expiredResult.reason, 'expired');
  });
});

describe('conference participant admission', () => {
  it('admits a host or co-host immediately', () => {
    const conference = BASE_CONFERENCE();
    const h = adult('teacher-1', 'host');
    assert.equal(admitParticipant(h, conference, [h], []).kind, 'admit');
  });

  it('admits an adult-only conference with no students', () => {
    const conference = BASE_CONFERENCE({
      policy: {
        ...BASE_CONFERENCE().policy,
        kind: 'adult' as const,
      },
    });
    const t1 = adult('teacher-1');
    const t2 = adult('principal-1');
    assert.equal(admitParticipant(t2, conference, [t1, t2], []).kind, 'admit');
  });

  it('denies an uninvited guest', () => {
    const conference = BASE_CONFERENCE({
      policy: { ...BASE_CONFERENCE().policy, allowGuestInvites: false },
    });
    const guest: ConferenceParticipant = {
      ...adult('guest-1'),
      isGuest: true,
      conferenceRole: 'guest',
      invitedBy: undefined,
    };
    assert.equal(admitParticipant(guest, conference, [guest], []).kind, 'deny');
  });

  it('admits an invited guest when guest invites are allowed', () => {
    const conference = BASE_CONFERENCE({
      policy: { ...BASE_CONFERENCE().policy, allowGuestInvites: true },
    });
    const guest: ConferenceParticipant = {
      ...adult('guest-1'),
      isGuest: true,
      conferenceRole: 'guest',
      invitedBy: 'teacher-1',
    };
    assert.equal(admitParticipant(guest, conference, [guest], []).kind, 'admit');
  });

  it('admits the AI Tutor when allowed', () => {
    const conference = BASE_CONFERENCE({
      policy: { ...BASE_CONFERENCE().policy, allowAi: true },
    });
    const ai: ConferenceParticipant = {
      ...adult('ai-tutor'),
      isAi: true,
      conferenceRole: 'ai',
    };
    assert.equal(admitParticipant(ai, conference, [ai], []).kind, 'admit');
  });

  it('denies the AI Tutor when not allowed', () => {
    const conference = BASE_CONFERENCE({
      policy: { ...BASE_CONFERENCE().policy, allowAi: false },
    });
    const ai: ConferenceParticipant = {
      ...adult('ai-tutor'),
      isAi: true,
      conferenceRole: 'ai',
    };
    const result = admitParticipant(ai, conference, [ai], []);
    assert.equal(result.kind, 'deny');
    assert.equal(result.kind === 'deny' && result.reason, 'aiNotAllowed');
  });
});
