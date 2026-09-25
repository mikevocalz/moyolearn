'use client';
// Native email sign-in — the front door for adults.
//
// The form is plain, reachable, and kid-safe: no price, no pressure, and a
// clear way back. On success the root dispatcher picks the right shell.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 · docs/incidents/2026-09-22-login-lockout.md
// SOT-KEYWORDS: onboarding sign-in email password native moyo verification notice zustand

import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Heading, TextField, useInstanceStore, useStore } from '@acme/ui';
import { authClient } from '../../providers/session';

/**
 * What the form has to say, and in which register.
 *
 * A union rather than `message: string` plus a `status` that might or might not
 * mean it is an error: "unverified" and "wrong password" render differently and
 * must never be able to hold each other's styling. `notice` is the calm
 * register — nothing the reader did is wrong — and `error` is the red one.
 */
type Feedback = { kind: 'error'; text: string } | { kind: 'notice'; text: string };

/**
 * Identical wording to the web form (apps/web/components/auth/LoginContent.tsx).
 * One incident, one sentence: a parent who hits this on the phone and then on
 * the laptop should not have to work out whether they are two different
 * problems.
 */
const verifyNotice = (address: string) =>
  `Confirm your email to sign in. We just sent a new link to ${address}. Open it and you'll be signed in.`;

const resendFailed = 'We couldn’t send a new link just now. Try again in a moment.';

export function SignInContent() {
  const router = useRouter();

  /*
    Zustand, not `useState` — the repo's state rule, and `useInstanceStore`
    holds a vanilla store in a ref so the state is scoped per mount rather than
    shared by a module-level `create()`.
  */
  const store = useInstanceStore(() => ({
    email: '',
    password: '',
    submitting: false,
    feedback: null as Feedback | null,
  }));
  const { email, password, submitting, feedback } = useStore(store, (s) => s);
  const patch = (next: Partial<ReturnType<typeof store.getState>>) =>
    store.setState((s) => ({ ...s, ...next }));

  const ready = email.trim().length > 0 && password.length > 0;

  const submit = async () => {
    if (!ready || submitting) return;
    patch({ submitting: true, feedback: null });

    // Autofill hands back a trailing space often enough that an untrimmed
    // address is a real lockout — the lookup misses and the screen blames the
    // password.
    const address = email.trim();

    try {
      /*
        THE BUG THIS REPLACES. The Better Auth client RESOLVES with
        `{ data, error }` and does not throw, so the previous `try`/`catch`
        caught nothing: a wrong password fell straight through to
        `router.replace('/')`, the dispatcher found no session and bounced the
        user back here with the form blank and no message at all. Every failure
        looked like a glitch.

        `callbackURL` is relative on purpose. No `trustedOrigins` are configured
        in `createAuth` on this branch, so an absolute URL is refused with
        INVALID_CALLBACKURL; a relative path resolves against whichever origin
        served the request and is correct on every host this ships to.
      */
      const res = await authClient.signIn.email({
        email: address,
        password,
        callbackURL: '/',
      });

      if (res.error?.code === 'EMAIL_NOT_VERIFIED') {
        // better-auth@1.7.2 has already re-sent the link by the time this
        // resolves (`emailVerification.sendOnSignIn`).
        patch({ feedback: { kind: 'notice', text: verifyNotice(address) } });
        return;
      }
      if (res.error) {
        patch({
          feedback: {
            kind: 'error',
            text:
              res.error.message ??
              'We couldn’t sign you in. Check your email and password and try again.',
          },
        });
        return;
      }

      router.replace('/');
    } catch (err) {
      // Reached only by a genuine transport failure — the client resolves for
      // every response it can parse, including a 403.
      patch({
        feedback: {
          kind: 'error',
          text:
            err instanceof Error
              ? err.message
              : 'We couldn’t sign you in. Check your email and password and try again.',
        },
      });
    } finally {
      patch({ submitting: false });
    }
  };

  /*
    THE MANUAL RESEND — same contract as the web form. `/send-verification-email`
    answers `{ status: true }` for an unknown or already-verified address on
    purpose (no enumeration), so the only failure it can report is the sender,
    and that stays in the notice register with the button still available.
  */
  const resend = async () => {
    if (submitting) return;
    const address = email.trim();
    patch({ submitting: true });
    try {
      const res = await authClient.sendVerificationEmail({ email: address, callbackURL: '/' });
      patch({
        feedback: { kind: 'notice', text: res.error ? resendFailed : verifyNotice(address) },
      });
    } catch {
      patch({ feedback: { kind: 'notice', text: resendFailed } });
    } finally {
      patch({ submitting: false });
    }
  };

  return (
    <Section className="gap-group p-inset-roomy">
      <View className="gap-stack">
        <Heading level={1} size="title">
          Sign in to Moyo
        </Heading>
        <TWText className="text-body text-text">
          Use the email and password for your Moyo account.
        </TWText>
      </View>

      <View className="gap-stack">
        <TextField
          label="Email"
          value={email}
          onChangeText={(next: string) => patch({ email: next })}
          autoCapitalize="none"
          editable={!submitting}
          className="w-full"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={(next: string) => patch({ password: next })}
          secureTextEntry
          autoCapitalize="none"
          editable={!submitting}
          className="w-full"
        />
        {/*
          One live region for both registers, so a second message replaces the
          first instead of stacking under it. `aria-live` is the web contract and
          `accessibilityLiveRegion` the Android one — react-native-web maps
          neither from the other, and a field carrying only one is announced on
          only some of the devices families actually use.

          `status`, never `alert`, even for the error: this sits inside the form
          the reader is still working in, and an assertive region interrupts
          whatever the screen reader was saying mid-word.
        */}
        {feedback ? (
          <TWText
            role="status"
            aria-live="polite"
            accessibilityLiveRegion="polite"
            className={
              feedback.kind === 'error'
                ? 'text-body text-danger'
                : 'text-body font-semibold text-text'
            }
          >
            {feedback.text}
          </TWText>
        ) : null}
        {feedback?.kind === 'notice' ? (
          <Button
            title="Send the link again"
            onPress={() => void resend()}
            variant="ghost"
            disabled={submitting}
            fullWidth
          />
        ) : null}
      </View>

      <View className="gap-stack">
        <Button
          title={submitting ? 'Signing in…' : 'Sign in'}
          onPress={() => void submit()}
          disabled={!ready || submitting}
          fullWidth
          size="lg"
        />
        <Button
          title="Back"
          onPress={() => router.push('/onboarding')}
          variant="outline"
          fullWidth
        />
      </View>
    </Section>
  );
}
