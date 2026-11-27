'use client';
// S21 · Guardian onboarding — account → consent → name the family → children →
// handoff → plan (web; the plan step does not exist on native — plan-step.native.ts).
// Doc 06 §5: cool structure, hot accents on the child cards.
// Consent is real text, not a checkbox with a link, because §5 requires it be
// screen-reader complete and readable at AA. Doc 37 §2 added the family step
// (the personalization moment) and removed `grants`, a control-free stub.
//
// Mobbin: https://mobbin.com/screens/71a1ed74-dc52-4be7-9435-4279182183cd
// (Nike Run Club — the personalized "WELCOME SAM, YOU'RE IN" beat the family
// step answers with) · https://mobbin.com/screens/940e830e-d7b9-4c97-b122-fd6c24d037be
// (Strava — social proof as ONE evidence-flavoured line on the value beat) ·
// https://mobbin.com/flows/fac935c1-143a-43e5-861e-b1e65aa6d3a5 (Garmin
// Connect, "Creating a child account" — DOB carries an explicit "once set, it
// cannot be changed", and permissions sit per-child rather than as one flat
// list) · https://mobbin.com/flows/24719932-c82c-4512-a140-d4421b8b7d78
// (GoHenry onboarding — persistent Exit on every step; "Add another child"
// above Continue) · https://mobbin.com/flows/cee1ecf7-1751-41bf-ac81-887efb909f3b
// (Kit onboarding — password rules validate live and per-rule, not one lump
// error after submit). Structure only; style stays on docs 02/08.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding guardian s21 consent children grants screen

