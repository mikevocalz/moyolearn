'use client';
// ConsentFlow v1 — the screen over @acme/auth's consent machine (doc 06 §3.1).
// Notice → method → challenge → done. Every rule that decides whether consent was
// actually obtained lives in the machine; this file only asks and reports.
//
// Mobbin: https://mobbin.com/flows/2ef3ced4-5407-44d7-af39-d065d019dbf3 (GoHenry
// "Verifying parent's identity" — the step opens by saying why AND what it is
// NOT: "This isn't a credit check." An identity quiz that looks like a credit
// check loses parents at the first question) · https://mobbin.com/flows/170fbd49-2012-4121-bb82-80b8178acd5b
// (Kit — code entry with Resend directly beneath it and Verify inert until the
// code is complete) · https://mobbin.com/flows/fac935c1-143a-43e5-861e-b1e65aa6d3a5
// (Garmin Connect child account — the data notice is full plain prose ending in
// an explicit "we will not share it", not a link to a policy) ·
// https://mobbin.com/flows/4bd05e46-c39e-46d6-be23-05f43202f8e5 (Duolingo ABC —
// the grown-up gate spells its digits as words, so the barrier is reading age).
// Structure only; style stays on docs 02/08.
// SOT: docs/pack/06-auth-onboarding-spec.md §1 · §3.1
// SOT-KEYWORDS: consent flow screen notice method code kba guardian coppa

import { useState } from 'react';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Card, ErrorMessage, FadeIn, Heading, PressScale, Text, TextField } from '@acme/ui';
import {
  availableMethods,
  isFallbackMethod,
  CONSENT_DISCLOSURES,
  CONSENT_PROMISES,
  KBA_PASS_MARK,
  type ConsentMethod,
  type ConsentRecord,
} from '@acme/auth';
import { useConsentFlow } from './consent.store';
import { demoKbaProvider } from './kba.data';

const METHOD_LABELS: Record<ConsentMethod, { label: string; hint: string; target: string }> = {
  'email-plus': {
    label: 'By email',
    hint: 'A code now, then one confirmation message after it.',
    target: 'Your email address',
  },
  'text-plus': {
    label: 'By text message',
    hint: 'A code now, then one confirmation text after it.',
    target: 'Your mobile number',
  },
  card: {
    label: 'With the card on file',
    hint: 'We verify the card already on your account. Nothing is charged.',
    target: 'Card on file',
  },
  kba: {
    label: 'Answer a few questions about you',
    hint: 'Four questions only you would know the answers to.',
    target: 'Identity check',
  },
};

export interface ConsentFlowProps {
  scope: string;
  policyVersion: string;
  onComplete: (record: ConsentRecord) => void;
}

