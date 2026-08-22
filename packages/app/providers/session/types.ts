// Session types — the screen-facing contract, independent of auth implementation.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: session app-session role kind active context mock live

import type { AgeBand } from '../../features/capture/age-band';

export type RoleKind = 'learner' | 'guardian' | 'tutor' | 'teacher' | 'owner';

export type ActiveContextKind = 'anon' | 'learner' | 'guardian' | 'tutor' | 'teacher' | 'owner';

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
  role: RoleKind;
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
