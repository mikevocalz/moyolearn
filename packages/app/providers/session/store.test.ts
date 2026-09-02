// The session store's opening state is `loading`, not `anon`.
// A guard that reads `anon` redirects to /login; because React runs a child's
// effect before its parent's, an `anon` opening state bounced every authed
// visitor before the provider could write the session.
// SOT: packages/app/providers/session/store.ts
// SOT-KEYWORDS: session store initial loading anon guard redirect flash test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useSessionStore } from './store.ts';

describe('session store', () => {
  it('opens as loading so no guard can read a premature anon', () => {
    assert.equal(useSessionStore.getState().status, 'loading');
    assert.equal(useSessionStore.getState().user, null);
  });

  it('resolves to anon only when a provider says so', () => {
    useSessionStore.getState().setLoading(false);
    assert.equal(useSessionStore.getState().status, 'anon');
  });

  it('resolves to authed with a learner context', () => {
    useSessionStore.getState().setPersona({
      id: 'maya',
      name: 'Maya',
      kind: 'learner',
      gradeBand: 'young',
    });
    const s = useSessionStore.getState();
    assert.equal(s.status, 'authed');
    assert.equal(s.activeContext.kind, 'learner');
    assert.equal(s.activeContext.learnerId, 'maya');
  });
});
