// Conference Room domain model — the server-authoritative aggregate for
// education meetings. This file holds types only; policy decisions live in
// conference.policy.ts so they can be tested without a database.
// SOT: Conference Room brief §safeguarding · CLAUDE.md (The block)
// SOT-KEYWORDS: conference domain type participant policy guardian admit safety join grant

import type { MembershipRole } from '@acme/auth/membership';
import type { RoleKind } from '../../providers/session/types.ts';

export type ConferenceId = string;
export type UserAuthId = string;

export type ConferenceRole =
  | 'host'
  | 'coHost'
  | 'participant'
  | 'guest'
  | 'observer'
  | 'ai';

export type ConferenceState =
  | 'scheduled'
  | 'waiting'
  | 'active'
  | 'ending'
  | 'ended'
  | 'cancelled';

export type ParticipantStatus =
  | 'invited'
  | 'waiting'
  | 'admitted'
  | 'joined'
  | 'left'
  | 'removed'
  | 'denied';

export interface ConferencePolicy {
  /** Is this a meeting that will include one or more minor students? */
  kind: 'student' | 'adult';
  /** Are external guests permitted? */
  allowGuestInvites: boolean;
  /** Is the AI Tutor permitted to join? */
  allowAi: boolean;
  /** Is screen sharing permitted in this room? */
  allowScreenShare: boolean;
  /** Server-authoritative maximum length in minutes. */
  maxDurationMinutes: 30;
  /** Recording is off by default in this build. */
  recordingAllowed: false;
}

export interface Conference {
  id: ConferenceId;
  orgId: string;
  title: string;
  createdBy: UserAuthId;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart: Date | null;
  endedAt: Date | null;
  /** Hard expiration: `actualStart + maxDurationMinutes`. The server enforces it. */
  expiresAt: Date | null;
  state: ConferenceState;
  policy: ConferencePolicy;
}

export interface ConferenceParticipant {
  authId: UserAuthId;
  conferenceId: ConferenceId;
  displayName: string;
  conferenceRole: ConferenceRole;
  educationRole?: RoleKind;
  organizationRole?: MembershipRole;
  isLearner: boolean;
  isMinor: boolean;
  isGuest: boolean;
  isAi: boolean;
  invitedBy?: UserAuthId;
  status: ParticipantStatus;
  admittedAt: Date | null;
  joinedAt: Date | null;
  leftAt: Date | null;
}

export interface GuardianshipSnapshot {
  guardianAuthId: UserAuthId;
  learnerAuthId: UserAuthId;
  relationship: 'guardian' | 'parent' | 'carer' | 'teacher' | 'tutor' | 'staff' | 'other';
  status: 'active' | 'invited' | 'revoked';
}

export interface ConferenceJoinGrant {
  conferenceId: ConferenceId;
  /** The participant this grant is for. */
  authId: UserAuthId;
  /** Who issued the grant. */
  issuedBy: UserAuthId;
  /** When the grant expires. */
  expiresAt: Date;
  /** Whether the holder is currently allowed to connect to the media plane. */
  admitted: boolean;
}

export type AdmitReason =
  | 'guardianRequired'
  | 'notInvited'
  | 'notAuthorized'
  | 'orgScope'
  | 'expired'
  | 'aiNotAllowed';

export type AdmitResult =
  | { readonly kind: 'admit' }
  | { readonly kind: 'wait'; readonly reason: AdmitReason }
  | { readonly kind: 'deny'; readonly reason: AdmitReason };

export type StudentSafetyState =
  | { readonly kind: 'admit' }
  | { readonly kind: 'hold'; readonly reason: 'guardianRequired' }
  | { readonly kind: 'remove'; readonly reason: 'guardianTimeout' };
