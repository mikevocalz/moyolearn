# The password-reset contract, read out of the installed better-auth

<!--
What `emailAndPassword.sendResetPassword` actually receives, what the route
around it does, and the two things wiring the sender cannot fix. Read out of
better-auth 1.7.2 / @better-auth/core 1.7.2 in `node_modules`, not out of the
published docs, which have already drifted from this version once (`sendOnSignIn`
documents one default and ships another).
SOT: packages/auth/src/auth-email.ts · packages/auth/src/server.ts · docs/incidents/2026-09-22-login-lockout.md
SOT-KEYWORDS: password reset sendResetPassword better-auth token redirectTo callbackURL trustedOrigins enumeration timing idempotency learner placeholder
-->

**Date:** 2026-09-23 · **Status:** the sender is wired; findings 1 and 2 are open
as follow-ups #8 and #9 on the 2026-09-22 postmortem

---

## The correction that mattered most

**Password reset was not silently doing nothing.** The follow-up register in
`docs/incidents/2026-09-22-login-lockout.md` said it was, and that was repeated
without checking. `password.mjs` `/request-password-reset` lines 52-58: with no
`sendResetPassword` configured it logs *"Reset password isn't enabled. Please
pass an emailAndPassword.sendResetPassword function in your auth config!"* and
throws `BAD_REQUEST` with code `RESET_PASSWORD_DISABLED`.

The API hard-failed and said why. Anything that looked silent was the caller
swallowing it. That changed the fix: the server half was a loud
misconfiguration, and whatever UI calls it is the thing hiding the reason.

## The contract

`emailAndPassword.sendResetPassword`, `@better-auth/core/dist/types/init-options.d.mts:689`:

```ts
sendResetPassword?: (
  data: { user: User; url: string; token: string },
  request?: Request,
) => Promise<void>;
```

Byte-identical in shape to `emailVerification.sendVerificationEmail` in the same
file, so `sendVerificationEmailFor`'s parameter type transferred unchanged.

- **Expiry** — `resetPasswordTokenExpiresIn || 3600`, and nothing in
  `packages/auth/` overrides it. "One hour" in the copy is measured, not guessed,
  and matches the wording `verificationEmail` already uses.
- **The token is not a JWT.** `generateId(24)`, an opaque id stored as a
  verification row keyed `reset-password:<token>`. Still a bearer credential —
  it alone authorises the password change — so hashing it for the idempotency
  key still applies, for a different reason than the verification JWT.
- **URL** — `${baseURL}/reset-password/${token}?callbackURL=${encodeURIComponent(redirectTo ?? '')}`.
- **Enumeration protection is built in.** An unknown address gets a throwaway id,
  a dummy lookup for timing, and the same constant 200 body.

## Two findings that are not "wire the sender"

Both are recorded as follow-ups #8 and #9 on the postmortem.

**1. Every reset link is dead on arrival without `redirectTo`.** The request body
is `{ email, redirectTo? }`. Omit it and the link ends `?callbackURL=` — empty.
The GET callback then hits `if (!token || !callbackURL) throw redirectError(...)`:
zod accepted `''`, the truthiness check does not, and the user lands on
`${baseURL}/error?error=INVALID_TOKEN`. Whoever wires the UI must pass
`redirectTo` at the app's reset screen **and** add that origin to
`trustedOrigins` — it goes through `originCheck`. A `packages/auth`-only change
cannot close this.

**2. A token-driven reset on a managed learner is NOT blocked.**
`isRestrictedLearnerPasswordChange` in `packages/auth/src/server.ts` requires
`actorId === owner.id`. `/reset-password` runs with no session, so
`ctx.context.session?.user?.id` is `undefined`, the guard returns `false`, and
the reset proceeds. The available control is refusing the SEND for
`isPlaceholderEmail` addresses, which `create-learner.ts:63-70` already has
doctrine for: *"password reset for these accounts runs through the guardian
(§2), never through this address."* That refusal is what `sendResetPasswordFor`
implements.

Practical reachability is low — the address is `<uuid>@learners.invalid` with a
random UUID, and the endpoint's own enumeration protection means it cannot be
discovered — but the guard reads as though it covers this and does not.

Note the verification row is minted at line 76, *before* the sender runs, so
refusing the send still leaves an unused `reset-password:` row that expires in
an hour. Harmless, and no hook available to this package prevents minting it.

## A timing oracle the enumeration protection does not survive

`runInBackgroundOrAwait` (`create-context.mjs:214-224`) only backgrounds when
`advanced.backgroundTasks.handler` is set. It is not, so the Resend round-trip is
awaited inline — a real account answers measurably slower than an unknown one,
which undoes the constant-time care the route otherwise takes.

Closing it wants `advanced.backgroundTasks: { handler: (p) => waitUntil(p) }`,
and `@vercel/functions` is **not installed**. That is a dependency decision, not
something to slip into an auth change.

## What was decided when the sender was wired

- **One `AUTH_EMAIL_KINDS` map, not two constants.** `idempotencyKeyFor`
  hardcoded `verify-` and the thrown error hardcoded "the verification email".
  Reused as they stood, every reset failure would have been logged under the
  flow that did not fail. The map pairs the key prefix with the log label so the
  two cannot drift, and `sendAuthEmail` reads the label off `message.kind` —
  there is no argument a caller can pass wrongly.
- **The prefix is load-bearing, not tidy.** Resend's idempotency keys are
  account-global. The two token spaces come from different generators and will
  not collide on their own; the prefix is what guarantees it, and a test asserts
  the non-collision so nobody removes it as decoration.
- **`kind` is required, not defaulted to `'verification'`.** A default would let
  a third mail added later mint keys in the verification namespace without
  anyone writing the word "verify".
- **`revokeSessionsOnPasswordReset: true`**, against a shipped default of
  `false`. A reset is the path someone takes when they may have lost control of
  the account, and a stolen session that outlives the new password defeats the
  point of changing it. For doc 06 §2 it also means a guardian resetting a
  managed learner's password ends that learner's live sessions.
- **`onPasswordReset` left unset.** There is no audit sink in this package —
  Sentry has no DSN in production — so the hook could only `console.log`, which
  would be a second way to do the logging that follow-up #4 already owns.
- **The link text is the URL, matching `verificationEmail`.** A screen reader
  reads the whole thing aloud, which is verbose. Against that: a recipient who
  cannot click needs the address visible, and a recipient deciding whether to
  trust the mail needs to see where it goes first. Consistency with the mail
  already in production settled it.
- **Known accessibility gap, not closed here.** Neither mail's HTML declares a
  language (WCAG 2.1 3.1.1, Level A), so a screen reader guesses. Fixing it means
  wrapping both messages, which is a change to the verification mail this task
  had no reason to touch. Left visible rather than half-applied to one of the two.
