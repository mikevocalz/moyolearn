// Conference Room feature public API.
// SOT: Conference Room brief
// SOT-KEYWORDS: conference feature barrel export types policy

export {
  admitStudent,
  admitParticipant,
  hasPresentGuardian,
  isConferenceExpired,
  isPresent,
  presentGuardiansFor,
  qualifyingGuardianships,
  safetyStateForStudent,
} from './conference.policy.ts';
export type {
  AdmitReason,
  AdmitResult,
  Conference,
  ConferenceId,
  ConferenceJoinGrant,
  ConferenceParticipant,
  ConferencePolicy,
  ConferenceRole,
  ConferenceState,
  GuardianshipSnapshot,
  ParticipantStatus,
  StudentSafetyState,
  UserAuthId,
} from './conference.types.ts';
