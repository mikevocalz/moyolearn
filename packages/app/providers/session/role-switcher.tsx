// RoleSwitcher — dev-only persona switcher for the drawer header.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: role switcher dev persona mock session

import { Button, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { PERSONAS } from '../../fixtures/personas';
import { useSessionStore } from './store';

export function RoleSwitcher() {
  const setPersona = useSessionStore((s) => s.setPersona);
  const currentId = useSessionStore((s) => s.user?.id);

  const isLive =
    process.env.EXPO_PUBLIC_AUTH_MODE === 'live' ||
    process.env.NEXT_PUBLIC_AUTH_MODE === 'live';
  if (isLive) return null;

  return (
    <View className="gap-stack p-inset">
      <Text className="font-sans text-caption text-text-muted">Switch persona</Text>
      <View className="flex-row flex-wrap gap-2">
        {PERSONAS.map((persona) => (
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
