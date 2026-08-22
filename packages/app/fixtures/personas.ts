// Persona fixtures — dev and test identities, one per role shell.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: persona fixtures mock session learner guardian tutor teacher owner

import type { AgeBand } from '../features/capture/age-band';
import type { ActiveContext, AppUser, Membership, RoleKind } from '../providers/session/types';

export interface Persona {
  id: string;
  name: string;
  kind: RoleKind;
  gradeBand?: AgeBand;
  memberships: Membership[];
}

export const PERSONAS: Persona[] = [
  {
    id: 'maya',
    name: 'Maya',
    kind: 'learner',
    gradeBand: 'young',
    memberships: [],
  },
  {
    id: 'jordan',
    name: 'Jordan',
    kind: 'learner',
    gradeBand: 'child',
    memberships: [],
  },
  {
    // Dana wears two hats — the S15 switcher only proves itself against a
    // persona with more than one membership.
    id: 'dana',
    name: 'Dana',
    kind: 'guardian',
    memberships: [
      { id: 'm1', orgId: 'home', orgName: "Maya's parent", role: 'guardian' },
      { id: 'm1b', orgId: 'brightpath', orgName: 'Brightpath Tutoring', role: 'tutor' },
    ],
  },
  {
    id: 'james',
    name: 'James',
    kind: 'tutor',
    memberships: [
      { id: 'm2', orgId: 'tutoring', orgName: 'Moyo Tutoring', role: 'tutor' },
    ],
  },
  {
    id: 'rivera',
    name: 'Ms. Rivera',
    kind: 'teacher',
    memberships: [
      { id: 'm3', orgId: 'lincoln', orgName: 'Lincoln Elementary', role: 'teacher' },
    ],
  },
  {
    id: 'priya',
    name: 'Priya',
    kind: 'owner',
    memberships: [
      { id: 'm4', orgId: 'main', orgName: 'Moyo Main St', role: 'owner' },
      { id: 'm5', orgId: 'uptown', orgName: 'Moyo Uptown', role: 'owner' },
    ],
  },
];

export function appUserFromPersona(persona: Persona): ActiveContext {
  return {
    kind: persona.kind,
    learnerId: persona.kind === 'learner' ? persona.id : undefined,
    gradeBand: persona.gradeBand,
  };
}

export function appUserFromPersonaUser(persona: Persona): AppUser {
  return {
    id: persona.id,
    name: persona.name,
    kind: persona.kind,
  };
}
