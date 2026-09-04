'use client';
// The sign-in surface, optionally wearing a district's brand.
//
// One component for both `/login` and `/login/[org]`: the branded route resolves
// an organization and passes it in, and everything else is identical. Two files
// would have meant two forms, and the second one would have missed the next fix.
// SOT: docs/pack/06-auth-onboarding-spec.md §5 §7 · docs/pack/37-onboarding-dual-pane.md §3.1 · CLAUDE.md (UI)
// SOT-KEYWORDS: login sign-in co-branded district org lockup auth form web two-pane autofill
import { useRouter } from 'next/navigation';
import {
  Button,
  Heading,
  TextField,
  TwoPaneShell,
  useInstanceStore,
  useStore,
  type TwoPaneBrand,
} from '@acme/ui';
import { View } from '@acme/ui/primitives';
import type { OrgBranding } from '@acme/app/server';
import { authClient } from '@/lib/auth-client';

export interface LoginContentProps {
  /** Absent on Moyo's own sign-in; present on a district's branded URL. */
  org?: OrgBranding;
  /**
   * Which half of the form opens. The route reads it from `?mode=signup` so the
   * marketing `Start learning` CTA lands on Create account rather than on a
   * sign-in form with the real action hidden behind a ghost button.
   */
  initialMode?: 'signin' | 'signup';
}

/**
 * The flagship tagline (doc 02 §Addendum B). It is the line that survives the
 * collapse to the brand band, so it has to work at 13px beside a 48px mark.
 */
const TAGLINE = 'Learn it by heart.';

/**
 * The pane-only second line, and the answer to the only question this screen
 * asks: whose door is this. A district gets named; Moyo's own door gets the
 * product sentence the marketing site already ships.
 */
const supportingLine = (orgName?: string) =>
  orgName
    ? `Moyo, for ${orgName}.`
    : 'AI tutoring that helps a child learn it by heart — and helps the parents, tutors, and teachers around them help better.';

export function LoginContent({ org, initialMode = 'signin' }: LoginContentProps) {
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
    mode: initialMode,
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

    The naming now happens twice on purpose and in two registers: the brand pane
    says whose product this is, the heading says what the button will do. On a
    phone the pane is a one-line band, so the heading carries it alone.
  */
  const heading = mode === 'signin'
    ? org ? `Sign in to ${org.name}` : 'Sign in'
    : org ? `Join ${org.name}` : 'Create account';

  /*
    Data, not nodes. `TwoPaneShell`'s brand slot takes no children at all, which
    is doc 37's "the brand pane contains zero interactive content" enforced by
    the type rather than by review — the mode toggle below physically cannot be
    put in the half of the screen that disappears at 767px.
  */
  const brand: TwoPaneBrand = {
    tagline: TAGLINE,
    supporting: supportingLine(org?.name),
    ...(org?.logoUrl
      ? { org: { name: org.name, logoUrl: org.logoUrl, logoAspect: org.logoAspect } }
      : {}),
  };

  return (
    <TwoPaneShell brand={brand}>
      {/*
        The kit's `Heading`, not a `Text` wearing display classes as this did
        before: it emits a real `<h1>`, so the page finally has one, and its
        size variant carries the `md:` step. A hand-rolled `text-display-sm`
        left `Text`'s own `md:text-body-lg` standing, and the heading shrank to
        body size on every desktop.
      */}
      <Heading level={1} size="display-sm">{heading}</Heading>

      <View className="gap-group">
        {mode === 'signup' && (
          <TextField
            label="Your name"
            value={name}
            onChangeText={(name: string) => patch({ name })}
            autoComplete="name"
            textContentType="name"
          />
        )}
        {/*
          Real labels, not placeholders. A placeholder disappears the moment
          someone types, so the one hint about what a field wanted is gone
          exactly when they are checking their work — and screen readers do not
          reliably announce it at all.

          `autoComplete` AND `textContentType` on every credential field
          (doc 38 §2.5 found `textContentType` at zero hits repo-wide). They are
          two different contracts, not a duplicate: the iOS keychain and Safari
          read `textContentType`, Android and every other browser read
          `autoComplete`, and a field carrying only one of them is offered a
          saved password on only some of the devices families actually use.
        */}
        <TextField
          label="Email"
          value={email}
          onChangeText={(email: string) => patch({ email })}
          inputMode="email"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
        />
        {/*
          The password hint splits with the mode. `new-password` /
          `newPassword` is what tells a manager to OFFER a generated password
          rather than search for a saved one — on a shared signin/signup form
          the wrong one either buries the suggestion or fills the old password
          into a field that is creating an account.
        */}
        <TextField
          label="Password"
          hint="At least 12 characters."
          value={password}
          onChangeText={(password: string) => patch({ password })}
          secureTextEntry
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          textContentType={mode === 'signin' ? 'password' : 'newPassword'}
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
    </TwoPaneShell>
  );
}
