'use client';
// Reset password — the second half. The mailed link reopens the app here with
// `?token=`; the parent chooses a new password and `resetPassword` spends the
// token. `revokeSessionsOnPasswordReset` is on in `createAuth`, so every other
// session ends with the old password, which is the point of changing it.
//
// `?error=INVALID_TOKEN` is Better Auth's own answer for an expired or used
// link (one hour, `resetPasswordTokenExpiresIn`). It is shown as the way back
// to requesting a fresh one, not as a dead end.
//
// Mobbin: https://mobbin.com/screens/552e3ff3-cf85-40f7-8ecf-d3e2b6706630 (Venmo
// "Create a new password" — says up front that saving signs out every other
// device, which `revokeSessionsOnPasswordReset` makes true here) ·
// https://mobbin.com/screens/9cf60de8-12b0-40af-ba41-a32c9f8549fa (Klook — new
// and retype fields with the rule stated once beneath them) ·
// https://mobbin.com/screens/b0250709-b455-4a0b-bab6-5cbe5ccc379c (Aave — the
// length rule as live guidance under the field, not a post-submit error).
// Structure only; style stays on docs 02/08.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §6 · packages/auth/src/auth-email.ts
// SOT-KEYWORDS: reset password token new password better auth native zustand

import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Heading, TextField, useInstanceStore, useStore } from '@acme/ui';
import { authClient } from '../../providers/session';
import { GUARDIAN_PASSWORD_MIN_LENGTH } from './guardian/account';

export interface ResetPasswordContentProps {
  /** From the link: `moyo://onboarding/reset-password?token=…`. */
  token?: string;
  /** From the link when the token is spent or expired. */
  error?: string;
}

const tokenProblem =
  'That link has expired or has already been used. Links work for one hour — request a new one.';
const resetFailed = 'We couldn’t change the password just now. Try again in a moment.';
const done = 'Your password is changed. Sign in with the new one.';

type Feedback = { kind: 'error'; text: string } | { kind: 'notice'; text: string };

export function ResetPasswordContent({ token, error }: ResetPasswordContentProps) {
  const router = useRouter();
  const store = useInstanceStore(() => ({
    password: '',
    confirm: '',
    submitting: false,
    changed: false,
    feedback: (error ? { kind: 'error', text: tokenProblem } : null) as Feedback | null,
  }));
  const { password, confirm, submitting, changed, feedback } = useStore(store, (s) => s);
  const patch = (next: Partial<ReturnType<typeof store.getState>>) =>
    store.setState((s) => ({ ...s, ...next }));

  const lengthProblem =
    password.length > 0 && password.length < GUARDIAN_PASSWORD_MIN_LENGTH
      ? 'Twelve characters or more — length beats symbols.'
      : undefined;
  const matchProblem = confirm.length > 0 && confirm !== password ? 'These don’t match yet.' : undefined;
  const ready =
    Boolean(token) && password.length >= GUARDIAN_PASSWORD_MIN_LENGTH && confirm === password && !changed;

  const submit = async () => {
    if (!ready || submitting || !token) return;
    patch({ submitting: true, feedback: null });
    try {
      const res = await authClient.resetPassword({ newPassword: password, token });
      if (res.error) {
        patch({
          feedback: {
            kind: 'error',
            text: res.error.code === 'INVALID_TOKEN' ? tokenProblem : res.error.message ?? resetFailed,
          },
        });
        return;
      }
      patch({ changed: true, password: '', confirm: '', feedback: { kind: 'notice', text: done } });
    } catch {
      patch({ feedback: { kind: 'error', text: resetFailed } });
    } finally {
      patch({ submitting: false });
    }
  };

  return (
    <Section className="gap-group p-inset-roomy">
      <View className="gap-stack">
        <Heading level={1} size="title">
          Choose a new password
        </Heading>
        {!token && !error ? (
          <TWText className="text-body text-text">
            Open the link from your email on this device to get here, or request a new one.
          </TWText>
        ) : null}
      </View>

      <View className="gap-stack">
        <TextField
          label="New password"
          hint="Twelve characters or more. Length beats symbols."
          value={password}
          onChangeText={(next: string) => patch({ password: next, feedback: null })}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!submitting && !changed}
          error={lengthProblem}
          className="w-full"
        />
        <TextField
          label="Type it again"
          value={confirm}
          onChangeText={(next: string) => patch({ confirm: next })}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!submitting && !changed}
          error={matchProblem}
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
        {changed ? (
          <Button title="Sign in" onPress={() => router.replace('/onboarding/sign-in')} fullWidth size="lg" />
        ) : (
          <Button
            title={submitting ? 'Saving…' : 'Change password'}
            onPress={() => void submit()}
            disabled={!ready || submitting}
            fullWidth
            size="lg"
          />
        )}
        <Button
          title={token ? 'Back to sign in' : 'Request a new link'}
          onPress={() => router.push(token ? '/onboarding/sign-in' : '/onboarding/forgot-password')}
          variant="outline"
          fullWidth
        />
      </View>
    </Section>
  );
}
