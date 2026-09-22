# Postmortem: email verification was required with no way to verify

<!--
The 2026-09-22 login lockout: `requireEmailVerification` was on in production
while no `emailVerification.sendVerificationEmail` existed anywhere in the repo.
Holds the debug report, the blameless postmortem, and the follow-up register.
SOT: packages/auth/src/server.ts · docs/pack/06-auth-onboarding-spec.md §2 §6
SOT-KEYWORDS: incident postmortem login lockout email verification EMAIL_NOT_VERIFIED handoff learner resend better-auth
-->

**Date:** 2026-09-22 · **Severity:** SEV1 · **Status:** fix in review, not yet deployed
**Affected:** every device handoff for a managed learner (live), and every adult
account created from 2026-09-02 onward (latent)

---

## Summary

`createAuth()` required a verified email address before sign-in but never
configured anything that could send a verification email. better-auth@1.7.2
refuses an unverified sign-in outright when no sender is configured, so the
accounts it locked had no route to the link that would unlock them.

The adult sign-in path escaped real damage by luck: all 23 non-managed accounts
were already verified before the flag began to bite. The learner path did not.
All 14 guardian-managed learners carry `emailVerified = false` and a deliberately
undeliverable address, so every device handoff in production has been failing —
and burning the child's single-use code on the way.

## Impact

| Population | Rows | State | Effect |
|---|---|---|---|
| Managed learners | 14 | `emailVerified = false`, `@learners.invalid` address | Every `sign-in/username` returns 403. The handoff code is consumed first, so each attempt destroys the credential. |
| Adult accounts | 23 | already verified | No effect yet. |
| Adult accounts created after the fix ships | — | unverified at creation | Would have been permanently locked without this change. |

Counts are from `better_auth."user"` in production, 37 rows total, read
2026-09-22.

**No production log confirmation exists.** Vercel's runtime-log retention on this
plan does not reach back to 2026-09-02, so there is no recorded
`EMAIL_NOT_VERIFIED` response to point at. The evidence base is the database
counts above and the installed better-auth source, plus a local reproduction on
a real 1.7.2 instance.

## Timeline

| Date | Event |
|---|---|
| 2026-08-24 | `requireEmailVerification` lands in commit 89b8326, "Wave 3 opens: the Better Auth foundation behind the mock-session seam". `git log -S requireEmailVerification -- packages/auth/src/server.ts` returns this commit and no other, so the flag has been on and senderless for 29 days. |
| 2026-09-02 | First user rows written. 14 managed learners created with `emailVerified = false`. |
| 2026-09-02 → 09-03 | 23 adult accounts created and verified. |
| 2026-09-03 | Newest row in `better_auth."user"`. No account has been created in the 19 days since. That is **consistent** with the defect and is not evidence of it — zero traffic and broken sign-up are indistinguishable from row counts, and no runtime logs reach back far enough to separate them. |
| 2026-09-22 | Investigation opens on a reported login failure. |
| 2026-09-22 | Root cause confirmed against `node_modules/better-auth/dist` and reproduced locally on a memory adapter. |
| 2026-09-22 | Database counts read; learner path identified as the live outage and the adult path as latent. |
| 2026-09-22 | Fix written on `fix/login-verification-natalie-voice`. Not deployed. |

## Root cause

`packages/auth/src/server.ts` set, inside `emailAndPassword`:

```ts
requireEmailVerification: process.env.NODE_ENV !== 'development',
```

and defined no `emailVerification` key. Searching `packages` and `apps` for
`emailVerification`, `sendVerificationEmail`, `sendResetPassword` and
`RESEND_API_KEY` returned zero hits repo-wide.

better-auth@1.7.2, `dist/api/routes/sign-in.mjs:340-352`:

```js
if (ctx.context.options?.emailAndPassword?.requireEmailVerification && !user.emailVerified) {
  if (!ctx.context.options?.emailVerification?.sendVerificationEmail)
    throw APIError.from("FORBIDDEN", BASE_ERROR_CODES.EMAIL_NOT_VERIFIED);
  if (ctx.context.options?.emailVerification?.sendOnSignIn) { /* mint, build url, send */ }
  throw APIError.from("FORBIDDEN", BASE_ERROR_CODES.EMAIL_NOT_VERIFIED);
}
```

