'use client';
import { create } from 'zustand';
import type { AppSession, Membership, RoleKind } from './types';
import type { AgeBand } from '../../features/capture/age-band';
import { disposeAllBoardSessions } from '../../features/tutor/board-session.ts';

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
/*
  THE WHITEBOARD IS SCOPED TO WHOEVER THIS STORE SAYS IS HERE.

  `board-session` keeps one Yjs document per board so the tutor screen and the
  spatial screen share it, and that registry is module-level — it outlives every
  React tree on purpose, because the 2D tree unmounts before the XR tree mounts.
  Nothing inside those trees can therefore end it, and until this file did, a
  child's strokes stayed in memory for as long as the process lived. On a shared
  classroom device that is the next learner opening the board and finding the
  last one's working on it.

  So the three writers below are the three ends: a different person resolved
  (`setPersona`), the device handed to someone else (`setContext` — FD-24's
  `Who's here?` switch goes through exactly this call, which is why the switch
  itself needs no code), and the session resolving to nobody (`setLoading`,
  which is where a sign-out lands: both sign-out buttons call
  `authClient.signOut()` and the provider re-resolves through here, as does an
  expired cookie).

  NOT `family.store`'s `selectedLearnerId`. That is which child a GUARDIAN is
  reading a report about — a viewing scope on surfaces that hold no board — and
  disposing a learner's working because an adult changed tabs would be a
  different bug wearing this one's clothes.
*/
export const useSessionStore = create<SessionState>((set, get) => ({
  ...ANON,
  status: 'loading',
  setPersona: (persona) => {
    // Re-resolving the SAME person is what an ordinary re-render of the live
    // provider does; only a different id is a different child's board.
    const previous = get().user;
    if (previous !== null && previous.id !== persona.id) disposeAllBoardSessions();
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
    });
  },
  setContext: (context) => {
    /*
      Keyed on `learnerId` rather than on the context object, because this call
      also carries a plain role or scope change — a guardian moving between
      orgs is the same person and must keep their board. Leaving a learner
      context for a guardian one counts: `undefined` is not that child, and the
      child has stopped using the device.
    */
    if (context.learnerId !== get().activeContext.learnerId) disposeAllBoardSessions();
    set({ activeContext: context });
  },
  setLoading: (loading) => {
    /*
      The EDGE into `anon`, not every call: the live provider re-runs this on
      each render while nobody is signed in. The cold-boot edge (`loading` →
      `anon`, nobody was ever here) reaches the registry while it is empty, so
      it costs an empty loop and needs no second guard.
    */
    if (!loading && get().status !== 'anon') disposeAllBoardSessions();
    set({ status: loading ? 'loading' : 'anon' });
  },
}));
