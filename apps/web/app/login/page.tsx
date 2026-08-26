'use client';
// /login — dev sign-up / sign-in for real Better Auth sessions.
// SOT: docs/pack/06-auth-onboarding-spec.md §7
// SOT-KEYWORDS: login page auth sign-up sign-in email password better-auth
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { authClient } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message);
      } else {
        const res = await authClient.signUp.email({ email, password, name });
        if (res.error) throw new Error(res.error.message);
      }
      router.push('/tutor');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setLoading(false);
    }
  }

  const submitTitle = mode === 'signin' ? 'Sign in' : 'Sign up';

  return (
    <View className="flex-1 items-center justify-center p-inset">
      <View className="w-full max-w-sm gap-group">
        <Text className="font-sans text-display text-text">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </Text>
        <View className="gap-group">
          {mode === 'signup' && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="rounded-md border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-md border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (12+ characters)"
            minLength={12}
            className="rounded-md border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted"
          />
          {error ? (
            <Text className="font-sans text-body text-danger">{error}</Text>
          ) : null}
          <Button fullWidth title={loading ? '...' : submitTitle} onPress={handleSubmit} />
        </View>
        <Button
          fullWidth
          variant="ghost"
          title={mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        />
      </View>
    </View>
  );
}
