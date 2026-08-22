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

export const useSessionStore = create<SessionState>((set) => ({
  ...ANON,
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
