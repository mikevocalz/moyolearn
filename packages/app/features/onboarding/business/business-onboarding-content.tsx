'use client';
// S24 · Business owner onboarding — org → roster import → tutors → payments →
// the milestone checklist that outlives this flow. Cool dial throughout: this is
// an operator's tool.
//
// Mobbin: https://mobbin.com/flows/941c6e90-47f7-4d03-b079-34d7227aa322 (Sprout
// Social import — required fields and formatting are stated ABOVE the drop zone,
// and a validation failure names the offending ROWS ("Rows: 2, 3, 4, 5, 6")
// instead of rejecting the file) · https://mobbin.com/flows/d2d155b4-cc57-4346-9f94-c8b5c5f6af72
// (Uxcel Teams — the onboarding checklist is a dashboard card with a completion
// percentage that persists after onboarding ends, under a trial banner) ·
// https://mobbin.com/flows/d53d0081-565a-4c2a-b096-b8f745ec812c (Todoist — "Skip
// for now" is its own full-width button under Continue, and an invite link is
// offered beside typing addresses) · https://mobbin.com/flows/e97ed41a-5424-4282-a8a1-c89d723a292f
// (Perplexity — org creation is one card: name plus the terms, nothing else).
// Structure only; style stays on docs 02/08.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding business s24 org roster csv import invite payments milestones

import { Section, View, Text as TWText } from '@acme/ui/tw';
import {
  Badge,
  Button,
  Card,
  Dial,
  FadeIn,
  Heading,
  PressScale,
  Select,
  Text,
  Textarea,
  TextField,
} from '@acme/ui';
// The universal document picker already exists in the editor feature; a second
// one here is exactly the duplicate the pattern rule forbids.
import { pickFile } from '../../editor/pick-file';
import { readText } from './read-text';
import { ROLE_LABELS, type ColumnRole } from './roster-csv';
import { MILESTONES, milestoneProgress, trialChip } from '../../trial/milestones';
import { useBusinessOnboarding } from './store';
import {
  canAdvance,
  nextStep,
  parseInvitees,
  previousStep,
  stepProgress,
  SERVICES,
  SKIP_LABEL,
} from './steps';

/** Days remaining in the 30-day trial — supplied by the caller once billing is live. */
export interface BusinessOnboardingProps {
  onExit: () => void;
  trialDaysLeft?: number;
}

export function BusinessOnboardingContent({ onExit, trialDaysLeft = 30 }: BusinessOnboardingProps) {
  const {
    step,
    draft,
    setStep,
    patch,
    toggleService,
    readCsv,
    confirmImport,
    setInvitees,
    sendInvites,
    completeMerchant,
  } = useBusinessOnboarding();
  const { index, total } = stepProgress(step);
  const back = previousStep(step);
  const forward = nextStep(step);
  const skip = SKIP_LABEL[step];
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
              {/* Uxcel keeps the trial state visible during setup, not only after.
                  Copy stays on doc 05 §6: what you set up stays. */}
              <Badge label={trialChip(trialDaysLeft, draft.activation)} />
              {/* H3/H4: the same way out S21 offers. An operator interrupted
                  mid-import must not have to finish to keep the org. */}
              <Button variant="ghost" size="sm" title="Save & exit" onPress={onExit} />
            </View>
          </View>
        </FadeIn>

        {step === 'org' ? (
          <Section className="gap-group">
            <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text md:text-3xl">
              Set up your business
            </Heading>
            <TextField
              label="Business name"
              value={draft.orgName}
              onChangeText={(orgName: string) => patch({ orgName })}
            />
            <TextField
              label="Locations"
              hint="Comma separated. Leave blank if you're online only."
              value={draft.locations.join(', ')}
              onChangeText={(text: string) =>
                patch({ locations: text.split(',').map((s) => s.trim()).filter(Boolean) })
              }
            />
            <View className="gap-stack">
              <Text variant="label" tone="muted">
                What you offer
              </Text>
              <View className="flex-row flex-wrap gap-element">
                {SERVICES.map((service) => {
                  const on = draft.services.includes(service);
                  return (
                    <PressScale
                      key={service}
                      onPress={() => toggleService(service)}
                      accessibilityState={{ selected: on }}
                      className={[
                        'min-h-target-adult justify-center rounded-card border-2 px-4',
                        on ? 'border-strong bg-highlighter' : 'border-border bg-surface-raised',
                      ].join(' ')}
                    >
                      <TWText className="text-body text-text">{service}</TWText>
                    </PressScale>
                  );
                })}
              </View>
            </View>
          </Section>
        ) : null}

        {step === 'import' ? (
          <Section className="gap-group">
            <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text">
              Bring your students over
            </Heading>
            {/* Sprout Social states the requirements before the picker, so a
                failed import is not the first time an operator learns them. */}
            <TWText className="text-body text-text">
              A CSV from whatever you use now. We only need a student name and a guardian email —
              we&apos;ll work out your column names, and you can correct us below.
            </TWText>
            <Button
              variant="outline"
              title="Choose a CSV"
              onPress={() => {
                void pickFile()
                  .then((file) => (file ? readText(file.uri) : null))
                  .then((text) => text && readCsv(text));
              }}
            />
            {draft.roster ? <RosterReview onConfirm={() => { confirmImport(); advance(); }} /> : null}
          </Section>
        ) : null}

        {step === 'invite' ? (
          <Section className="gap-group">
            <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text">
              Invite your tutors
            </Heading>
            <Textarea
              label="Their email addresses"
              hint="Paste a list — commas, spaces or new lines all work."
              value={draft.tutorEmails.join('\n')}
              onChangeText={(text: string) => setInvitees(parseInvitees(text))}
            />
            <Text variant="label" tone="muted">
              {draft.tutorEmails.length === 0
                ? 'No valid addresses yet'
                : `${draft.tutorEmails.length} ready to invite`}
            </Text>
            <Button
              title="Send invites"
              disabled={draft.tutorEmails.length === 0}
              onPress={() => {
                sendInvites();
                advance();
              }}
            />
          </Section>
        ) : null}

        {step === 'payments' ? (
          <Section className="gap-group">
            <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text">
              Get paid in the app
            </Heading>
            <TWText className="text-body text-text">
              Stripe handles the payouts and the tax forms. You&apos;ll need your business details
              and a bank account.
            </TWText>
            {/* Merchant onboarding is embedded (doc 05 §5.2); this hands off and
                comes back, which is why completion is a state change, not a step. */}
            <Button
              title={draft.activation.merchantOnboarded ? 'Payments connected' : 'Connect payments'}
              disabled={draft.activation.merchantOnboarded}
              onPress={() => {
                completeMerchant();
                advance();
              }}
            />
          </Section>
        ) : null}

        {step === 'checklist' ? (
          <Section className="gap-group">
            <Heading level={1} size="display-sm" className="text-2xl font-semibold text-text">
              You&apos;re live
            </Heading>
            <Checklist />
          </Section>
        ) : null}

        <View className="gap-element">
          <View className="flex-row items-center gap-element">
            {back ? (
              <Button variant="outline" title="Back" onPress={() => setStep(back)} />
            ) : null}
            <Button
              title={forward ? 'Continue' : 'Go to your dashboard'}
              disabled={!canAdvance(step, draft)}
              className="flex-1"
              onPress={advance}
            />
          </View>
          {/* Todoist gives skipping its own full-width button rather than a link
              in the corner — on the steps where it is genuinely allowed. */}
          {skip ? <Button variant="ghost" title={skip} onPress={advance} /> : null}
        </View>
      </View>
    </Dial>
  );
}

