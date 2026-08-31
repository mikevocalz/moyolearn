'use client';
// Dev-only persona switcher — a QA hatch, never production.
//
// This reproduces the old fixture persona picker so QA and design can still
// open any shell or onboarding flow without a real account. It is gated by
// `__DEV__` everywhere it is mounted, so it cannot ship.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: dev persona switch qa fixture onboarding role

import { useState } from 'react';
import { useRouter } from 'solito/navigation';
import { View, Text as TWText } from '@acme/ui/tw';
import { Button, Heading, PressScale } from '@acme/ui';
import { Check } from '@acme/ui/icons';
import { useSessionStore } from '../../providers/session/store';
import { PERSONAS } from '../../fixtures/personas';
import { onboardingPath } from './flow/flow';

export function DevPersonaSwitch() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const setPersona = useSessionStore((s) => s.setPersona);
  const router = useRouter();

  const selected = PERSONAS.find((p) => p.id === selectedId);

  const apply = () => {
    if (!selected) return;
    setPersona({
      id: selected.id,
      name: selected.name,
      kind: selected.kind,
      gradeBand: selected.gradeBand,
      memberships: selected.memberships,
    });
    router.push(onboardingPath(selected.kind));
  };

  return (
    <View className="gap-stack">
      <View className="gap-0.5">
        <Heading level={2} size="title" className="text-danger">
          Development only
        </Heading>
        <TWText className="text-body text-text">
          For QA and design review.
        </TWText>
      </View>
      <View className="gap-element">
        {PERSONAS.map((persona) => (
          <PressScale
            key={persona.id}
            className={`w-full rounded-card border-2 p-4 ${
              selectedId === persona.id
                ? 'border-border bg-primary shadow-card'
                : 'border-border bg-surface-raised'
            }`}
            outerClassName="w-full"
            onPress={() => setSelectedId(persona.id)}
            aria-label={persona.name}
            aria-selected={selectedId === persona.id}
          >
            <View className="flex-row items-center justify-between">
              <View className="gap-0.5">
                <TWText
                  className={`text-base font-semibold ${
                    selectedId === persona.id ? 'text-on-primary' : 'text-text'
                  }`}
                >
                  {persona.name}
                </TWText>
                <TWText
                  className={
                    selectedId === persona.id ? 'text-on-primary/80' : 'text-text-muted'
                  }
                >
                  {persona.kind === 'learner'
                    ? `Learner · ${persona.gradeBand ?? 'child'}`
                    : `${persona.kind.charAt(0).toUpperCase() + persona.kind.slice(1)}`}
                </TWText>
              </View>
              {selectedId === persona.id ? (
                <Check size={18} className="text-on-primary" />
              ) : null}
            </View>
          </PressScale>
        ))}
      </View>
      <Button
        title="Start as this persona"
        onPress={apply}
        disabled={!selected}
        fullWidth
      />
    </View>
  );
}
