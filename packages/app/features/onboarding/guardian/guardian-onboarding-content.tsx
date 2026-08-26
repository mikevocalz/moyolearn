'use client';
// S21 · Guardian onboarding — account → consent → children → grants.
// Doc 06 §5: cool structure, hot accents on the child cards. Consent is real
// text, not a checkbox with a link, because §5 requires it be screen-reader
// complete and readable at AA.
//
// Mobbin: https://mobbin.com/flows/fac935c1-143a-43e5-861e-b1e65aa6d3a5 (Garmin
// Connect, "Creating a child account" — DOB carries an explicit "once set, it
// cannot be changed", and permissions sit per-child rather than as one flat
// list) · https://mobbin.com/flows/24719932-c82c-4512-a140-d4421b8b7d78
// (GoHenry onboarding — persistent Exit on every step; "Add another child"
// above Continue) · https://mobbin.com/flows/cee1ecf7-1751-41bf-ac81-887efb909f3b
// (Kit onboarding — password rules validate live and per-rule, not one lump
// error after submit). Structure only; style stays on docs 02/08.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding guardian s21 consent children grants screen

import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, FadeIn, Heading, TextField } from '@acme/ui';
import { ConsentFlowContent } from '../consent/consent-flow-content';
import { PaywallContent } from '../../paywall/paywall-content';
import { useGuardianOnboarding } from './store';
import {
  canAdvance,
  childProblems as problems,
  consentRegime,
  nextStep,
  previousStep,
  stepProgress,
  CONSENT_POLICY_VERSION,
} from './steps';

export function GuardianOnboardingContent({ onExit }: { onExit: () => void }) {
  const { step, draft, setStep, patch, addChild, patchChild, removeChild } = useGuardianOnboarding();
  const { index, total } = stepProgress(step);
  const back = previousStep(step);
  const forward = nextStep(step);
  const ready = canAdvance(step, draft);

  return (
    <View className="gap-7">
      {/* H1 — where am I, how much is left. */}
      <FadeIn>
        <View className="flex-row items-center justify-between rounded-card border-2 border-border bg-surface-sunken p-3">
          <TWText className="text-caption text-text-muted">
            Step {index} of {total}
          </TWText>
          {/* H3 — a way out from every step, not only backwards one at a time. */}
          <Button variant="ghost" title="Save & exit" onPress={onExit} />
        </View>
      </FadeIn>

      {step === 'welcome' ? (
        <Section className="gap-4">
          <Heading level={1} size="title">
            Let’s set up your family
          </Heading>
          <TWText className="text-body text-text">
            Four short steps. You stay in control of every one of them, and you can go back at any
            point.
          </TWText>
        </Section>
      ) : null}

      {step === 'account' ? (
        <Section className="gap-4">
          <Heading level={1} size="title">
            Your account
          </Heading>
          <TextField
            label="Your email"
            hint="Yours, not your child’s. Children here never have an email address."
            value={draft.email}
            onChangeText={(email: string) => patch({ email })}
          />
        </Section>
      ) : null}

      {step === 'plan' ? (
        <PaywallContent
          onStartTrial={() => onExit()}
          onContinueFree={() => onExit()}
        />
      ) : null}

      {step === 'consent' ? (
        <Section className="gap-4">
          <Heading level={1} size="title">
            Your permission
          </Heading>
          {/* The notice and the verification are one flow now (doc 06 §3.1). A
              checkbox recorded that a guardian had READ this; it could not
              record that a guardian, rather than the child, agreed to it. */}
          <ConsentFlowContent
            scope="tutoring"
            policyVersion={CONSENT_POLICY_VERSION}
            onComplete={(record) =>
              patch({ consentRecord: record, consentMethod: record.method, consentAccepted: true })
            }
          />
        </Section>
      ) : null}

      {step === 'children' ? (
        <Section className="gap-4">
          <Heading level={1} size="title">
            Add your children
          </Heading>
          <TWText className="text-body text-text">
            You choose the username and password. Pick something that isn’t their real name.
          </TWText>
          {draft.children.map((child, i) => (
            <View
              key={i}
              className="gap-3 rounded-card border-2 border-highlighter bg-surface p-4"
            >
              {/* DOB first: it selects the consent regime, so asking it after the
                  credentials would let a guardian fill a form the answer invalidates. */}
              <TextField
                label="Date of birth"
                hint="YYYY-MM-DD. This sets which rules protect them, so it can’t be changed later."
                value={child.dob}
                onChangeText={(dob: string) => patchChild(i, { dob })}
                error={problems(child).dob}
              />
              {consentRegime(child.dob) !== 'unknown' ? (
                <TWText className="text-caption text-text-muted">
                  {consentRegime(child.dob) === 'under-13'
                    ? 'Under 13 — you hold consent and manage this account entirely.'
                    : '13 or older — they can sign in themselves, you still control permissions.'}
                </TWText>
              ) : null}
              <TextField
                label="What should the tutor call them?"
                value={child.displayName}
                onChangeText={(displayName: string) => patchChild(i, { displayName })}
                error={problems(child).displayName}
              />
              <TextField
                label="Username"
                hint="Not their full name, and never an email."
                value={child.username}
                onChangeText={(username: string) => patchChild(i, { username })}
                error={problems(child).username}
              />
              <TextField
                label="Password"
                hint="Twelve characters or more. Length beats symbols."
                value={child.password}
                onChangeText={(password: string) => patchChild(i, { password })}
                error={problems(child).password}
                secureTextEntry
              />
              {/* H3 — a wrongly added child is removable, not permanent. */}
              <Button variant="ghost" title="Remove" onPress={() => removeChild(i)} />
            </View>
          ))}
          <Button variant="outline" title="Add a child" onPress={addChild} />
        </Section>
      ) : null}

      {step === 'grants' ? (
        <Section className="gap-4">
          <Heading level={1} size="title">
            What the tutor can see
          </Heading>
          <TWText className="text-body text-text">
            You can change any of this later from the family screen.
          </TWText>
        </Section>
      ) : null}

      <View className="flex-row gap-3">
        {back ? (
          <Button variant="outline" title="Back" onPress={() => setStep(back)} />
        ) : null}
        {forward ? (
          <Button title="Continue" onPress={() => setStep(forward)} disabled={!ready} />
        ) : null}
      </View>
    </View>
  );
}
