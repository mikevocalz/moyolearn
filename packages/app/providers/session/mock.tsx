'use client';
// MockSessionProvider — dev-only; boots the session from EXPO_PUBLIC_MOCK_PERSONA or defaults.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: mock session provider dev persona fixture

import { useEffect } from 'react';
import { useSessionStore } from './store';
import { PERSONAS } from '../../fixtures/personas';

/** Dev-only persona key; mock mode never runs in production. */
const PERSONA_KEY = 'moyo.mock-persona';

/*
  Order: `?persona=` wins, then the last one chosen in this browser, then the
  build's env var, then the first fixture.

  The query param exists because the env var is inlined at compile time — a
  dev server has to be restarted AND its cache cleared to change it — and the
  in-app RoleSwitcher only renders in the mobile drawer, so desktop QA had no
  way to reach a second role at all. Persisting the choice keeps it across the
  full page loads that a route change performs.
*/
function getInitialPersona() {
  const env =
    typeof process !== 'undefined'
      ? process.env.EXPO_PUBLIC_MOCK_PERSONA ?? process.env.NEXT_PUBLIC_MOCK_PERSONA
      : undefined;

  let requested: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      requested = new URLSearchParams(window.location.search).get('persona');
      if (requested) window.localStorage.setItem(PERSONA_KEY, requested);
      else requested = window.localStorage.getItem(PERSONA_KEY);
    } catch {
      // Private-mode storage denial is not worth failing a dev session over.
    }
  }

  return (
    PERSONAS.find((p) => p.id === requested) ??
    PERSONAS.find((p) => p.id === env) ??
    PERSONAS[0]!
  );
}

export function MockSessionProvider({ children }: { children: React.ReactNode }) {
  const setPersona = useSessionStore((s) => s.setPersona);

  useEffect(() => {
    const persona = getInitialPersona();
    setPersona({
      id: persona.id,
      name: persona.name,
      kind: persona.kind,
      gradeBand: persona.gradeBand,
      memberships: persona.memberships,
    });
  }, [setPersona]);

  return <>{children}</>;
}