import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, FadeIn, Heading, ScaleIn, TextField } from '@acme/ui';
import { authClient, getAuthMode, useAppSession } from '../../../providers/session';
import { useGuardianWhatsNext } from './whats-next.store';
import { ConsentFlowContent } from '../consent/consent-flow-content';
import { PaywallContent } from '../../paywall/paywall-content';
import { HandoffCodePanel } from '../handoff/handoff-code-panel';
import { createLearnerOnServer } from '../handoff/handoff.client';
import { useGuardianOnboarding } from './store';
import { GUARDIAN_PLAN_STEP } from './plan-step';
import {
  createGuardianAccount,
  canLeaveAccountStep,
  guardianAccountProblems,
  resendFailed,
  resendVerification,
  signInAfterVerification,
  verifyNotice,
} from './account';
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
  const {
    step,
    draft,
    setStep,
    patch,
    account,
    patchAccount,
    addChild,
    patchChild,
    removeChild,
    committing,
    commitError,
    setCommitting,
    setCommitError,
    reset,
  } = useGuardianOnboarding();
  const router = useRouter();
  const session = useAppSession();
  const { index, total } = stepProgress(step);
  const back = previousStep(step);
  const forward = nextStep(step);
  const armWhatsNext = useGuardianWhatsNext((s) => s.arm);

  /*
    The account step's three honest ways past it. A signed-in guardian already
    has the account the step would create; a mock build has no server to create
    one on, and `createLearnerOnServer` short-circuits on the same condition
    later; everyone else needs the three fields complete and an account that
    has been created and signed in, which `advance` below performs.
  */
  const signedIn = session.status === 'authed';
  const live = getAuthMode() === 'live';
  const accountInput = { name: draft.guardianName, email: draft.email, password: account.password };
  const ready =
    step === 'account'
      ? canLeaveAccountStep({ signedIn, live, account: accountInput })
      : canAdvance(step, draft);

  /**
   * Exiting FROM the last step is completion, so it arms the feed's one-time
   * "what happens next" card (doc 37 §2) and clears the persisted draft: a
   * finished flow that rehydrated onto its own final step would read as never
   * finished. "Save & exit" anywhere earlier keeps the draft; that is what it
   * is for.
   *
   * Which step that is depends on the platform. On web it is `plan`, and the
   * paywall's own two buttons are both honest ways out. On native there is no
   * plan step (plan-step.native.ts), so `handoff` is terminal and the Finish
   * button below carries the same exit.
   */
  const complete = () => {
    armWhatsNext();
    reset();
    onExit();
  };

  /**
   * Leaving the children step is the commit point (doc 36 §2: add learner →
   * device handoff): each drafted child becomes a real learner account, and the
   * returned ids are what the handoff step mints codes against. A row that
   * already carries an id (Back → Continue again) is not re-created.
   */
  /**
   * The account step creates the account (account.ts). In live mode with no
   * session, Continue runs sign-up; once the server has answered "verify first"
   * the same button becomes "I've confirmed my email" and runs sign-in, which
   * is how the app earns the session the link minted in the phone's browser.
   */
  const advanceAccount = async () => {
    if (!forward) return;
    if (signedIn || !live) {
      setStep(forward);
      return;
    }
    patchAccount({ busy: true, feedback: null });
    const outcome = account.verifyPending
      ? await signInAfterVerification(authClient, { email: draft.email, password: account.password })
      : await createGuardianAccount(authClient, accountInput);
    if (outcome.kind === 'signed-in') {
      // The password has done its job; a resumed flow must not find it.
      patchAccount({ busy: false, password: '', verifyPending: false, feedback: null });
      setStep(forward);
      return;
    }
    if (outcome.kind === 'verify-email') {
      patchAccount({
        busy: false,
        verifyPending: true,
        feedback: { kind: 'notice', text: verifyNotice(outcome.address) },
      });
      return;
    }
    patchAccount({ busy: false, feedback: { kind: 'error', text: outcome.message } });
  };

  const resend = async () => {
    patchAccount({ busy: true });
    const sent = await resendVerification(authClient, draft.email);
    patchAccount({
      busy: false,
      feedback: { kind: 'notice', text: sent ? verifyNotice(draft.email.trim()) : resendFailed },
    });
  };

  const advance = async () => {
    if (!forward) return;
    if (step === 'account') {
      await advanceAccount();
      return;
    }
    if (step !== 'children') {
      setStep(forward);
      return;
    }
    setCommitting(true);
    setCommitError(null);
    for (let i = 0; i < draft.children.length; i++) {
      const child = draft.children[i]!;
      if (child.learnerAuthId || !draft.consentId) continue;
      const result = await createLearnerOnServer({
        username: child.username,
        password: child.password,
        displayName: child.displayName,
        consentId: draft.consentId,
      });
      if (result.kind === 'failed') {
        setCommitting(false);
        // H9: name the child the failure belongs to; the guardian fixes one
        // row, not a mystery.
        setCommitError(`${child.displayName || 'One child'}: ${result.message}`);
        return;
      }
      patchChild(i, { learnerAuthId: result.learnerAuthId });
    }
    setCommitting(false);
    setStep(forward);
  };

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
          {/* No step count in the copy: it said "Four" while the machine ran
              seven, and the progress row above already tells the truth. */}
          <TWText className="text-body text-text">
            A few short steps. You stay in control of every one of them, and you can go back at any
            point.
          </TWText>
          {/* Doc 37 §1.4's one evidence-flavoured line (Strava's register, doc
              33's number) — stated once, on the value beat, never repeated. */}
          <TWText className="text-body font-semibold text-text">
            Tutors that guide beat answer-machines 3-to-1 — Moyo never just gives the answer.
          </TWText>
        </Section>
      ) : null}

      {step === 'account' ? (
        <Section className="gap-4">
          <Heading level={1} size="title">
            Your account
          </Heading>
          {signedIn ? (
            <TWText className="text-body text-text">
              You’re signed in{session.user ? ` as ${session.user.name}` : ''}. The children you add
              next belong to this account.
            </TWText>
          ) : (
            <>
              <TextField
                label="Your name"
                value={draft.guardianName}
                onChangeText={(guardianName: string) => patch({ guardianName })}
                autoComplete="name"
                textContentType="name"
                editable={!account.busy && !account.verifyPending}
              />
              <TextField
                label="Your email"
                hint="Yours, not your child’s. Children here never have an email address."
                value={draft.email}
                onChangeText={(email: string) => patch({ email })}
                inputMode="email"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                editable={!account.busy && !account.verifyPending}
              />
              {/* Password rules validate live and per field (Kit, doc 06 §5),
                  and only once something has been typed: an empty form that
                  is already red is a scolding, not a hint. */}
              <TextField
                label="Password"
                hint="Twelve characters or more. Length beats symbols."
                value={account.password}
                onChangeText={(password: string) => patchAccount({ password, feedback: null })}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!account.busy}
                error={account.password ? guardianAccountProblems(accountInput).password : undefined}
              />
              {/* One live region for both registers; see sign-in-content.tsx. */}
              {account.feedback ? (
                <TWText
                  role="status"
                  aria-live="polite"
                  accessibilityLiveRegion="polite"
                  className={
                    account.feedback.kind === 'error'
                      ? 'text-body text-danger'
                      : 'text-body font-semibold text-text'
                  }
                >
                  {account.feedback.text}
                </TWText>
              ) : null}
              {account.verifyPending ? (
                <Button
                  variant="ghost"
                  title="Send the link again"
                  onPress={() => void resend()}
                  disabled={account.busy}
                />
              ) : null}
              <Button
                variant="ghost"
                title="Already have an account? Sign in"
                onPress={() => router.push('/onboarding/sign-in')}
              />
            </>
          )}
        </Section>
      ) : null}

      {/* Web only, by construction — see plan-step.native.ts. The guard is the
          constant and not just the step name so the branch reads as
          platform-conditional at the place it renders. */}
      {GUARDIAN_PLAN_STEP && step === 'plan' ? (
        <PaywallContent
          onStartTrial={complete}
          onContinueFree={complete}
        />
      ) : null}

      {step === 'family' ? (
        <Section className="gap-4">
          <Heading level={1} size="title">
            Name your family
          </Heading>
          <TextField
            label="What should Moyo call your family?"
            hint="A last name works — it’s what your children will see on their screen."
            value={draft.familyName}
            onChangeText={(familyName: string) => patch({ familyName })}
          />
          {/* The Nike Run Club beat (doc 37 §1.3): the form answers the moment
              it has a name — a relationship, not an acknowledgement. ScaleIn is
              the kit's confirmation-moment entrance and reads Reduce Motion
              itself, so this lands as a still line where the device asks. */}
          {ready ? (
            <ScaleIn>
              <View className="rounded-card border-2 border-strong bg-highlighter p-inset">
                <TWText className="font-display text-3xl font-bold uppercase text-on-highlighter">
                  Welcome, the {draft.familyName.trim()} family
                </TWText>
                <TWText className="text-body text-on-highlighter">You’re in.</TWText>
              </View>
            </ScaleIn>
          ) : null}
        </Section>
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
            onComplete={(record, consentId) =>
              patch({ consentRecord: record, consentId, consentMethod: record.method, consentAccepted: true })
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
              className="gap-stack rounded-card border-2 border-highlighter bg-surface p-4"
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

      {step === 'handoff' ? (
        <Section className="gap-4">
          <Heading level={1} size="title">
            Hand them their device
          </Heading>
          {/* Doc 36 §2: the code IS the child's sign-in — no email, no password,
              nothing for a child to type but six friendly characters. */}
          <TWText className="text-body text-text">
            Open Moyo on your child&apos;s device and enter their code. That&apos;s their whole
            sign-in — no email, no password.
          </TWText>
          {draft.children.map((child, i) => (
            <HandoffCodePanel
              key={i}
              displayName={child.displayName || `Child ${i + 1}`}
              learnerAuthId={child.learnerAuthId}
            />
          ))}
          <TWText className="text-caption text-text-muted">
            No device handy? Skip this — the Family tab can show a fresh code any time.
          </TWText>
        </Section>
      ) : null}

      {commitError ? <TWText className="text-body text-redpen">{commitError}</TWText> : null}

      <View className="flex-row gap-stack">
        {back ? (
          <Button variant="outline" title="Back" onPress={() => setStep(back)} />
        ) : null}
        {forward ? (
          <Button
            title={
              committing || account.busy
                ? 'Saving…'
                : step === 'account' && account.verifyPending
                  ? 'I’ve confirmed my email'
                  : 'Continue'
            }
            onPress={() => void advance()}
            disabled={!ready || committing || account.busy}
          />
        ) : step === 'plan' ? null : (
          // The terminal step needs a way to finish that is not "Save & exit",
          // which keeps the draft. On web the paywall owns both exits, so this
          // would be a third completion button and is left out; on native the
          // flow ends on handoff and this is the only exit that completes it.
          <Button title="Finish setup" onPress={complete} />
        )}
      </View>
    </View>
  );
}