/**
 * The mapper's verdict, correctable. Every column is a Select rather than a
 * guess the operator has to trust, and the rows that failed are named by their
 * spreadsheet line so the fix happens in the file they already have open.
 */
function RosterReview({ onConfirm }: { onConfirm: () => void }) {
  const roster = useBusinessOnboarding((s) => s.draft.roster);
  const remap = useBusinessOnboarding((s) => s.remap);
  if (!roster) return null;

  const roles = Object.keys(ROLE_LABELS) as ColumnRole[];

  return (
    <Card className="gap-stack">
      <Text variant="label" tone="muted">
        Your columns
      </Text>
      {roster.headers.map((header, i) => (
        <Select
          key={header || `column-${i}`}
          label={header || `Column ${i + 1}`}
          value={roster.mapping[i]}
          onValueChange={(role: string) => remap(i, role as ColumnRole)}
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      ))}

      {/* WCAG 4.1.3: the count changes when a column is re-mapped, and a
          verdict nobody is told about is a verdict only sighted users get. */}
      <TWText role="status" className="text-body font-semibold text-text">
        {roster.ready} of {roster.rows.length} rows ready
      </TWText>
      {roster.problemLines.length > 0 ? (
        <View className="gap-element rounded-card border-2 border-border bg-surface-sunken p-inset-tight">
          {/* Named rows, not a rejected file: the rest still imports. */}
          <TWText className="text-body text-text">
            Rows {roster.problemLines.join(', ')} need a look — we&apos;ll import the others now and
            you can add these after.
          </TWText>
          {roster.rows
            .filter((row) => row.problems.length > 0)
            .slice(0, 5)
            .map((row) => (
              <TWText key={row.line} className="text-caption text-text-muted">
                Row {row.line}: {row.problems.join(' · ')}
              </TWText>
            ))}
        </View>
      ) : null}
      <Button
        title={`Import ${roster.ready} students`}
        disabled={roster.ready === 0}
        onPress={onConfirm}
      />
    </Card>
  );
}

/**
 * The checklist is derived from what the account has actually done (see
 * milestones.ts), so it stays honest after onboarding ends — Uxcel keeps the
 * same card on the dashboard, and doc 05 §2.3 measures conversion against it.
 */
function Checklist() {
  const activation = useBusinessOnboarding((s) => s.draft.activation);
  const { done, total, next } = milestoneProgress(activation);

  return (
    <Card className="gap-stack">
      <View className="flex-row items-center justify-between">
        <Text variant="label" tone="muted">
          Setup
        </Text>
        <TWText className="text-body font-semibold text-text">
          {done} of {total}
        </TWText>
      </View>
      {MILESTONES.map((milestone) => {
        const complete = milestone.done(activation);
        return (
          <View key={milestone.id} className="flex-row gap-element">
            <TWText className={complete ? 'text-body text-grade' : 'text-body text-text-muted'}>
              {complete ? '✓' : '○'}
            </TWText>
            <View className="flex-1">
              <TWText className="text-body text-text">{milestone.label}</TWText>
              <TWText className="text-caption text-text-muted">{milestone.why}</TWText>
            </View>
          </View>
        );
      })}
      {next ? (
        <TWText className="text-body text-text">Next: {next.label.toLowerCase()}.</TWText>
      ) : (
        <TWText className="text-body text-text">Everything&apos;s set up.</TWText>
      )}
    </Card>
  );
}
