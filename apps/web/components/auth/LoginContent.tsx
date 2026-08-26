'use client';
// The sign-in surface, optionally wearing a district's brand.
//
// One component for both `/login` and `/login/[org]`: the branded route resolves
// an organization and passes it in, and everything else is identical. Two files
// would have meant two forms, and the second one would have missed the next fix.
// SOT: docs/pack/06-auth-onboarding-spec.md §5 §7 · CLAUDE.md (UI)
// SOT-KEYWORDS: login sign-in co-branded district org lockup auth form web
import { useRouter } from 'next/navigation';
import { BrandLockup, Button, Text, TextField, useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import type { OrgBranding } from '@acme/app/server';
import { authClient } from '@/lib/auth-client';

export interface LoginContentProps {
  /** Absent on Moyo's own sign-in; present on a district's branded URL. */
  org?: OrgBranding;
}

export function LoginContent({ org }: LoginContentProps) {
  const router = useRouter();

  /*
    One store, not six `useState` calls — this codebase's state rule is zustand
    always. `useInstanceStore` holds a vanilla store in a ref, so the state is
    scoped PER MOUNT: a module-level `create()` would look equivalent and would
    silently share one email box between two mounted login forms.

    The form fields live together because they change together — one `patch`
    call per edit, one subscription, and no chance of a half-updated render
    where `loading` has flipped but `error` has not been cleared.
  */
  const store = useInstanceStore(() => ({
    mode: 'signin' as 'signin' | 'signup',
    email: '',
    name: '',
    password: '',
    error: null as string | null,
    loading: false,
  }));
  const { mode, email, name, password, error, loading } = useStore(store, (s) => s);
  const patch = (next: Partial<ReturnType<typeof store.getState>>) =>
    store.setState((s) => ({ ...s, ...next }));

  async function handleSubmit() {
    patch({ error: null, loading: true });
    try {
      if (mode === 'signin') {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message);
        router.push('/tutor');
      } else {
        const res = await authClient.signUp.email({ email, password, name });
        if (res.error) throw new Error(res.error.message);
        // New accounts go through the learner onboarding before landing in the app.
        router.push('/onboarding/learner');
      }
    } catch (err) {
      patch({ error: err instanceof Error ? err.message : 'Auth failed' });
    } finally {
      patch({ loading: false });
    }
  }

  /*
    The district is NAMED, not just pictured. A logo alone asks someone to
    recognise a mark at 56px; the sentence tells a parent they are in the right
    place, which is the only question this screen has to answer before the form.
  */
  const heading = mode === 'signin'
    ? org ? `Sign in to ${org.name}` : 'Sign in'
    : org ? `Join ${org.name}` : 'Create account';

  return (
    <View className="flex-1 items-center justify-center p-inset">
      <View className="w-full max-w-sm gap-section">
        {/*
          The lockup is the hero and the only bold moment on the page. Everything
          under it is deliberately quiet — a sign-in form competing with its own
          branding is a form people mis-key.
        */}
        <View className="items-center gap-group">
          <BrandLockup
            size="lg"
            orgName={org?.name}
            orgLogoUrl={org?.logoUrl}
            orgLogoAspect={org?.logoAspect}
            variant="marks"
          />
          <Text className="font-display text-display-sm text-text">{heading}</Text>
          {org ? (
            <Text variant="caption" tone="muted">Moyo, for {org.name}</Text>
          ) : null}
        </View>

        <View className="gap-group">
          {mode === 'signup' && (
            <TextField
              label="Your name"
              value={name}
              onChangeText={(name: string) => patch({ name })}
              autoComplete="name"
            />
          )}
          {/*
            Real labels, not placeholders. A placeholder disappears the moment
            someone types, so the one hint about what a field wanted is gone
            exactly when they are checking their work — and screen readers do not
            reliably announce it at all.
          */}
          <TextField
            label="Email"
            value={email}
            onChangeText={(email: string) => patch({ email })}
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
          />
          <TextField
            label="Password"
            hint="At least 12 characters."
            value={password}
            onChangeText={(password: string) => patch({ password })}
            secureTextEntry
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            error={error ?? undefined}
          />
          <Button
            fullWidth
            title={loading ? 'Signing in…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            onPress={handleSubmit}
            disabled={loading}
          />
        </View>

        <Button
          fullWidth
          variant="ghost"
          title={mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          onPress={() => patch({ mode: mode === 'signin' ? 'signup' : 'signin', error: null })}
        />
      </View>
    </View>
  );
}
