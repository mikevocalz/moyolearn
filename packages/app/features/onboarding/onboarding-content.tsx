'use client';
// Onboarding & consent — one concept per screen, progressive disclosure.
//
// This is the front door: a parent, educator, or business owner reaches the
// right shell with a lawful, understood consent. The flow never asks a learner
// under 13 to create their own account; guardians own learner profiles (R9).
// SOT: docs/pack/04-screen-briefs.md §S14
// SOT-KEYWORDS: onboarding consent role three-store promise guardian educator business

import { useState } from 'react';
import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Heading, PressScale, Switch, FadeIn } from '@acme/ui';
import { Check } from '@acme/ui/icons';
import { useSessionStore } from '../../providers/session/store';
import { PERSONAS } from '../../fixtures/personas';
import { onboardingPath } from './flow/flow';

export function OnboardingContent() {
  const [step, setStep] = useState<'promise' | 'role' | 'consent'>('promise');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [consents, setConsents] = useState({
    terms: false,
    privacy: false,
    analytics: false,
  });
  const setPersona = useSessionStore((s) => s.setPersona);
  const router = useRouter();

  const selectedPersona = PERSONAS.find((p) => p.id === selectedPersonaId);

  const handleNext = () => {
    if (step === 'promise') {
      setStep('role');
    } else if (step === 'role') {
      setStep('consent');
    } else if (step === 'consent' && selectedPersona) {
      setPersona({
        id: selectedPersona.id,
        name: selectedPersona.name,
        kind: selectedPersona.kind,
        gradeBand: selectedPersona.gradeBand,
        memberships: selectedPersona.memberships,
      });
      // Consent is where the shared front door ends and doc 06 §5's per-profile
      // sequence begins. The role picked here is the whole routing decision —
      // the flow key IS the RoleKind, so there is no second table.
      router.push(onboardingPath(selectedPersona.kind));
    }
  };

  const canNext =
    (step === 'promise') ||
    (step === 'role' && selectedPersonaId !== null) ||
    (step === 'consent' && consents.terms && consents.privacy);

  return (
    <View className="gap-7">
      <FadeIn>
        <View className="rounded-card border-2 border-border bg-surface-sunken p-3">
          <View className="flex-row gap-element">
            <Dot active={step === 'promise'} label="Promise" />
            <Dot active={step === 'role'} label="Role" />
            <Dot active={step === 'consent'} label="Consent" />
          </View>
        </View>
      </FadeIn>

      {step === 'promise' ? (
        <FadeIn delay={80}>
          <Section className="gap-4">
            <Heading level={1} size="title">
              Welcome to Moyo
            </Heading>
            <TWText className="text-body text-text">
              We keep three things in separate boxes:
            </TWText>
            <View className="gap-stack">
              <PromiseItem
                title="Your child’s learning"
                body="Work they do, their model, and what their tutor needs to know."
              />
              <PromiseItem
                title="Your account"
                body="Who you are, your memberships, and how we reach you."
              />
              <PromiseItem
                title="Our service data"
                body="How the app runs; we never use a child’s work to train AI."
              />
            </View>
          </Section>
        </FadeIn>
      ) : step === 'role' ? (
        <FadeIn delay={80}>
          <Section className="gap-4">
            <Heading level={1} size="title">
              Who is using Moyo?
            </Heading>
            <TWText className="text-body text-text">
              Pick a starting role. You can switch hats later if your account is linked to more than one.
            </TWText>
            <View className="gap-element">
              {PERSONAS.map((persona) => (
                <PressScale
                  key={persona.id}
                  className={`w-full rounded-card border-2 p-4 ${
                    selectedPersonaId === persona.id
                      ? 'border-border bg-primary shadow-card'
                      : 'border-border bg-surface-raised'
                  }`}
                  outerClassName="w-full"
                  onPress={() => setSelectedPersonaId(persona.id)}
                  aria-label={persona.name}
                  aria-selected={selectedPersonaId === persona.id}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="gap-0.5">
                      <TWText
                        className={`text-base font-semibold ${
                          selectedPersonaId === persona.id ? 'text-on-primary' : 'text-text'
                        }`}
                      >
                        {persona.name}
                      </TWText>
                      <TWText
                        className={selectedPersonaId === persona.id ? 'text-on-primary/80' : 'text-text-muted'}
                      >
                        {persona.kind === 'learner'
                          ? `Learner · ${persona.gradeBand ?? 'child'}`
                          : persona.kind === 'guardian'
                            ? 'Parent or guardian'
                            : `${persona.kind.charAt(0).toUpperCase() + persona.kind.slice(1)}`}
                      </TWText>
                    </View>
                    {selectedPersonaId === persona.id ? (
                      <Check size={18} className="text-on-primary" />
                    ) : null}
                  </View>
                </PressScale>
              ))}
            </View>
          </Section>
        </FadeIn>
      ) : (
        <FadeIn delay={80}>
          <Section className="gap-4">
            <Heading level={1} size="title">
              Consent
            </Heading>
            <TWText className="text-body text-text">
              Learner profiles are owned by a guardian. We do not create independent accounts for children under 13.
            </TWText>
            <View className="gap-element">
              <Switch
                label="I agree to the Terms of Use"
                value={consents.terms}
                onChange={(terms) => setConsents((c) => ({ ...c, terms }))}
              />
              <Switch
                label="I agree to the Privacy Policy"
                value={consents.privacy}
                onChange={(privacy) => setConsents((c) => ({ ...c, privacy }))}
              />
              <Switch
                label="Send me product updates (optional)"
                value={consents.analytics}
                onChange={(analytics) => setConsents((c) => ({ ...c, analytics }))}
              />
            </View>
          </Section>
        </FadeIn>
      )}

      <FadeIn delay={160}>
        <View className="flex-row gap-element">
          {step !== 'promise' ? (
            <Button
              variant="outline"
              title="Back"
              onPress={() =>
                setStep((s) => (s === 'consent' ? 'role' : 'promise'))
              }
            />
          ) : null}
          <Button variant="primary" title={step === 'consent' ? 'Get started' : 'Continue'} onPress={handleNext} disabled={!canNext} />
        </View>
      </FadeIn>
    </View>
  );
}

function PromiseItem({ title, body }: { title: string; body: string }) {
  return (
    <View className="flex-row items-start gap-stack rounded-card border-2 border-border bg-surface-raised p-3">
      <View className="mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-grade">
        <Check size={14} className="text-on-grade" />
      </View>
      <View className="flex-1 gap-0.5">
        <TWText className="text-base font-semibold text-text">{title}</TWText>
        <TWText className="text-sm text-text-muted">{body}</TWText>
      </View>
    </View>
  );
}

function Dot({ active, label }: { active: boolean; label: string }) {
  return (
    <View className="flex-1 gap-1">
      <View
        className={`h-2 rounded-full ${active ? 'bg-primary' : 'bg-surface-sunken'}`}
      />
      <TWText className="text-center text-xs text-text-muted">{label}</TWText>
    </View>
  );
}
