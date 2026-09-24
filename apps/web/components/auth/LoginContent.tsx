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
  Text,
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

/*
  The two notices. Both name the address the mail went to, because the single
  most common reason a link never arrives is that it went somewhere else — a
  typo, or the wrong one of two family addresses — and only the reader can spot
  that. Both say what to do next in the imperative; neither apologises, and
  neither blames.
*/
const verifyNotice = (address: string) =>
  `Confirm your email to sign in. We just sent a new link to ${address}. Open it and you'll be signed in.`;

const confirmNotice = (address: string) =>
  `Check your email. We sent a link to ${address}. Open it to confirm your account and finish setting up Moyo.`;

const resendFailed = 'We could not send a new link just now. Try again in a moment.';

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
  /*
    `error` and `notice` are two different states and are deliberately not one
    field. `error` is "you got something wrong" and renders red, on the password
    field. `notice` is "we did something, now go do the next bit" — an
    unverified account is not a mistake, and dressing it as a field error tells
    a parent their password is wrong when it was right.
  */
  const store = useInstanceStore(() => ({
    mode: initialMode,
    email: '',
    name: '',
    password: '',
    error: null as string | null,
    notice: null as string | null,
    loading: false,
  }));
  const { mode, email, name, password, error, notice, loading } = useStore(store, (s) => s);
  const patch = (next: Partial<ReturnType<typeof store.getState>>) =>
    store.setState((s) => ({ ...s, ...next }));

  async function handleSubmit() {
    patch({ error: null, notice: null, loading: true });
    /*
      Autofill and mobile keyboards both hand back a trailing space often
      enough that an untrimmed address is a real, self-inflicted lockout: the
      lookup misses and the screen says the password is wrong.
    */
    const address = email.trim();

    /*
      RELATIVE `callbackURL`, and a deliberate deviation from the Better Auth
      guidance to send an absolute one.

      This component also serves `/login/[org]` on `<slug>.moyolearn.com`, and
      NO `trustedOrigins` are configured in `createAuth` on this branch — so an
      absolute district-origin URL is rejected with INVALID_CALLBACKURL, and the
      branded door breaks while the plain one works. The constraint is the
      missing allow-list, not a limitation of Better Auth. A relative path is
      resolved against whichever origin served the request, which is the one
      behaviour that is correct on both hosts.
    */
    try {
      if (mode === 'signin') {
        const res = await authClient.signIn.email({
          email: address,
          password,
          callbackURL: '/tutor',
        });

        /*
          The client RESOLVES with `{ data, error }`; it does not throw. Reading
          `res.error` is the only way to see a failure — a bare try/catch here
          would treat every rejection as a success.
        */
        if (res.error?.code === 'EMAIL_NOT_VERIFIED') {
          // better-auth@1.7.2 has already re-sent the link by the time this
          // resolves (`emailVerification.sendOnSignIn`), so the copy can
          // promise a mail in the past tense.
          patch({ notice: verifyNotice(address) });
          return;
        }
        if (res.error) {
          patch({ error: res.error.message ?? 'We could not sign you in.' });
          return;
        }
        router.push('/tutor');
      } else {
        const res = await authClient.signUp.email({
          email: address,
          password,
          name,
          callbackURL: '/onboarding/learner',
        });
        if (res.error) {
          patch({ error: res.error.message ?? 'We could not create your account.' });
          return;
        }

        /*
          NO TOKEN MEANS NO SESSION. With `requireEmailVerification` on, sign-up
          succeeds and returns `token: null` — the account exists, nobody is
          signed in. Pushing to `/onboarding/learner` anyway sent the new parent
          to a gated route, where the proxy bounced them back to `/login` with
          nothing on screen to explain it. That was a second, independent way
          this form lost people.
        */
        if (!res.data?.token) {
          patch({ notice: confirmNotice(address) });
          return;
        }
        // New accounts go through the learner onboarding before landing in the app.
        router.push('/onboarding/learner');
      }
    } catch (err) {
      // Reached only by a genuine transport failure — the client resolves for
      // every response it can parse, including a 403.
      patch({ error: err instanceof Error ? err.message : 'Auth failed' });
    } finally {
      patch({ loading: false });
    }
  }

  /*
    THE MANUAL RESEND. Pressing Sign in again also re-sends, but only with the
    password retyped; this asks for nothing but the address already on screen.
    `/send-verification-email` answers `{ status: true }` for an unknown or
    already-verified address on purpose (no enumeration), so the only failure
    it can report is the sender itself — which is the one worth telling the
    reader about, in the same calm register, with the button still there.
  */
  async function handleResend() {
    const address = email.trim();
    patch({ error: null, loading: true });
    try {
      const res = await authClient.sendVerificationEmail({
        email: address,
        callbackURL: mode === 'signin' ? '/tutor' : '/onboarding/learner',
      });
      patch({
        notice: res.error
          ? resendFailed
          : mode === 'signin'
            ? verifyNotice(address)
            : confirmNotice(address),
      });
    } catch {
      patch({ notice: resendFailed });
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
        {/*
          ABOVE the button, not below it: this is the instruction for what to do
          instead of pressing it again, and a line underneath the primary action
          is a line most people never scroll to on a phone.

          `role="status"` (with the explicit `aria-live` it implies, because
          react-native-web does not always map the role to a live region on its
          own) announces the text without stealing focus — the reader keeps
          their place in the form. `role="alert"` would be wrong here: nothing
          has failed.

          Rendered as text rather than as the kit's `Banner`, which is the other
          real candidate. Banner is a bordered card with a 36px icon tile, sized
          for surface-level incident and entitlement notices; dropped between
          the password field and the submit button it outweighs the form it
          interrupts. Weight, not chrome, is what this line needs.
        */}
        {notice ? (
          <>
            <Text role="status" aria-live="polite" className="font-semibold">
              {notice}
            </Text>
            <Button
              fullWidth
              variant="ghost"
              title="Send the link again"
              onPress={handleResend}
              disabled={loading}
            />
          </>
        ) : null}
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
        // Both messages are cleared: a "check your email" line left standing
        // over a sign-in form is an instruction for a screen the reader has
        // just left.
        onPress={() =>
          patch({ mode: mode === 'signin' ? 'signup' : 'signin', error: null, notice: null })
        }
      />
    </TwoPaneShell>
  );
}
