'use client';
// S23 · Tutor onboarding — account → profile → availability → connect → a look at
// what the AI will hand them before every session. Cool dial: this is a
// professional's working surface, not a learner one.
//
// Mobbin: https://mobbin.com/flows/6abfd825-cf44-4f09-a7ea-2644aed11cf7 (Upwork
// profile builder — an intro that states the time cost and "you can edit it
// later", a 1-to-3 specialty cap under an opened category, and a forward button
// labelled with WHERE it goes: "Add skills", "Write an overview") ·
// https://mobbin.com/flows/413f781a-6971-415a-a03a-3382b740d589 (Angi onboarding —
// a persistent "Not now" on the steps that really are optional, so skipping is a
// visible choice rather than a guess) · https://mobbin.com/flows/ea4b5dc8-8cbc-4765-b93d-f3bb8e0c2b29
// (Jobber — one topic per step, never more than two fields on a screen) ·
// https://mobbin.com/flows/93cebe6f-786f-412f-99b1-ca941bd2119d (Airtasker — the
// profile step asks name, place and intent together, because they are one thought).
// Structure only; style stays on docs 02/08.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding tutor s23 profile subjects credentials availability connect preview

import { Section, View, Text as TWText } from '@acme/ui/tw';
import {
  Badge,
  Button,
  Card,
  Dial,
  FadeIn,
  Heading,
  MasteryBar,
  PressScale,
  Text,
  TextField,
} from '@acme/ui';
// The universal document picker already exists in the editor feature; a second
// one here is exactly the duplicate the pattern rule forbids.
import { pickFile } from '../../editor/pick-file';
import { SESSION_PREP } from '../../session-prep/session-prep.data';
import { useTutorOnboarding } from './store';
import {
  canAdvance,
  nextStep,
  previousStep,
  slot as slotId,
  stepProgress,
  summariseSlots,
  BLOCKS,
  DAYS,
  MAX_TEACHABLE,
  OPTIONAL_STEPS,
  STEP_DESTINATION,
  TEACHABLE_SUBJECTS,
} from './steps';

