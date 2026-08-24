'use client';
// S25 · Teacher onboarding — Google in → class → roster → first assignment out.
// Cool dial: an educator's working surface.
//
// Mobbin: https://mobbin.com/flows/268f654c-2b21-48ed-85de-eb740c1d7632 (Duolingo
// for Schools "Join a Classroom" — a short fixed-length code in per-character
// boxes, and what joining GRANTS stated in plain words ABOVE the input rather
// than in terms nobody opens) · https://mobbin.com/flows/3d9fc7d8-70ba-46c7-be13-8c55c636f1ff
// (Quizlet — a QR is the primary classroom join affordance with "enter the code
// instead" always visible; projecting beats reading six letters aloud) ·
// https://mobbin.com/flows/e2b38c2a-ce08-40d0-997e-c846b5022a46 (Preply — a
// numbered get-started card that keeps the finished steps visible beside the
// current one). Structure only; style stays on docs 02/08.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding teacher s25 class roster join code guardian assignment

import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Badge, Button, Card, Dial, FadeIn, Heading, PressScale, Text, Textarea, TextField } from '@acme/ui';
import { parseInvitees } from '../business/steps';
import { useTeacherOnboarding } from './store';
import {
  canAdvance,
  joinOptions,
  nextStep,
  previousStep,
  stepProgress,
  ASSIGNMENT_TEMPLATES,
  GRADE_BANDS,
} from './steps';

export function TeacherOnboardingContent({ onExit }: { onExit: () => void }) {
  const { step, draft, setStep, patch, chooseBand, setGuardianEmails, chooseTemplate, sendAssignment } =
    useTeacherOnboarding();
  const { index, total } = stepProgress(step);
  const back = previousStep(step);
  const forward = nextStep(step);
  const advance = () => (forward ? setStep(forward) : onExit());

  return (
    <Dial temperature="cool">
      <View className="gap-group">
        <FadeIn>
          <View className="flex-row items-center justify-between rounded-card border-2 border-border bg-surface-sunken p-inset-tight">
            <Text variant="label" tone="muted">
              Step {index} of {total}
            </Text>
            {draft.code ? <Badge tone="primary" label={draft.code} /> : null}
          </View>
        </FadeIn>

        {step === 'account' ? (
          <Section className="gap-stack">
            <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text md:text-3xl">
              Set up your class
            </Heading>
            <TWText className="text-body text-text">
              A few minutes: your class, how students join, and one assignment out the door.
            </TWText>
            <Button
              title="Continue with Google"
              variant={draft.google ? 'outline' : 'primary'}
              onPress={() => patch({ google: true })}
            />
            <Text variant="label" tone="muted">
              or use your school email
            </Text>
            <TextField
              label="Email"
              value={draft.email}
              onChangeText={(email: string) => patch({ email, google: false })}
            />
          </Section>
        ) : null}

        {step === 'class' ? (
          <Section className="gap-group">
            <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text">
              Your class
            </Heading>
            <TextField
              label="School"
              hint="Optional."
              value={draft.school}
              onChangeText={(school: string) => patch({ school })}
            />
            <TextField
              label="Class name"
              hint="What you call it — students will see this."
              value={draft.className}
              onChangeText={(className: string) => patch({ className })}
            />
            <View className="gap-stack">
              <Text variant="label" tone="muted">
                Grades
              </Text>
              {/* The band is not cosmetic: it decides which ways in are lawful,
                  which is why each option says what it means for the class. */}
              {GRADE_BANDS.map((band) => {
                const on = draft.gradeBand === band.id;
                return (
                  <PressScale
                    key={band.id}
                    onPress={() => chooseBand(band.id)}
                    accessibilityState={{ selected: on }}
                    className={[
                      'min-h-target-adult justify-center rounded-card border-2 p-inset-tight',
                      on ? 'border-strong bg-highlighter' : 'border-border bg-surface-raised',
                    ].join(' ')}
                  >
                    <TWText className="text-body font-semibold text-text">{band.label}</TWText>
                    <TWText className="text-caption text-text-muted">{band.note}</TWText>
                  </PressScale>
                );
              })}
            </View>
          </Section>
        ) : null}

        {step === 'roster' ? <Roster onSetGuardianEmails={setGuardianEmails} /> : null}

        {step === 'assignment' ? (
          <Section className="gap-group">
            <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text">
              Send them something today
            </Heading>
            {/* Finished work, not an empty composer — the brief's metric is "first
                assignment sent", and a blank page on day one is how that is missed. */}
            <TWText className="text-body text-text">
              Pick one to send now. You can change any of it afterwards.
            </TWText>
            {ASSIGNMENT_TEMPLATES.map((template) => {
              const on = draft.templateId === template.id;
              return (
                <PressScale
                  key={template.id}
                  onPress={() => chooseTemplate(template.id)}
                  accessibilityState={{ selected: on }}
                  className={[
                    'rounded-card border-2 p-inset',
                    on ? 'border-strong bg-highlighter' : 'border-border bg-surface-raised',
                  ].join(' ')}
                >
                  <View className="flex-row items-center justify-between">
                    <TWText className="text-body font-semibold text-text">{template.title}</TWText>
                    <TWText className="text-caption text-text-muted">
                      about {template.minutes} min
                    </TWText>
                  </View>
                  <TWText className="text-caption text-text-muted">{template.description}</TWText>
                </PressScale>
              );
            })}
          </Section>
        ) : null}

        <View className="flex-row items-center gap-element">
          {back ? <Button variant="outline" title="Back" onPress={() => setStep(back)} /> : null}
          <Button
            title={step === 'assignment' ? 'Send it' : 'Continue'}
            disabled={!canAdvance(step, draft)}
            className="flex-1"
            onPress={() => {
              if (step === 'assignment') sendAssignment();
              advance();
            }}
          />
        </View>
      </View>
    </Dial>
  );
}

