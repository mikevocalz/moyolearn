// RoleSwitcher — dev-only persona switcher for the drawer header.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: role switcher dev persona mock session release bundle require

import { Button, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import type { Persona } from '../../fixtures/personas';
import { getAuthMode } from './auth-mode';
import { useSessionStore } from './store';

/**
 * The personas, or none outside a development build. Required behind a literal
 * `__DEV__` test so Metro drops the fixture module from a release bundle —
 * see `session.tsx` for why the test is spelled out rather than shared.
 */
function devPersonas(): readonly Persona[] {
  if (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PERSONAS } = require('../../fixtures/personas') as typeof import('../../fixtures/personas');
    return PERSONAS;
  }
  return [];
}

export function RoleSwitcher() {
  const setPersona = useSessionStore((s) => s.setPersona);
  const currentId = useSessionStore((s) => s.user?.id);

  if (getAuthMode() === 'live') return null;
  const personas = devPersonas();
  if (personas.length === 0) return null;

  return (
    <View className="gap-stack p-inset">
      <Text className="font-sans text-caption text-text-muted">Switch persona</Text>
      <View className="flex-row flex-wrap gap-element">
        {personas.map((persona) => (
          <Button
            key={persona.id}
            title={persona.name}
            variant={currentId === persona.id ? 'highlighter' : 'outline'}
            size="sm"
            onPress={() =>
              setPersona({
                id: persona.id,
                name: persona.name,
                kind: persona.kind,
                gradeBand: persona.gradeBand,
                memberships: persona.memberships,
              })
            }
          />
        ))}
      </View>
    </View>
  );
}