The username plugin repeats it almost verbatim at
`dist/plugins/username/index.mjs:195-207`, which is what puts learners in scope.

Two details in that code decided the shape of the fix:

- `sendOnSignIn` is read as a plain truthy flag with **no default**, and the
  installed types document it `@default false`. Published guidance suggests a
  sign-in resend happens automatically; the installed code disagrees, and the
  installed code is what runs. Left unset, every already-locked account stays
  locked even after a sender is wired.
- Verification is checked *after* the password is verified, so the 403 is
  genuinely "right credentials, unverified account" rather than a disguised
  auth failure.

### Why the learner half is a deadlock rather than a backlog

A managed learner cannot be verified by any path the running system offers:

1. `create-managed-learner.ts:46` assigns `learnerPlaceholderEmail(randomUUID())`,
   which `create-learner.ts:72` renders as `<uuid>@learners.invalid` — RFC 2606
   reserved and undeliverable on purpose (doc 06 §2: a child carries no email).
2. `isRestrictedLearnerUpdate` in `server.ts` aborts any write containing
   `emailVerified` for a `guardianManaged` user.

So nothing can deliver the mail and nothing may set the flag. Only a migration
can move those rows.

### Five whys

1. Why can a learner not sign in? → `sign-in/username` returns 403 EMAIL_NOT_VERIFIED.
2. Why? → `requireEmailVerification` is on and their `emailVerified` is false.
3. Why is it false? → Nothing ever set it, and no verification mail can reach an `@learners.invalid` address.
4. Why was a flag that gates sign-in never wired to a sender? → The flag and the sender live in two different option blocks, and the type system treats a config with one and not the other as valid.
5. Why did nobody notice for three weeks? → The failing path is anonymous, has no alert, and returns the same opaque response as a bad code; the adult path that people did exercise happened to hold only pre-verified accounts.

## The fix

| Change | File |
|---|---|
| Resend sender over `fetch`, with config reader, HTML escaping, hashed idempotency key, recipient-safe errors | `packages/auth/src/auth-email.ts` (new) |
| Wire `emailVerification` with `sendOnSignUp`, `sendOnSignIn`, `autoSignInAfterVerification`; log loudly when the sender is missing | `packages/auth/src/server.ts` |
| Refuse to mail `@learners.invalid` placeholders | `packages/auth/src/auth-email.ts` (`sendVerificationEmailFor`) |
| Managed learners born verified, in the same write as the restricted flags | `packages/auth/src/payload-learner-writer.ts` |
| Backfill the 14 existing learners | `packages/payload/migrations/learner_email_verified_backfill.sql` (**not run**) |
| Surface EMAIL_NOT_VERIFIED as a notice, stop navigating on a session-less sign-up, trim the email | `apps/web/components/auth/LoginContent.tsx` |
| Same, plus read `res.error` instead of a catch that never fires | `packages/app/features/onboarding/sign-in-content.tsx` |
| Log the swallowed session-check error | `apps/web/proxy.ts` |

Verification stays required when the sender is missing. Falling back to
`requireEmailVerification: false` would turn an unset environment variable into
a silent removal of a control doc 06 §6 requires in production, which is a
security regression wearing the costume of a fix. A missing sender now writes an
explicit error to the log at construction time instead.

### Deployment order

The migration and the environment variables both have to land before or with the
deploy:

1. Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` on a Resend-verified sending
   domain. Without both, `readAuthEmailConfig` returns null, the sender stays
   unwired, and the lockout continues — now with an error in the log.
2. Run `packages/payload/migrations/learner_email_verified_backfill.sql`.
3. Deploy.

Running the migration first is safe on the current build: those rows already
cannot sign in, and marking them verified only removes a gate that nothing else
depends on.

### Environment state, confirmed on Vercel

Read from the `moyo-app` production project (`prj_uJ8B9iXgebbLOTjdCA3X5iI4UVeN`,
team `mX1PFEtoLv4jzzBZJ5361PAr`), 33 variables, 2026-09-22.

**`RESEND_API_KEY` and `AUTH_EMAIL_FROM` are absent in every environment.** That
is the state production is in now, so on the first boot after this deploy
`createAuth` will write its missing-sender `console.error`. That line is the fix
reporting the environment correctly, not a new fault — worth saying in the PR
description so nobody reverts on seeing it.

### The preview-verification step cannot run as written

All 33 variables target `production` only. There are **zero** Preview-scoped
variables — no `DATABASE_URL`, no `BETTER_AUTH_SECRET`, no
`NEXT_PUBLIC_AUTH_MODE`. A preview deployment therefore boots with no database,
and with `NEXT_PUBLIC_AUTH_MODE !== 'live'` the first line of
`apps/web/proxy.ts` returns `NextResponse.next()` for every request, bypassing
the session gate entirely.

So "deploy to a preview, sign up a QA account, confirm the email arrives" is not
executable. Two real options:

| Option | What it costs | What it proves |
|---|---|---|
| **A — Preview-scope the auth variables.** `DATABASE_URL` (pointing at a non-production database), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_AUTH_MODE=live`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`. | Six variables, and a database for previews to point at. | The whole path, repeatably, without touching production data. |
| **B — Verify on production after deploy with a throwaway account.** | A real row in the production user table, to be deleted afterwards. | The whole path, once, against the real sending domain. |

**Recommended: B for this hotfix, A as follow-up #7.** The lockout is live on the
learner path and option A's setup is larger than the fix itself; B confirms the
same behaviour today. B also tests the one thing a preview could not — that the
production `AUTH_EMAIL_FROM` domain is actually verified at Resend, which is the
most likely remaining failure and the one that would leave the lockout in place
after a green deploy.

Verification steps for option B, after the deploy and the migration:

1. Sign up a throwaway address on `/login`. Expect the "Check your email" notice
   and **no** navigation.
2. Confirm the mail arrives from `AUTH_EMAIL_FROM`; open the link. Expect a
   redirect to `/onboarding/learner` with a session cookie set.
3. Sign out, sign in again. Expect success.
4. Separately, attempt a sign-in on an unverified account. Expect the notice
   copy and a fresh mail.
5. Redeem a real device-handoff code for one of the 14 backfilled learners.
   Expect a session rather than a 403.
6. Delete the throwaway account.

---

## Debug report

**Expected:** an account with the right password signs in.
**Actual:** 403 `EMAIL_NOT_VERIFIED`, forever, with no email ever sent.

**Reproduction** — a real better-auth@1.7.2 instance on `memoryAdapter`, two
instances sharing one store so the second is "the same deployment after the
fix" acting on an account created before it:

```
better-auth version: 1.7.2

(a) NO emailVerification.sendVerificationEmail — the production config today
  sign-up status           200
  sign-up token            null
  user row created         true
  sign-in #1 status        403
  sign-in #1 code          "EMAIL_NOT_VERIFIED"
  sign-in #1 message       "Email not verified"
  sign-in #2 status        403
  sign-in #2 code          "EMAIL_NOT_VERIFIED"
  sign-in #2 message       "Email not verified"
  emails sent              0

(b) SAME account, sender wired + sendOnSignIn: true
  sign-in status           403
  sign-in code             "EMAIL_NOT_VERIFIED"
  emails sent              1
  sent to                  "locked-out@example.test"
  link                     http://localhost:3000/api/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImxvY2tlZC1vdXRAZXhhbXBsZS50ZXN0IiwiaWF0IjoxNzkwMTE3NzA0LCJleHAiOjE3OTAxMjEzMDR9.NRzUTPhEfFoL6GC2Gj48S6ahjbWknnWCcNynCGH4YzQ&callbackURL=%2Ftutor

(c) GET the link
  status                   302
  location                 /tutor
  set-cookie names         better-auth.session_token
  emailVerified in db      true

(d) sign in again
  status                   200
  has session token        true
  user email               "locked-out@example.test"
  total emails sent        1

