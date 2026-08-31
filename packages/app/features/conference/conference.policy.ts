// Conference Room policy — pure, server-authoritative decisions.
//
// These functions answer the safety questions: who may be admitted, who counts
// as a qualifying guardian, and what happens when a guardian disconnects.
// The inputs are the Conference aggregate, its current participants, and the
// canonical guardianship records; the caller (the service) is responsible for
// loading those records and for never trusting client-supplied role strings.
// SOT: Conference Room brief §safeguarding · docs/pack/06-auth-onboarding-spec.md §2
// SOT-KEYWORDS: conference policy guardian admit safety student join hold remove

import type {
  Conference,
  ConferenceParticipant,
  ConferenceRole,
  GuardianshipSnapshot,
  AdmitResult,
  StudentSafetyState,
  UserAuthId,
} from './conference.types.ts';

const PRESENT_STATUSES: readonly ParticipantStatus[] = ['admitted', 'joined'];
const QUALIFYING_GUARDIAN_RELATIONSHIPS: readonly GuardianshipSnapshot['relationship'][] = [
  'guardian',
  'parent',
  'carer',
];

type ParticipantStatus = ConferenceParticipant['status'];

export function isPresent(participant: ConferenceParticipant): boolean {
  return PRESENT_STATUSES.includes(participant.status);
}

export function isConferenceExpired(conference: Conference, now: Date): boolean {
  return conference.expiresAt !== null && now.getTime() >= conference.expiresAt.getTime();
}

export function qualifyingGuardianships(
  studentAuthId: UserAuthId,
  guardianships: readonly GuardianshipSnapshot[],
): readonly GuardianshipSnapshot[] {
  return guardianships.filter(
    (g) =>
      g.learnerAuthId === studentAuthId &&
      g.status === 'active' &&
      QUALIFYING_GUARDIAN_RELATIONSHIPS.includes(g.relationship),
  );
}

export function presentGuardiansFor(
  student: ConferenceParticipant,
  participants: readonly ConferenceParticipant[],
  guardianships: readonly GuardianshipSnapshot[],
): readonly ConferenceParticipant[] {
  const qualifying = new Set(
    qualifyingGuardianships(student.authId, guardianships).map((g) => g.guardianAuthId),
  );
  return participants.filter(
    (p) =>
      !p.isAi &&
      !p.isGuest &&
      isPresent(p) &&
      qualifying.has(p.authId),
  );
}

export function hasPresentGuardian(
  student: ConferenceParticipant,
  participants: readonly ConferenceParticipant[],
  guardianships: readonly GuardianshipSnapshot[],
): boolean {
  return presentGuardiansFor(student, participants, guardianships).length > 0;
}

export function admitStudent(
  student: ConferenceParticipant,
  participants: readonly ConferenceParticipant[],
  guardianships: readonly GuardianshipSnapshot[],
): AdmitResult {
  if (!student.isLearner || !student.isMinor) {
    return { kind: 'admit' };
  }
  if (hasPresentGuardian(student, participants, guardianships)) {
    return { kind: 'admit' };
  }
  return { kind: 'wait', reason: 'guardianRequired' };
}

export function safetyStateForStudent(
  student: ConferenceParticipant,
  participants: readonly ConferenceParticipant[],
  guardianships: readonly GuardianshipSnapshot[],
  now: Date,
  graceUntil: Date | null,
): StudentSafetyState {
  if (!student.isLearner || !student.isMinor) {
    return { kind: 'admit' };
  }
  if (hasPresentGuardian(student, participants, guardianships)) {
    return { kind: 'admit' };
  }
  if (graceUntil !== null && now.getTime() < graceUntil.getTime()) {
    return { kind: 'hold', reason: 'guardianRequired' };
  }
  return { kind: 'remove', reason: 'guardianTimeout' };
}

export function canAdmitByRole(role: ConferenceRole): boolean {
  return role !== 'guest' && role !== 'observer' && role !== 'ai';
}

export function admitParticipant(
  participant: ConferenceParticipant,
  conference: Conference,
  participants: readonly ConferenceParticipant[],
  guardianships: readonly GuardianshipSnapshot[],
): AdmitResult {
  if (isConferenceExpired(conference, new Date())) {
    return { kind: 'deny', reason: 'expired' };
  }

  if (participant.isAi) {
    return conference.policy.allowAi
      ? { kind: 'admit' }
      : { kind: 'deny', reason: 'aiNotAllowed' };
  }

  if (participant.isGuest) {
    if (!conference.policy.allowGuestInvites || participant.invitedBy === undefined) {
      return { kind: 'deny', reason: 'notInvited' };
    }
    return { kind: 'admit' };
  }

  if (participant.conferenceRole === 'observer') {
    return { kind: 'admit' };
  }

  if (!canAdmitByRole(participant.conferenceRole)) {
    return { kind: 'deny', reason: 'notAuthorized' };
  }

  if (participant.isLearner && participant.isMinor) {
    return admitStudent(participant, participants, guardianships);
  }

  return { kind: 'admit' };
}
