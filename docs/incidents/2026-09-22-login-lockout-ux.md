# Sign-in verification notice — UX chain

<!--
The design work behind the two sign-in screens changed by the 2026-09-22 login
lockout fix: research, references, handoff spec, tokens, copy, accessibility,
critique, code review.
SOT: docs/incidents/2026-09-22-login-lockout.md · docs/pack/06-auth-onboarding-spec.md §5 §7
SOT-KEYWORDS: login sign-in verification notice ux copy tokens accessibility mobbin critique review
-->

Covers `apps/web/components/auth/LoginContent.tsx` and
`packages/app/features/onboarding/sign-in-content.tsx`. The engineering account
of the incident is in [2026-09-22-login-lockout.md](./2026-09-22-login-lockout.md).

---

## 1. Research note

**Question.** A parent enters the right email and the right password and is
refused because the address was never confirmed. What does the screen have to do
so they get in rather than give up?

**Method.** Desk research: the failure is fully characterised from the code and
the database, and the population is 14 families whose children cannot sign in
right now. Interviewing them costs days the fix does not have. This is a
competitive-pattern review against a known behaviour, not a discovery study.
Recorded as a limitation rather than dressed up as fieldwork.

**Who is on this screen.**

| Person | State | What they need |
|---|---|---|
| A parent signing in | Right credentials, unconfirmed address | To learn nothing is wrong with what they typed, and that the next step is in their inbox |
| A parent just signing up | Account created, no session | To know the account exists and what happens next, instead of being bounced to a login screen |
| A guardian handing a child a device | Learner account, no mailbox | Nothing on this screen — their path is the handoff code, fixed server-side |

**What makes this failure unusually punishing.**

1. **It reads as a lie.** The credentials were correct. Styling the response as a
   password error tells someone their memory is wrong when it was right, and
   people respond by trying variations of a password that already worked, then
   by resetting it.
2. **The remedy is off-screen.** Every other form error is fixable in the form.
   This one is fixable only in an email client, so the message must say so
   explicitly or the reader stays and retries.
3. **The address is the likely fault.** When the mail never arrives, the usual
   cause is that it went to a different address — a typo, or the other of two
   family addresses. Only the reader can catch that, and only if the screen
   shows them where it went.
4. **Repetition is the recovery.** better-auth re-sends the link on each sign-in
   attempt, so the instinctive "try again" is the correct action. Worth saying
   in the past tense — "we just sent a new link" — so a second attempt does not
   feel like the first one failed.

**Success.** The reader leaves for their inbox rather than retrying the password,
and they can tell from the screen which address to open.

---

## 2. Mobbin reference board

Twelve screens, pulled 2026-09-22 via `search_screens` on two queries:
"email verification sent" and "sign in unverified email". Structure and copy
only — Moyo's own visual language is unchanged.

### Confirmation after a link is sent

