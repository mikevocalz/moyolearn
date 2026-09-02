'use client';
import { create } from 'zustand';
import type { AppSession, Membership, RoleKind } from './types';
import type { AgeBand } from '../../features/capture/age-band';

interface SessionState extends AppSession {
  setPersona: (persona: {
    id: string;
    name: string;
    kind: RoleKind;
    gradeBand?: AgeBand;
    memberships?: Membership[];
  }) => void;
  setContext: (context: AppSession['activeContext']) => void;
  setLoading: (loading: boolean) => void;
}

const ANON: AppSession = {
  user: null,
  activeContext: { kind: 'anon' },
  memberships: [],
  status: 'anon',
};

/*
  The store opens as `loading`, never `anon`.

  Both providers resolve the session from an effect, and React runs a CHILD's
  effect before its parent's — so a route guard mounted under SessionProvider
  read `anon` a full tick before the provider could write the session, and
  redirected every authed visitor to /login. `loading` is the honest opening
  state: nobody has checked yet. `anon` is now only ever a resolved answer
  (live: no session; the mock provider always resolves to a persona).
*/
export const useSessionStore = create<SessionState>((set) => ({
  ...ANON,
  status: 'loading',
  setPersona: (persona) =>
    set({
      user: { id: persona.id, name: persona.name, kind: persona.kind },
      activeContext: {
        kind: persona.kind,
        learnerId: persona.kind === 'learner' ? persona.id : undefined,
        gradeBand: persona.gradeBand,
        orgId: persona.memberships?.[0]?.orgId,
      },
      memberships: persona.memberships ?? [],
      status: 'authed',
    }),
  setContext: (context) => set({ activeContext: context }),
  setLoading: (loading) => set({ status: loading ? 'loading' : 'anon' }),
}));