/**
 * How students get in. The options come from the class's grade band, not from a
 * picker: under 13 the only lawful route is a guardian who consents, and a
 * teacher who could pick "class code" for a third-grade class would be creating
 * child accounts (doc 06 §2/§5 forbid exactly that).
 */
function Roster({ onSetGuardianEmails }: { onSetGuardianEmails: (emails: string[]) => void }) {
  const draft = useTeacherOnboarding((s) => s.draft);
  const options = draft.gradeBand ? joinOptions(draft.gradeBand) : [];

  return (
    <Section className="gap-group">
      <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text">
        How students join
      </Heading>
      {options.map((option) => (
        <Card key={option.method} className="gap-stack">
          <View className="flex-row items-center justify-between">
            <TWText className="text-body font-semibold text-text">{option.label}</TWText>
            {option.method === 'class-code' ? <Badge tone="primary" label={draft.code} /> : null}
          </View>
          {/* Duolingo states what the code grants before anyone uses it. */}
          <TWText className="text-body text-text">{option.grants}</TWText>

          {option.method === 'class-code' ? (
            <TWText className="text-caption text-text-muted">
              Project it or read it out. We ask each student their date of birth when they redeem
              it, and anyone under 13 is sent to their guardian instead.
            </TWText>
          ) : (
            <View className="gap-stack">
              <Textarea
                label="Guardian email addresses"
                hint="Theirs, not the students'. Paste a list — commas, spaces or new lines all work."
                value={draft.guardianEmails.join('\n')}
                onChangeText={(text: string) => onSetGuardianEmails(parseInvitees(text))}
              />
              <Text variant="label" tone="muted">
                {draft.guardianEmails.length === 0
                  ? 'You can send these later — the class works without them.'
                  : `${draft.guardianEmails.length} guardians will get a join link`}
              </Text>
            </View>
          )}
        </Card>
      ))}
    </Section>
  );
}
