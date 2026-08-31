// Session types — the screen-facing contract, independent of auth implementation.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: session app-session role kind active context mock live

import type { MembershipRole } from '@acme/auth/membership';
import type { AgeBand } from '../../features/capture/age-band';

export type RoleKind =
  | 'learner'
  | 'guardian'
  | 'tutor'
  | 'teacher'
  | 'owner'
  | 'staff'
  | 'school_admin'
  | 'district_admin';

export type ActiveContextKind = RoleKind | 'anon';

export interface ActiveContext {
  kind: ActiveContextKind;
  orgId?: string;
  learnerId?: string;
  gradeBand?: AgeBand;
}

export interface Membership {
  id: string;
  orgId: string;
  orgName: string;
  /** The person's education/application role — what shell they wear. */
  role: RoleKind;
  /** The organisation-level authority (owner, manager, scheduler, finance). */
  organizationRole?: MembershipRole;
}

export interface AppUser {
  id: string;
  name: string;
  kind: RoleKind;
}

export interface AppSession {
  user: AppUser | null;
  activeContext: ActiveContext;
  memberships: Membership[];
  status: 'loading' | 'authed' | 'anon';
}