export function ConsentFlowContent({ scope, policyVersion, onComplete }: ConsentFlowProps) {
  const { stage, env, challenge, problem, setStage, begin, finish, record } = useConsentFlow();
  const [method, setMethod] = useState<ConsentMethod>('email-plus');
  const [target, setTarget] = useState('');
  const [showFallback, setShowFallback] = useState(false);

  const methods = availableMethods(env);
  const primary = methods.filter((m) => !isFallbackMethod(m));
  const fallback = methods.filter(isFallbackMethod);

  if (stage === 'done' && record) {
    return (
      <Card className="gap-stack">
        <Heading level={2} size="display-sm" className="text-xl font-semibold text-text">
          Permission recorded
        </Heading>
        <TWText className="text-body text-text">
          Verified {METHOD_LABELS[record.method].label.toLowerCase()}. We keep a record of how and
          when — you can withdraw it any time from the family screen.
        </TWText>
        <Button title="Continue" onPress={() => onComplete(record)} />
      </Card>
    );
  }

  if (stage === 'challenge' && challenge) {
    return challenge.method === 'kba' ? (
      <KbaChallenge onDone={() => finish(scope, policyVersion)} />
    ) : (
      <CodeChallenge onDone={() => finish(scope, policyVersion)} />
    );
  }

  if (stage === 'method') {
    return (
      <Section className="gap-group">
        <Heading level={2} size="display-sm" className="text-xl font-semibold text-text">
          How should we check it&apos;s you?
        </Heading>
        <TWText className="text-body text-text">
          The law asks us to verify that a parent or guardian gave this permission, not a child.
        </TWText>

        {primary.map((option) => (
          <PressScale
            key={option}
            onPress={() => setMethod(option)}
            accessibilityState={{ selected: method === option }}
            className={[
              'min-h-target-adult rounded-card border-2 p-inset',
              method === option ? 'border-strong bg-highlighter' : 'border-border bg-surface-raised',
            ].join(' ')}
          >
            <TWText className="text-body font-semibold text-text">
              {METHOD_LABELS[option].label}
            </TWText>
            <TWText className="text-caption text-text-muted">{METHOD_LABELS[option].hint}</TWText>
          </PressScale>
        ))}

        {method !== 'card' ? (
          <TextField
            label={METHOD_LABELS[method].target}
            value={target}
            onChangeText={setTarget}
          />
        ) : null}

        {/* Doc 06 §3.1 puts KBA behind "having trouble?" — it is the fallback,
            never the first thing a parent is asked to do. */}
        {!showFallback ? (
          <Button variant="ghost" title="Having trouble?" onPress={() => setShowFallback(true)} />
        ) : (
          fallback.map((option) => (
            <Card key={option} className="gap-stack">
              <TWText className="text-body font-semibold text-text">
                {METHOD_LABELS[option].label}
              </TWText>
              {/* GoHenry says what the check is NOT, because an identity quiz
                  reads as a credit check and parents bail. */}
              <TWText className="text-caption text-text-muted">
                {METHOD_LABELS[option].hint} This isn&apos;t a credit check and it doesn&apos;t
                affect your credit file.
              </TWText>
              <Button
                variant="outline"
                title="Answer questions instead"
                onPress={() => begin(option, METHOD_LABELS[option].target, demoKbaProvider([]))}
              />
            </Card>
          ))
        )}

        <ErrorMessage message={problem ?? undefined} />

        <View className="flex-row gap-element">
          <Button variant="outline" title="Back" onPress={() => setStage('notice')} />
          <Button
            title="Send the code"
            className="flex-1"
            disabled={method !== 'card' && target.trim().length === 0}
            onPress={() => begin(method, method === 'card' ? 'card-on-file' : target)}
          />
        </View>
      </Section>
    );
  }

  return (
    <Section className="gap-group">
      <Heading level={2} size="display-sm" className="text-xl font-semibold text-text">
        What we collect, and why
      </Heading>
      {/* Garmin's notice is prose a parent can actually read, ending in the
          promise. Rendered from the consent schema so the words a guardian
          agreed to are the words the policy version refers to. */}
      <View className="gap-stack rounded-card border-2 border-border bg-surface-sunken p-inset">
        {CONSENT_DISCLOSURES.map((item) => (
          <View key={item.what} className="gap-element">
            <TWText className="text-body font-semibold text-text">{item.what}</TWText>
            <TWText className="text-body text-text">{item.why}</TWText>
          </View>
        ))}
        {CONSENT_PROMISES.map((promise) => (
          <TWText key={promise} className="text-body font-semibold text-text">
            {promise}
          </TWText>
        ))}
        <Text variant="label" tone="muted">
          Policy version {policyVersion}. If this changes materially we ask again rather than
          assuming.
        </Text>
      </View>
      <FadeIn>
        <Button title="I give permission as this child’s parent or guardian" onPress={() => setStage('method')} />
      </FadeIn>
    </Section>
  );
}

