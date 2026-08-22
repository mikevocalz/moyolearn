// MockSessionProvider — dev-only; boots the session from EXPO_PUBLIC_MOCK_PERSONA or defaults.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: mock session provider dev persona fixture

import { useEffect } from 'react';
import { useSessionStore } from './store';
import { PERSONAS } from '../../fixtures/personas';

function getInitialPersona() {
  const env =
    typeof process !== 'undefined'
      ? process.env.EXPO_PUBLIC_MOCK_PERSONA ?? process.env.NEXT_PUBLIC_MOCK_PERSONA
      : undefined;
  return PERSONAS.find((p) => p.id === env) ?? PERSONAS[0]!;
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