| Screen | What it does | Taken / left |
|---|---|---|
| [Render](https://mobbin.com/screens/a60e7f5e-e551-484c-92f4-9602f8597695) | "Almost there!" then "We've sent you an email at **samlee.mobbin+1@gmail.com**. Please follow the instructions in the email." Address in bold. Explicit **Resend Verification Email** button. | **Taken:** bolding the address. **Left:** a manual resend button (follow-up #6 in the postmortem). |
| [Amplitude](https://mobbin.com/screens/f70cf7e2-85e9-4cf6-859c-8b28d458e7d9) | "We've sent a verification email to **samlee@content-mobbin.com** / Click the button in your email to activate your account." Resend Email and Return to Signup beneath. | **Taken:** address on its own line, instruction under it. **Left:** the illustration — this notice lives inside a form, not on its own screen. |
| [Slite](https://mobbin.com/screens/8c41dee5-5ae0-4551-9487-62cdf3b65110) | "Thanks for confirming your email address, Samlee. We've just sent a verification link to alexsmith@content-mobbin.com." Past tense, named address. | **Taken:** the past tense — the mail is already gone by the time this renders. |
| [SuperHi](https://mobbin.com/screens/5e3f1215-04bd-47f3-a609-286f33fc25ed) | "We've sent you an email!" then "We've just sent you a sign in link to your email address." | **Left:** "your email address" names nothing, so a reader who mistyped cannot tell. This is the pattern the notice deliberately avoids. |
| [Productboard](https://mobbin.com/screens/7896a50d-b81c-4016-be46-2eb885c3b4f7) | "Done, instructions sent! Check your email **alexsmith@content-mobbin.com** and follow the instructions." Open Gmail / Outlook / Yahoo buttons. | **Left:** webmail deep-links. Real, but scope for a later pass. |
| [Fey](https://mobbin.com/screens/a705b67b-4659-461a-a8e4-26da713832ff) | "Check your inbox / We have sent you a secure login link. Please click the link to authenticate your account." Address shown in a read-only field. | **Left:** "authenticate your account" — register is wrong for a parent. |

### The unverified sign-in itself

| Screen | What it does | Taken / left |
|---|---|---|
| [ElevenLabs](https://mobbin.com/screens/25f699af-b87b-4941-a1bc-e57335ce9d16) | A modal titled "Email Verification" over a blurred form: "Almost there! Please sign in once more with the same credentials you used to sign up to complete the verification process." | **Left, deliberately.** A modal steals focus, hides the form, and must be dismissed before the reader can act. The copy also asks them to sign in again without saying an email is involved. This is the closest analogue to our exact case and the clearest example of what not to do. |
| [Clay](https://mobbin.com/screens/87d8dbd4-35f0-4d9a-bbf4-237b0e69219b) | "Check your email / We sent an email to samlee.mobbin@gmail.com. It has a link that will sign you in." Plus a code-entry alternative and "Can't find our email? Check your spam folder!" | **Taken:** "a link that will sign you in" — states the outcome, which is exactly what `autoSignInAfterVerification` delivers. **Left:** the spam-folder line, worth adding later. |
| [Loops](https://mobbin.com/screens/74845a20-3a31-4cab-b895-bb647f771421) | "A link was sent to **alexsmith.mobbin+1@gmail.com** to continue the sign in process." | **Taken:** naming the address inside a sign-in flow rather than on a separate page. |
| [Descript](https://mobbin.com/screens/8c480ea3-da6b-4dae-abd8-33caba4aef56) | "Check your email for help signing in." | **Taken:** the opening imperative for the sign-up notice. |
| [Attio](https://mobbin.com/screens/8065014b-478d-4d7b-b838-b101e2b7273f) | Red inline text under the email field: "Please retry with a company email." | **Reference for the other register.** This is what a genuine field error looks like here, and why the verification notice must not look like it. |
| [Churnkey](https://mobbin.com/screens/34fa6645-1b44-4aa7-9ffe-cc6af4cd2aba) | Top-right toast, "Check your email for instructions", while the form sits untouched on the left. | **Left.** Detached from the form, dismissible, and gone before a distracted parent reads it. Instruction text belongs in the flow. |

**What the board settles.** Nine of the twelve name the recipient address; the
one that does not (SuperHi) is visibly the weakest. None of the twelve styles
the message as a field error. One (ElevenLabs) uses a modal, and it is the least
usable of the set.

---

## 3. Design handoff — the notice state

### Where it sits

Between the password field and the submit button, inside the existing
`gap-group` field stack. Nothing else moves; the notice inserts and the button
shifts down by one stack gap.

```
  [ Your name ]        (sign-up only)
  [ Email ]
  [ Password ]         error prop renders red under this field
  ─────────────────────────────────────
  NOTICE                <- new, role="status"
  ─────────────────────────────────────
  [ Sign in / Create account ]
  [ ghost: mode toggle ]
```

Above the button because the notice tells the reader what to do *instead of*
pressing it again. Placed below, on a phone it lands under the fold at the exact
moment the reader is deciding whether to retry.

### States

| State | `error` | `notice` | Renders |
|---|---|---|---|
| Idle | null | null | Form only |
| Submitting | null | null | Button label "Signing in…", button disabled |
| Wrong password | message | null | Red text under the password field |
| Unverified sign-in | null | verify copy | Notice above the button; no navigation |
| Sign-up, no session | null | confirm copy | Notice above the button; no navigation |
| Success | null | null | Navigate |

`error` and `notice` are separate fields and never both set. Every submit clears
both first, and the mode toggle clears both — a "check your email" line left
standing over a freshly-switched sign-in form is an instruction for a screen the
reader has left.

### Behaviour

- **No navigation** in either notice state. The previous build pushed to
  `/onboarding/learner` on a session-less sign-up, and the proxy bounced the
  reader back to `/login` with nothing on screen.
- **Retry is the resend.** better-auth re-sends on each sign-in attempt
  (`sendOnSignIn`), so pressing Sign in again is a valid action and the copy is
  written in the past tense to match.
- **Email is trimmed** before submit. Autofill trailing whitespace was its own
  silent lockout.
- The notice persists until the next submit or a mode switch. It is not
  dismissible and not transient — compare the Churnkey toast, which disappears
  before a distracted parent reads it.

### Native parity

`sign-in-content.tsx` carries the same copy, the same placement, and the same
two registers. It adds `accessibilityLiveRegion="polite"` alongside `aria-live`
because react-native-web maps neither attribute from the other, and it uses a
single live region for both registers so a second message replaces the first
rather than stacking beneath it.

---

## 4. Design system — token diff

**New tokens added: none.** `packages/theme/tokens.ts` is untouched.

| Element | Classes | Source |
|---|---|---|
| Web notice | `Text` default variant + tone, `className="font-semibold"` | `body` variant from the `uiRamp`; `text-text` from the default tone |
| Native notice | `text-body font-semibold text-text` | Same pair, written in the `@acme/ui/tw` idiom the file already uses |
| Native error | `text-body text-danger` | Unchanged from the previous build |
| Spacing | Inherited `gap-group` on the field stack | No new spacing value |

### Tones considered and rejected

Both rejections are contrast failures, measured against `surface` light
(`ink.50` `#FFFDF7`) using the WCAG 2.1 relative-luminance formula:

| Candidate tone | Colour | Ratio on `surface` light | AA normal text |
|---|---|---|---|
| `tone="primary"` | `sun.300` `#FFC547` | **1.55:1** | Fails |
| `tone="accent"` | `ember.500` `#F7418F` | **3.38:1** | Fails |
| `tone="default"` (chosen) | `ink.950` `#0D0C0B` | **19.21:1** | Passes |

Moyo's brand colours are a fill language — electric yellow and hot pink are
surfaces that carry `on-*` ink, which is exactly why `on-primary` and
`on-accent` exist. Neither survives as body text on paper. Emphasis therefore
comes from weight rather than hue, which is also what CLAUDE.md asks for:
hierarchy from size, weight and space.

### `Banner` considered and rejected

`packages/ui/Banner.tsx` is the kit's inline status notice and was the strongest
alternative — right role semantics, right tone set, already built. It is a
bordered card with a 36px icon tile, built for surface-level incident and
entitlement notices. Dropped between the password field and the submit button it
outweighs the form it interrupts, and its `info` tone tile is `bg-primary`
electric yellow, which reads as an alarm at that size. Recorded here so the next
person does not have to re-derive it.

---

## 5. Copy table

| Key | Surface | String | Why |
|---|---|---|---|
| `verifyNotice` | Both sign-in forms | `Confirm your email to sign in. We just sent a new link to {email}. Open it and you'll be signed in.` | Opens with the action. Names the address so a mistype is visible. "just sent" is past tense because the mail is already gone by render. Closes with the outcome — `autoSignInAfterVerification` means opening the link really does sign them in. |
| `confirmNotice` | Web sign-up | `Check your email. We sent a link to {email}. Open it to confirm your account and finish setting up Moyo.` | Same shape, different destination: sign-up continues into onboarding rather than into the tutor. |
| Email subject | Verification mail | `Confirm your email for Moyo` | Verb first, product named — it has to be identifiable in a crowded inbox. |
| Email body | Verification mail | `Confirm your email address to finish setting up your Moyo account:` / `The link works for one hour. If you didn't ask for it, ignore this email — nothing changes until the link is opened.` | One instruction, one expiry, one opt-out. "one hour" is the measured 1.7.2 default (3600s), not an estimate. |
| Sign-in fallback error | Both | `We could not sign you in.` | Only when Better Auth returns no message. |
| Sign-up fallback error | Web | `We could not create your account.` | Same. |

### Rules applied

- **No apology.** "Sorry" invites the reader to treat this as our failure to
  absorb rather than a step they take. Nothing here went wrong.
- **No blame.** No "you must", no "you failed to". The address was never
  confirmed; nobody neglected anything.
- **Second person, active, imperative.** "Open it", not "the link should be
  opened".
- **Contractions kept** (`you'll`, `didn't`) — this is a product for families,
  and the marketing voice already uses them.
- **No jargon.** "Verify", "authenticate", "credentials" and "token" appear
  nowhere in reader-facing copy. Compare Fey's "authenticate your account".
- **The address is never truncated or masked.** Its whole job is to be checked.

### Rejected drafts

| Draft | Why not |
|---|---|
| "Your email is not verified." | States a system fact and gives no next step. This is what the red field error would have said. |
| "Please verify your email address to continue." | "Please" plus a passive construction, and "verify" is our word, not theirs. |
| "We sent a verification link. Check your inbox." | Names no address, which the reference board shows is the weakest variant. |
| "Almost there!" | Cheerful throat-clearing that delays the instruction. Two of the references open this way; neither is better for it. |

---

## 6. Accessibility review — WCAG 2.1 AA

**Scope:** the notice state on both sign-in screens. **Date:** 2026-09-22.
Ratios computed from `packages/theme/tokens.ts` with the WCAG relative-luminance
formula. Everything below is a static review of code and tokens; no screen
reader or keyboard session was run on a built page, and that gap is listed at
the end.

### Contrast

| Element | Foreground | Background | Ratio | Required | Pass |
|---|---|---|---|---|---|
| Notice, light | `text` `ink.950` `#0D0C0B` | `surface` `ink.50` `#FFFDF7` | 19.21:1 | 4.5:1 | Pass |
| Notice, dark | `text` `ink.100` `#F6F3E8` | `surface` `ink.900` `#171614` | 16.28:1 | 4.5:1 | Pass |
| Field error, light | `danger` `#D31F2B` | `surface` light | 5.16:1 | 4.5:1 | Pass |
| Field error, dark | `danger` `#FF7A85` | `surface` dark | 7.21:1 | 4.5:1 | Pass |
| Password hint, light | `text-muted` `ink.600` | `surface` light | 7.67:1 | 4.5:1 | Pass |
| Password hint, dark | `text-muted` `ink.300` | `surface` dark | 9.91:1 | 4.5:1 | Pass |

Both rejected tones would have failed: `tone="accent"` at 3.38:1 and
`tone="primary"` at 1.55:1. Choosing by contrast rather than by brand is the
single reason this section has no critical finding.

### Findings

#### Perceivable

| # | Issue | Criterion | Severity | Status |
|---|---|---|---|---|
| 1 | Notice is conveyed by text, not by colour alone — it reads identically in greyscale and to anyone with a colour-vision deficiency. | 1.4.1 Use of Colour | — | Pass by design |
| 2 | The address inside the notice is plain text in the same run, so it is not distinguished visually from the sentence around it. Every reference on the board bolds it. | 1.3.1 | Minor | **Open** — see critique #2 |

#### Operable

| # | Issue | Criterion | Severity | Status |
|---|---|---|---|---|
| 3 | The notice inserts above the submit button, shifting it down by one gap. A reader mid-reach on a touch device can press what is now a moved target. | 2.5.5 / general | Minor | **Accepted.** The shift happens on the response to a press that has already completed, and the alternative — reserving blank space for a message that usually never appears — costs every reader to protect one interaction. |
| 4 | No focus is moved, no dialog opens, no element is removed. Tab order is unchanged; the notice is not focusable, which is correct for a status region. | 2.4.3, 3.2.1 | — | Pass |
| 5 | Nothing is time-limited on screen. The email link expires in one hour, which is stated in the email, not enforced in the UI. | 2.2.1 | — | Pass |

#### Understandable

| # | Issue | Criterion | Severity | Status |
|---|---|---|---|---|
| 6 | The unverified response is no longer identified as an input error, because it is not one. The password field keeps its red `error` for genuine credential failures. | 3.3.1 | — | **Fixed by this change** |
| 7 | The notice states the cause and the corrective action in the same sentence. | 3.3.3 Error Suggestion | — | Pass |
| 8 | Labels and the password hint are unchanged and already present. | 3.3.2 | — | Pass |

#### Robust

| # | Issue | Criterion | Severity | Status |
|---|---|---|---|---|
| 9 | `role="status"` with explicit `aria-live="polite"` — announced without stealing focus or interrupting. `role="alert"` would be wrong; nothing failed. | 4.1.3 Status Messages | — | Pass |
| 10 | Native adds `accessibilityLiveRegion="polite"`; react-native-web maps neither attribute from the other, so a node carrying only one is announced on only some platforms. | 4.1.2 | — | Pass |
| 11 | One live region holds both registers, so a second message replaces the first instead of stacking two announcements. | 4.1.3 | — | Pass |
| 12 | The live region is rendered conditionally (`{notice ? … : null}`) rather than as a persistent empty node. Some screen readers announce reliably only when the region exists in the DOM before its content changes. | 4.1.3 | Minor | **Open** — see below |

### Priority fixes

1. **#12, minor.** Render the live region always and leave it empty when there is
   no message. Not changed here: it alters the DOM on every render of both
   forms, and the failure mode is a missed announcement rather than an
   inaccessible one. Worth a follow-up with a real VoiceOver and TalkBack pass
   behind it.
2. **#2, minor.** Bold the address. Blocked on a decision recorded in the
   critique below.

### Not verified

No screen reader was run against a built page, no keyboard-only pass, and no
200% zoom check. Every finding above is read from code and tokens. The
announcement behaviour in #10 and #12 in particular is the kind of thing that
only a device confirms.

---

## 7. Design critique

**Working.** The notice reads as information rather than as a failure, which is
the whole point of the change. Placement above the button puts the instruction
where the decision to retry gets made. Naming the address is the single highest-
value detail on the screen and matches nine of twelve references.

**Open questions.**

1. **No manual resend.** Render and Amplitude both offer a button; here the
   resend is a side effect of pressing Sign in again. The copy covers it ("we
   just sent a new link"), but a reader who does not want to retype their
   password has no affordance. Postmortem follow-up #6.
2. **The address is not bolded.** Every reference that names the address also
   emphasises it. Doing that inside a `Text` run needs either a nested `Text`
   with its own weight or a small `RichText`-style split, and the whole line is
   already `font-semibold` — so a bolded address inside it would need the
   surrounding sentence to drop to regular weight. That is a legible change and
   probably the right one; it is a composition decision worth making
   deliberately rather than inside a hotfix.
3. **No spam-folder hint.** Clay's "Can't find our email? Check your spam
   folder!" pre-empts the most common second failure. Left out to keep the
   notice to one sentence-group; worth adding if support sees the question.
4. **Two sentences carry three clauses.** "Confirm your email to sign in. We just
   sent a new link to {address}. Open it and you'll be signed in." is at the
   upper end of what a stressed reader absorbs. Every clause earns its place —
   action, evidence, outcome — but it is the first thing to cut if this ever
   needs to shrink.

**Not a problem.** The layout shift when the notice appears. It follows a
completed press, and reserving permanent blank space for a rare message is a
worse trade.

---

## 8. Code review

Reviewed: the five changed source files plus the new sender and its tests.

| # | Finding | Severity | Resolution |
|---|---|---|---|
| 1 | `try`/`catch` around `authClient.signIn.email` caught nothing — the client resolves with `{ data, error }`. A wrong password set status `success` and called `router.replace('/')`. | **Critical** | Fixed in `sign-in-content.tsx`; `res.error` is now read. Confirmed empirically: `signIn threw? : false`. |
| 2 | Sign-up navigated to a gated route on a session-less response (`token: null` under `requireEmailVerification`). | **Critical** | Fixed in `LoginContent.tsx`; navigation is gated on `res.data?.token`. |
| 3 | `catch {}` in `proxy.ts` made an auth outage indistinguishable from a signed-out visitor. | Major | `console.error` added; fail-closed behaviour kept deliberately. |
| 4 | Four `useState` calls in `sign-in-content.tsx` against the repo's Zustand-only rule. | Major | Converted to `useInstanceStore`. Feedback is a discriminated union, so "error" and "notice" cannot hold each other's styling. |
| 5 | Untrimmed email from autofill. | Major | Trimmed on both screens before submit. |
| 6 | `sendOnSignIn` defaults to `false` in 1.7.2 despite guidance implying otherwise. Omitting it would leave every already-locked account locked. | **Critical** | Set explicitly, with the reason in a comment at the option. |
| 7 | The verification token is a signed JWT and would have been sent to Resend as a raw idempotency key. | **Critical** | `idempotencyKeyFor` sends `sha256(token)`. Asserted: the key does not contain the token. |
| 8 | A recipient address in a thrown error lands in runtime logs, and Resend quotes addresses back in validation messages. | Major | Redacted in `sendAuthEmail`, with a test that drives the exact Resend phrasing. |
| 9 | `from` could plausibly have been defaulted, producing a config that looks wired and sends nothing. | Major | Never defaulted; `readAuthEmailConfig` returns null unless both variables are non-blank. |
| 10 | The `sendVerificationEmail` callback was unreachable by tests inside the `betterAuth({…})` options literal. | Minor | Extracted to `sendVerificationEmailFor`, which returns a `VerificationSendOutcome` so "sent" and "deliberately skipped" are distinguishable. |
| 11 | With `sendOnSignIn` on, every learner handoff would POST a bounce to Resend for an `@learners.invalid` address. | **Critical** | Placeholder guard, covered by a test asserting zero requests. |
| 12 | `noUncheckedIndexedAccess` violations in the new tests. | Minor | Fixed with explicit `assert.ok` narrowing rather than non-null assertions. |

**Deviations from the Better Auth skill guidance, both deliberate and commented
at the call site:**

- *"Always use absolute callback URLs."* Ours are relative. `LoginContent`
  also serves `/login/[org]` on `<slug>.moyolearn.com`, and no `trustedOrigins`
  are configured in `createAuth` on this branch, so an absolute district-origin
  URL returns `INVALID_CALLBACKURL`. The constraint is the missing allow-list,
  not a Better Auth limitation. Draft PR #36 adds `trustedOrigins` for the
  native scheme; if that lands, this decision is worth revisiting.
- *"`requireEmailVerification` requires `sendVerificationEmail` to be
  configured."* True, and the repair is to configure the sender, never to lower
  the flag. A missing sender now logs an error at construction and leaves the
  control in place.

**Not addressed, by instruction:** `sendResetPassword` is unwired in exactly the
same way. Recorded as postmortem follow-up #1.

---

## 9. Final UI pass

- Weight, not colour, carries the notice — forced by contrast, and consistent
  with the kit's rule that hierarchy comes from size, weight and space.
- Nothing new was added to the visual language: no icon, no card, no rule, no
  new token. The screen gains one line of text and loses a red field error that
  was lying about the cause.
- Both screens now say the same sentence in the same place, so a parent who hits
  this on a phone and then on a laptop sees one problem rather than two.
- The brand pane, heading, fields, and both buttons are untouched.
