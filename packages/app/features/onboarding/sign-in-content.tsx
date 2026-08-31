'use client';
// Native email sign-in — the front door for adults.
//
// The form is plain, reachable, and kid-safe: no price, no pressure, and a
// clear way back. On success the root dispatcher picks the right shell.
// SOT: docs/pack/06-auth-onboarding-spec.md §2
// SOT-KEYWORDS: onboarding sign-in email password native moyo

import { useState } from 'react';
import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Heading, TextField } from '@acme/ui';
import { authClient } from '../../providers/session';

type SignInStatus = 'idle' | 'submitting' | 'success' | 'error';

export function SignInContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<SignInStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const ready = email.length > 0 && password.length > 0;

  const submit = async () => {
    if (!ready || status === 'submitting') return;
    setStatus('submitting');
    setMessage(null);
    try {
      await authClient.signIn.email({ email, password });
      setStatus('success');
      router.replace('/');
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof Error
          ? err.message
          : 'We couldn’t sign you in. Check your email and password and try again.',
      );
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
          onChangeText={setEmail}
          autoCapitalize="none"
          editable={status !== 'submitting'}
          className="w-full"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={status !== 'submitting'}
          className="w-full"
        />
        {status === 'error' && message ? (
          <TWText className="text-body text-danger">{message}</TWText>
        ) : null}
      </View>

      <View className="gap-stack">
        <Button
          title={status === 'submitting' ? 'Signing in…' : 'Sign in'}
          onPress={() => void submit()}
          disabled={!ready || status === 'submitting'}
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
