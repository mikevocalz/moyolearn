'use client';
// Forgot password — the request half. A parent types the address, Better Auth
// mails a link, and the link reopens the app on the reset screen.
//
// `requestPasswordReset` answers success for an unknown address on purpose (no
// enumeration), so the screen's "we sent it" line is a promise about the
// sender, not about the account; the only failure it can report is the sender,
// which `createAuth` already logs loudly when RESEND_API_KEY is missing.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §6 · packages/auth/src/auth-email.ts
// SOT-KEYWORDS: forgot password reset request email better auth native zustand

import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Heading, TextField, useInstanceStore, useStore } from '@acme/ui';
import { authClient } from '../../providers/session';

/**
 * Where the mailed link lands. Better Auth's `/reset-password/:token` callback
 * redirects to this URL with `?token=` appended (or `?error=INVALID_TOKEN`), and
 * `moyo://` is a trusted origin in `createAuth`, so the pattern matches any
 * path under the scheme. A browser gets the same path on its own origin.
 */
export function resetRedirectUrl(): string {
  return typeof document !== 'undefined' ? '/onboarding/reset-password' : 'moyo://onboarding/reset-password';
}

const sentNotice = (address: string) =>
  `If there’s a Moyo account for ${address}, we’ve sent it a link to choose a new password. Open it on this device.`;

const sendFailed = 'We couldn’t send the link just now. Try again in a moment.';

type Feedback = { kind: 'error'; text: string } | { kind: 'notice'; text: string };

export function ForgotPasswordContent() {
  const router = useRouter();
  // Zustand per mount (useInstanceStore), the repo's state rule — see sign-in-content.tsx.
  const store = useInstanceStore(() => ({
    email: '',
    submitting: false,
    feedback: null as Feedback | null,
  }));
  const { email, submitting, feedback } = useStore(store, (s) => s);
  const patch = (next: Partial<ReturnType<typeof store.getState>>) =>
    store.setState((s) => ({ ...s, ...next }));

  const ready = /.+@.+\..+/.test(email.trim());

  const submit = async () => {
    if (!ready || submitting) return;
    const address = email.trim();
    patch({ submitting: true, feedback: null });
    try {
      const res = await authClient.requestPasswordReset({ email: address, redirectTo: resetRedirectUrl() });
      patch({
        feedback: res.error
          ? { kind: 'error', text: res.error.message ?? sendFailed }
          : { kind: 'notice', text: sentNotice(address) },
      });
    } catch {
      patch({ feedback: { kind: 'error', text: sendFailed } });
    } finally {
      patch({ submitting: false });
    }
  };

  return (
    <Section className="gap-group p-inset-roomy">
      <View className="gap-stack">
        <Heading level={1} size="title">
          Reset your password
        </Heading>
        <TWText className="text-body text-text">
          Enter the email for your Moyo account and we’ll send a link to choose a new password.
        </TWText>
      </View>

      <View className="gap-stack">
        <TextField
          label="Email"
          value={email}
          onChangeText={(next: string) => patch({ email: next })}
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!submitting}
          className="w-full"
        />
        {feedback ? (
          <TWText
            role="status"
            aria-live="polite"
            accessibilityLiveRegion="polite"
            className={feedback.kind === 'error' ? 'text-body text-danger' : 'text-body font-semibold text-text'}
          >
            {feedback.text}
          </TWText>
        ) : null}
      </View>

      <View className="gap-stack">
        <Button
          title={submitting ? 'Sending…' : 'Send the link'}
          onPress={() => void submit()}
          disabled={!ready || submitting}
          fullWidth
          size="lg"
        />
        <Button title="Back to sign in" onPress={() => router.push('/onboarding/sign-in')} variant="outline" fullWidth />
      </View>
    </Section>
  );
}