export function TutorOnboardingContent({ onExit }: { onExit: () => void }) {
  const { step, draft, setStep, patch, toggleSubject, toggleSlot, addCredential, removeCredential } =
    useTutorOnboarding();
  const { index, total } = stepProgress(step);
  const back = previousStep(step);
  const forward = nextStep(step);
  const ready = canAdvance(step, draft);
  const optional = OPTIONAL_STEPS[step];

  const advance = () => (forward ? setStep(forward) : onExit());

  return (
    <Dial temperature="cool">
      <View className="gap-group">
        <FadeIn>
          <View className="flex-row items-center justify-between rounded-card border-2 border-border bg-surface-sunken p-inset-tight">
            <Text variant="label" tone="muted">
              Step {index} of {total}
            </Text>
            <View className="flex-row items-center gap-element">
              {/* Angi: skipping is a labelled choice on the steps where it is one. */}
              {optional ? <Button variant="ghost" size="sm" title="Not now" onPress={advance} /> : null}
              {/* H3, and consistency with S21 (H4): a way out of every step, not
                  only backwards one at a time. GoHenry keeps it on all of them. */}
              <Button variant="ghost" size="sm" title="Save & exit" onPress={onExit} />
            </View>
          </View>
        </FadeIn>

        {step === 'account' ? (
          <Section className="gap-stack">
            <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text md:text-3xl">
              Set up your tutoring profile
            </Heading>
            {/* Upwork states the time cost and the reversibility up front. Both are
                true here and both are what stops a tutor bailing on step two. */}
            <TWText className="text-body text-text">
              About five minutes: who you teach, when you&apos;re free, and who you teach with. You
              can change all of it later.
            </TWText>
            <Button
              title="Continue with Google"
              onPress={() => patch({ google: true })}
              variant={draft.google ? 'outline' : 'primary'}
            />
            <Text variant="label" tone="muted">
              or use your email
            </Text>
            <TextField
              label="Email"
              value={draft.email}
              onChangeText={(email: string) => patch({ email, google: false })}
            />
          </Section>
        ) : null}

        {step === 'profile' ? (
          <Section className="gap-group">
            <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text">
              Your profile
            </Heading>
            <TextField
              label="Name families will see"
              value={draft.displayName}
              onChangeText={(displayName: string) => patch({ displayName })}
            />
            <TextField
              label="One line about your teaching"
              hint="Optional. Families read this before they book."
              value={draft.headline}
              onChangeText={(headline: string) => patch({ headline })}
            />

            <View className="gap-stack">
              <Text variant="label" tone="muted">
                What you teach — pick up to {MAX_TEACHABLE}
              </Text>
              <View className="flex-row flex-wrap gap-element">
                {TEACHABLE_SUBJECTS.map((subject) => {
                  const picked = draft.subjects.includes(subject.id);
                  const full = draft.subjects.length >= MAX_TEACHABLE && !picked;
                  return (
                    <PressScale
                      key={subject.id}
                      onPress={() => toggleSubject(subject.id)}
                      aria-disabled={full}
                      accessibilityState={{ selected: picked, disabled: full }}
                      className={[
                        'min-h-target-adult justify-center rounded-card border-2 px-4',
                        picked ? 'border-strong bg-highlighter' : 'border-border bg-surface-raised',
                        // Muted fill, not opacity — see Button.tsx's header and
                        // the same fix in S22's grid.
                        full ? 'border-border bg-surface-sunken' : '',
                      ].join(' ')}
                    >
                      <TWText className={full ? 'text-body text-text-muted' : 'text-body text-text'}>
                        {subject.label}
                      </TWText>
                    </PressScale>
                  );
                })}
              </View>
            </View>

            <View className="gap-stack">
              <Text variant="label" tone="muted">
                Credentials
              </Text>
              {/* Not a gate. Doc 05 §5 verifies on a review path, so the honest
                  framing is what the upload buys, not what it blocks. */}
              <TWText className="text-body text-text">
                Optional now. Families see a verified badge once we&apos;ve checked them.
              </TWText>
              {draft.credentials.map((file, i) => (
                <View
                  key={file.uri}
                  className="min-h-target-adult flex-row items-center justify-between rounded-card border-2 border-border bg-surface-raised px-4"
                >
                  <TWText className="flex-1 text-body text-text">{file.name}</TWText>
                  <Button variant="ghost" size="sm" title="Remove" onPress={() => removeCredential(i)} />
                </View>
              ))}
              <Button
                variant="outline"
                title="Add a document"
                onPress={() => {
                  void pickFile().then((file) => file && addCredential(file));
                }}
              />
            </View>
          </Section>
        ) : null}

        {step === 'availability' ? (
          <Section className="gap-group">
            <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text">
              When are you free?
            </Heading>
            {/* Seeded, not empty: after-school on weekdays is the real answer for
                most tutors, so this starts as something to correct. */}
            <TWText className="text-body text-text">
              We&apos;ve started you on weekday afternoons and evenings. Tap to change any of it.
            </TWText>
            <View className="gap-element">
              {DAYS.map((day) => (
                <View key={day} className="flex-row items-center gap-element">
                  <TWText className="w-12 text-body font-semibold text-text">{day}</TWText>
                  {BLOCKS.map((block) => {
                    const id = slotId(day, block);
                    const on = draft.slots.includes(id);
                    return (
                      <PressScale
                        key={block}
                        onPress={() => toggleSlot(id)}
                        accessibilityState={{ selected: on }}
                        aria-label={`${day} ${block}`}
                        className={[
                          'min-h-target-adult flex-1 justify-center rounded-card border-2 px-2',
                          on ? 'border-strong bg-highlighter' : 'border-border bg-surface-raised',
                        ].join(' ')}
                      >
                        <TWText className="text-caption text-text">{block}</TWText>
                      </PressScale>
                    );
                  })}
                </View>
              ))}
            </View>
            <Text variant="label" tone="muted">
              {summariseSlots(draft.slots)}
            </Text>
          </Section>
        ) : null}

        {step === 'connect' ? (
          <Section className="gap-group">
            <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text">
              Who do you teach with?
            </Heading>
            <TextField
              label="Invite code from a school or tutoring business"
              hint="They'll have sent you one. Leave it blank if you're independent."
              value={draft.inviteCode}
              onChangeText={(inviteCode: string) => patch({ inviteCode })}
            />
            <Card className="gap-stack">
              <Text variant="label" tone="muted">
                Working with a family directly?
              </Text>
              <TWText className="text-body text-text">
                Share your connect code and the guardian adds you from their side — a tutor never
                creates a child&apos;s account.
              </TWText>
              <Badge tone="primary" label={connectCode(draft.displayName)} />
            </Card>
            {optional ? (
              <Text variant="label" tone="muted">
                {optional}
              </Text>
            ) : null}
          </Section>
        ) : null}

        {step === 'preview' ? <PrepPreview /> : null}

        <View className="flex-row items-center gap-element">
          {back ? (
            <Button variant="outline" title="Back" onPress={() => setStep(back)} />
          ) : null}
          {/* Upwork labels the forward button with its destination — a row of
              identical "Continue"s tells a tutor nothing about what is left. */}
          <Button
            title={STEP_DESTINATION[step]}
            disabled={!ready}
            className="flex-1"
            onPress={advance}
          />
        </View>
      </View>
    </Dial>
  );
}

/**
 * The last step is the promise the rest of the flow was making: this is what the
 * tutor knows before they walk in. Demo data on purpose — a new tutor has no
 * students yet, and doc 06 §5 wants them to meet AI prep on day one anyway.
 */
function PrepPreview() {
  return (
    <Section className="gap-group">
      <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text">
        This is what you&apos;ll know before every session
      </Heading>
      <Card className="gap-stack">
        <View className="flex-row items-center justify-between">
          <Text variant="label" tone="muted">
            {SESSION_PREP.studentName} · sample
          </Text>
          <Badge label="Demo" />
        </View>
        {/* `needs-attention` is the highlighter state, never redpen: MasteryBar's
            own rule is that red marks an answer, never a child. */}
        {SESSION_PREP.mastery.map((item) => (
          <MasteryBar
            key={item.skill}
            label={item.skill}
            value={item.value}
            state={item.tone === 'grade' ? 'steady' : 'needs-attention'}
          />
        ))}
        <Text variant="label" tone="muted">
          Watch for: {SESSION_PREP.misconceptions.join(' · ')}
        </Text>
        <TWText className="text-caption text-text-muted">{SESSION_PREP.provenance}</TWText>
      </Card>
    </Section>
  );
}

/**
 * Derived from the name so it is memorable enough to read down a phone, and
 * regenerated server-side when the account is really created — this is a preview
 * of the code, not the credential itself.
 */
function connectCode(displayName: string): string {
  const stem = displayName.trim().split(/\s+/)[0] ?? 'TUTOR';
  return `${stem.toUpperCase().slice(0, 6)}-4821`;
}