/** email-plus / text-plus / card: verify the first contact, then the "plus". */
function CodeChallenge({ onDone }: { onDone: () => void }) {
  const { challenge, problem, enterCode, acknowledge, begin } = useConsentFlow();
  const [code, setCode] = useState('');
  if (!challenge) return null;

  if (challenge.codeVerified) {
    return (
      <Section className="gap-group">
        <Heading level={2} size="display-sm" className="text-xl font-semibold text-text">
          One more message
        </Heading>
        {/* The "plus" — a second, separate contact. Named plainly, because a
            parent who thinks they are finished stops here and no consent exists. */}
        <TWText className="text-body text-text">
          We&apos;ve sent a confirmation to {challenge.sentTo}. Open it, then come back and confirm
          — permission isn&apos;t recorded until you do.
        </TWText>
        <ErrorMessage message={problem ?? undefined} />
        <Button
          title="I confirmed it"
          onPress={() => {
            acknowledge();
            onDone();
          }}
        />
      </Section>
    );
  }

  return (
    <Section className="gap-group">
      <Heading level={2} size="display-sm" className="text-xl font-semibold text-text">
        Enter the code we sent
      </Heading>
      <TWText className="text-body text-text">Sent to {challenge.sentTo}.</TWText>
      <TextField label="Code" value={code} onChangeText={setCode} />
      {/* Kit keeps Resend directly under the input — a parent looking for it is
          already frustrated, and a hunt is what turns that into an abandon. */}
      <Button
        variant="ghost"
        title="Resend code"
        onPress={() => begin(challenge.method, challenge.sentTo)}
      />
      <ErrorMessage message={problem ?? undefined} />
      <Button
        title="Verify"
        disabled={code.trim().length === 0}
        onPress={() => enterCode(code.trim().length >= 4)}
      />
    </Section>
  );
}

/** The fallback: four questions, three right. Passing is itself the confirmation. */
function KbaChallenge({ onDone }: { onDone: () => void }) {
  const { challenge, questions, answers, problem, answer, submitKba, begin } = useConsentFlow();
  if (!challenge) return null;

  if (questions.length === 0) {
    return (
      <Card className="gap-stack">
        <TWText className="text-body text-text">
          We&apos;ve run out of questions we can ask safely. Support can verify you another way —
          your child&apos;s account isn&apos;t set up until they do.
        </TWText>
      </Card>
    );
  }

  const answered = answers.every((a) => a >= 0);

  return (
    <Section className="gap-group">
      <Heading level={2} size="display-sm" className="text-xl font-semibold text-text">
        A few questions about you
      </Heading>
      <TWText className="text-body text-text">
        Get {KBA_PASS_MARK} of {questions.length} right. This isn&apos;t a credit check and
        it doesn&apos;t affect your credit file.
      </TWText>

      {questions.map((question, qi) => (
        <View key={question.id} className="gap-stack">
          <TWText className="text-body font-semibold text-text">{question.prompt}</TWText>
          {question.options.map((option, oi) => (
            <PressScale
              key={option}
              onPress={() => answer(qi, oi)}
              accessibilityState={{ selected: answers[qi] === oi }}
              className={[
                'min-h-target-adult justify-center rounded-card border-2 px-4',
                answers[qi] === oi ? 'border-strong bg-highlighter' : 'border-border bg-surface-raised',
              ].join(' ')}
            >
              <TWText className="text-body text-text">{option}</TWText>
            </PressScale>
          ))}
        </View>
      ))}

      <ErrorMessage message={problem ?? undefined} />
      <Button
        title="Check my answers"
        disabled={!answered}
        onPress={() => {
          submitKba();
          const next = useConsentFlow.getState().challenge;
          if (next && next.confirmed) {
            onDone();
            return;
          }
          // A spent set is spent: the guardian gets different questions, not a
          // second pass at the same four.
          if (next) begin('kba', challenge.sentTo, demoKbaProvider(next.spentIds));
        }}
      />
    </Section>
  );
}