RESULT: all four legs behaved as predicted
```

Three things that run fell out of that trace:

- `sign-up token: null` — with verification required, sign-up creates the
  account and no session. The web form was navigating to a gated route on that
  response, which is the second, independent login bug fixed here.
- The token's `iat`/`exp` differ by 3600 seconds, so "the link works for one
  hour" in the email copy is the measured default, not an assumption.
- The token is a signed JWT. It is a bearer credential for the account, which is
  why the Resend `Idempotency-Key` carries `sha256(token)` and never the token.

A second probe drove the real Better Auth **client** against the same handler:

```
signUp.error       : null
signUp.data?.token : null
signIn threw?      : false
signIn.error       : {"message":"Email not verified","code":"EMAIL_NOT_VERIFIED","status":403,"statusText":"FORBIDDEN"}
signIn.error.code  : "EMAIL_NOT_VERIFIED"
wrongPw.error.code : "INVALID_EMAIL_OR_PASSWORD"
wrongPw.error.status: 401
```

That confirms both client-side assumptions: `res.error.code` is exactly
`EMAIL_NOT_VERIFIED`, and the client resolves rather than throws — so the
`try`/`catch` in `sign-in-content.tsx` was catching nothing and a wrong password
was reaching `router.replace('/')` as if it had succeeded.

**Prevention**

- `packages/auth/src/auth-email.test.ts` — 19 assertions over config reading,
  escaping, the idempotency key, the request shape, and error redaction.
- `packages/auth/src/learner-verification.test.ts` — a placeholder address
  produces zero requests; a managed learner is created with `emailVerified: true`
  in one write; the restricted hook does not refuse that write and still refuses
  a later self-verification.
- The `console.error` in `createAuth` makes a missing sender visible at boot
  rather than at a stranger's first sign-in attempt.

---

## What went well

- The database counts were pulled before the fix was finalised, which turned a
  believed adult outage into the correct finding: the live damage was on the
  learner path, and the originally specified fix would have made it worse by
  POSTing bounces to Resend for every `@learners.invalid` address.
- Every Better Auth option used here was verified against the installed
  `.d.ts` and `.mjs` rather than the published documentation, which is how the
  `sendOnSignIn` default was caught.

## What went poorly

- Three weeks passed with the child-onboarding path down and nothing reported
  it.
- The handoff redeem route burns a single-use code before attempting the
  sign-in, so every failed attempt also destroyed a credential a guardian had to
  regenerate. The anti-brute-force reasoning for that order is sound; pairing it
  with a sign-in that could never succeed was not foreseen.
- The absence of log retention meant the outage could not be confirmed from
  production telemetry at all.

## Follow-ups

Blameless: each of these is a gap in a system, not in a person's work.

| # | Item | Why it matters | Priority |
|---|---|---|---|
| 1 | `emailAndPassword.sendResetPassword` is unwired, exactly as `sendVerificationEmail` was. Password reset silently does nothing today. | Same class of bug as this incident, still live. Deliberately out of scope for this hotfix. | P1 |
| 2 | `isRestrictedLearnerUpdate` compares against `ctx.context.session.user` — the **acting** user, not the row being written (`packages/auth/src/server.ts`, `databaseHooks.user.update.before`). | Not currently exploitable, and the severity here was lowered from P0 after checking. Every route that reaches this hook with a session writes to the acting user's own id: `/update-user` at `node_modules/better-auth/dist/api/routes/update-user.mjs:57` and `/change-email` at `:471` both pass `session.user.id` as the target, so actor and target coincide and the rule fires correctly on exactly the case doc 06 §2 was written against — a learner acting on itself. Server-side `internalAdapter` writes carry no session, so `existing` is `{}` and the rule declines; that is load-bearing, because the learner writer depends on it. What is wrong is the reasoning, not today's behaviour: the hook reads as though it guards the target row, and the first plugin or route that updates a user other than the session's would silently pass. Rewrite it to read the row being written. | P2 |
| 3 | `redeemDeviceHandoff` burns the code before the sign-in can fail (`packages/auth/src/handoff.ts:145`). | A recoverable sign-in failure still costs the family a code. Consider burning on success or on a non-retryable failure only. | P2 |
| 4 | No alert on authentication failure rate, and no log retention reaching back far enough to reconstruct one. | This outage was invisible for three weeks. | P1 |
| 5 | Nothing prevents `requireEmailVerification` being true while no sender exists. The `console.error` reports it; it does not stop it. | A build-time or boot-time assertion would make this class unrepresentable. | P2 |
| 6 | No manual "resend the link" affordance. The resend is a side effect of attempting sign-in again. | Every comparable product surveyed offers an explicit button. | P2 |
| 7 | No Preview-scoped environment variables at all on `moyo-app`, so previews cannot exercise auth and `proxy.ts` short-circuits its own gate there. | Any auth change is unverifiable before production, which is how this one reached it. | P1 |
