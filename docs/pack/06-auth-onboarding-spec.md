# Auth, Account Types & Role Onboarding
**Doc 06 · Companion to the platform pack · Date:** Aug 19, 2026
**Build order note (doc 09):** this spec's flows land in **Wave 3** — screens ship first against the mock-session contract; nothing here blocks seeing screens.
**Scope:** Better Auth architecture (with Stripe wired in), sign-up/login per account type — including the parent-creates-child-and-grants-access model — forgot/reset flows, and onboarding screen sequences per profile type. Every claim about a library API or a legal method below is verified against current docs (§9). Roster + anti-slop gates from plan §9 apply; skills applied: user-research, frontend-design, ux-copy, design-handoff, accessibility-review.

---

## 1. Verified research this spec stands on

**Better Auth surfaces (current docs):**
- **Stripe plugin:** creates Stripe Customers automatically on sign-up; adds a `subscription` table + `stripeCustomerId` on user; the **`referenceId` system attaches a subscription to a user *or* an organization** (`customerType: "organization"`), with `authorizeReference` deciding who may manage an org's billing; webhooks handled out of the box (`checkout.session.completed`, `customer.subscription.updated/deleted`); **built-in trial-abuse prevention** (prior `trialStart`/`trialEnd`/`trialing` blocks a second free trial); one active/trialing subscription per referenceId; upgrades must pass `subscriptionId` to avoid duplicate billing; the success URL is internally wrapped to beat the checkout-vs-webhook race; per-seat team subscriptions and Billing Portal sessions supported.
- **Expo integration:** `@better-auth/expo` server plugin + `expoClient({ scheme, storagePrefix, storage: SecureStore })`; the app scheme goes in `trustedOrigins` (plus `exp://` wildcards in dev); sessions cache in SecureStore so cold starts render without a spinner; the session cookie is retrievable for authenticated fetches.
- **Username plugin:** `username()` + `usernameClient()`; `signUp.email` accepts a `username`, sign-in via `signIn.username({ username, password })`; `isUsernameAvailable` for live checks; normalization + validation (alphanumeric/underscore/dot by default, min length configurable) — exactly the credential shape a no-email child login needs.
- **Passkey plugin:** WebAuthn (`addPasskey`, `signIn.passkey`, conditional-UI autofill, its own `passkey` table, `rpID` config). Native Expo support exists via a community module (`expo-better-auth-passkey`, with Android `apk-key-hash` requirements) — **community-maintained: evaluate before adopting; passkeys are a Phase-2 adult-convenience feature, not a launch dependency.**

**The law on child accounts (amended COPPA Rule, in force):** approved verifiable-parental-consent methods now include **knowledge-based authentication** (dynamic multiple-choice questions a child in the household "could not reasonably ascertain"), **face-match of a parent's government ID against a live image with mandatory prompt deletion**, and **"text plus"** — text-message consent with a confirming step, **available only where children's data is not disclosed to third parties**; the classic methods (card charge with a transaction, phone/video call, signed form, email-plus under the retained sliding scale for internal-only uses) remain. Separate consent is required before any third-party disclosure — which this platform never requests because it never discloses (plan ADR-005/006). Practical consequence: **our architecture qualifies for the streamlined consent tier.**

**The market-proven parent-creates-child pattern (Khan Academy, current help center):** for a child under 13 the **parent creates the account and chooses a username + password — no email on the child account**, and Khan explicitly urges non-identifying usernames; the account is restricted; **only the parent can change the child's password**; the parent decides **whether the child may add other coaches (tutors/teachers)** — the exact "grant access" mechanic — and the parent enables/disables the AI (Khanmigo) per child and can review chat history; DOB is collected once to determine the permission regime; a 13+ child is instead invited by email to sign up themselves and link the parent; child logins are fully separate credentials from the parent's. One hygiene rule worth copying: unlinked child accounts are deleted after a short window (Khan: 7 days).

---

## 2. Account model — who exists, how they're created, who resets them

| Account type | Created by | Credential | Email on account | Password reset by | Notes |
|---|---|---|---|---|---|
| **Guardian (parent)** | self-serve | email+password or Google; passkey later | yes (verified before billing) | self, via email link | owns children, consent records, family billing |
| **Learner < 13** | **guardian only** — never self-serve | **username + password** (username plugin), guardian-chosen, non-identifying by policy | **never** | **guardian only**, from the Family shell (Khan-verified pattern); support may trigger a guardian-side reset, never see or set a password | restricted account: hooks block adding email, OAuth links, and self password-change |
| **Learner 13–17** | guardian invite (email) → self sign-up → auto-link to guardian; or guardian-created like <13 if no email | email+password (or username) | optional | self if email present, else guardian | consent + AI permissions still guardian-controlled while a minor |
| **Tutor** | self-serve, or **org invitation** (organization plugin) | email+password or Google | yes | self | invitation-accept assigns org role `tutor` |
| **Teacher** | self-serve or org/school invitation | **Google-first** (US K-12 reality) + email/password | yes | self | SSO/SAML + SCIM is the Phase-4 institution path (already in Better Auth) |
| **Business owner / staff** | owner self-serve creates the org; staff by invitation | email+password or Google | yes | self | roles: owner, manager, scheduler, finance |
| **Institution admin** | contracted onboarding (Phase 4) | SSO/SAML | yes | IdP | |
| **Internal (founder/support)** | Payload `Users` only | Payload admin auth | yes | superadmin | never a platform account (doc 05 §4) |

Design decision that everything above hangs on: **learners are real Better Auth users, not rows in a profile table.** They need genuine sessions for `Stack.Protected` guards, Payload access control, and device management. The guardian-created flow is a single server action: create the learner user (username credential) → write the `guardianships` link → write the `consents` record (method, scope, evidence) → apply the restricted-account flags (`isMinor`, `guardianManaged`). Two guardians per learner are supported from day one (real families have two households); the second guardian joins by invitation from the first.

---

## 3. Flows

### 3.1 Guardian sign-up (the consent-bearing path)
1. Email+password or Google → **email verification required before anything billable or child-related** (this is also the "email-plus" foundation).
2. **Consent flow** (`ConsentFlow` renders from the consent schema, plan §6): plain-language notice of what's collected from the child and why, then verification by the streamlined tier we qualify for — **email-plus, with text-plus as the alternative** (permissible because children's data is never disclosed to third parties); the card captured at trial start adds the classic card-verification signal for paying families; **KBA sits behind a "having trouble?" fallback** for edge cases. Face-match is not built in v1 — it's the highest-friction method and we don't need it.
3. **Create child profiles:** DOB first (Khan pattern — it selects the regime). Under 13 → guardian picks username (live `isUsernameAvailable` check, generator suggests non-identifying names like `blue-falcon-42`) + password. 13+ → email invite path or guardian-created, guardian's choice.
4. **Grant access** — the screen the request named: per-child toggles for AI tutor on/off, session transcript visibility window, and **which tutors/teachers may view this child's learning data** (nobody by default; connecting to a business or class prompts the guardian per person — the Khan "allow coaches" mechanic made explicit per-relationship).

### 3.2 Logins
- **Adults:** email+password, Google OAuth (deep-link return via the Expo plugin's scheme handling), passkey in Phase 2.
- **Child (<13):** a dedicated kid login screen — username + password only, no email field, large type (hot dial), show-password toggle, zero marketing. Wrong-password copy is blame-free ("That didn't match — ask your grown-up if you need a new one"). On shared family devices, the guardian can enable fast account-switching from their own authenticated session (guardian unlocks, child picks their avatar) — the child's credential is never weakened to make switching easy.
- **Class-code / QR badge login** (the K-2 school pattern) is deliberately **Phase 4** with institutions — noted, not designed here.

### 3.3 Forgot / reset
- Adults: standard Better Auth email reset; success and failure copy identical (no account enumeration); all sessions revoked on reset; notification email on completion.
- **Children: there is no child-side reset.** The kid login screen's "Forgot password?" says "Ask your grown-up to reset it" and can notify the guardian with one tap. The guardian resets from Family → child → Manage login (only-the-parent-resets is the Khan-verified rule, and it removes the entire child-phishing reset surface). 13+ with email: self-reset, guardian notified.
- Support (doc 05 §4): may trigger a reset **link** to a verified adult email, never sees or sets any password, action audited + guardian-notified when child-linked.

### 3.4 Sessions & devices
Better Auth session listing/revocation surfaces in every adult shell's Security settings; guardians additionally see and can revoke **their children's** sessions ("Maya is signed in on iPad — Sign out"). Learner sessions get shorter maxAge than adult sessions; secret rotation per the repo's zero-downtime multi-secret support.

---

## 4. Stripe × Better Auth wiring (the config of record)

```ts
// packages/auth — shape; exact fields against pinned plugin docs at install
stripe({
  createCustomerOnSignUp: true,
  subscription: {
    enabled: true,
    plans: [
      { name: "family-early-bird", priceId: PRICE.family_eb_11, annualDiscountPriceId: PRICE.family_eb_110, freeTrial: { days: 30 } },
      { name: "family",            priceId: PRICE.family_1599,  annualDiscountPriceId: PRICE.family_15990, freeTrial: { days: 30 } },
      { name: "ops-solo",   priceId: PRICE.ops_19,  freeTrial: { days: 30 } },
      { name: "ops-studio", priceId: PRICE.ops_99,  freeTrial: { days: 30 }, limits: { payoutAutomation: 1 } },
      { name: "ops-scale",  priceId: PRICE.ops_299, freeTrial: { days: 30 } },
    ],
    authorizeReference: async ({ user, referenceId, action }) => {
      // family: referenceId === guardian user id → allow self
      // ops: referenceId === organizationId → require member role owner|finance
    },
  },
})
```
- **Reference mapping:** Family plan → `referenceId = guardian.userId` (`customerType: "user"`). Ops tiers → `referenceId = organizationId` (`customerType: "organization"`), gated by `authorizeReference` on owner/finance membership — the documented org-billing pattern.
- **Trials:** 30 days in plan config; the plugin's **trial-abuse check** (prior trial on the customer blocks a second) enforces one-trial-per-family/org without custom code. Early-bird is its own plan entry with its own `priceId` — grandfathering is just "they stay on that plan."
- **Race + cancel hygiene:** rely on the plugin's wrapped success URL (subscription state settles before redirect); cancellation runs through the Billing Portal session *and* an in-app one-tap cancel (doc 05's ARL standard) — both paths land on the same webhook truth.
- **Entitlements bridge:** subscription status (webhook-updated) projects into the session-adjacent store that feeds `Stack.Protected` guards and `PermissionGate` — e.g., `ops-studio`'s `payoutAutomation` limit is what unlocks S19's automated pay runs. Ops Connect onboarding (Merchant config) and tutor payout onboarding (Recipient config) stay in doc 05 §5 — this doc only binds *subscriptions* to auth.

## 5. Onboarding per profile type (screen sequences, S-brief format)

### S21 · Guardian onboarding (7 steps, ~4 minutes to value)
**Job:** account → consent → children → grant → plan → *meet the tutor together*. **Research:** Day-0 carries 80–90% of trials (doc 05 §1.1); Khan's DOB-first regime selection; streamlined-consent eligibility (§1). **Sequence:** welcome (one line of mission, zero carousel) → account+verify → ConsentFlow → add children (DOB → username/password or invite) → grant-access toggles → S16 paywall (early-bird card) → **first value: hand the device to the child for a 90-second guided hello with the tutor avatar, guardian watching** — the conversion moment is the kid's face, not a feature list. **Design:** cool structure, hot accents on child cards. **Copy:** consent in plain language ("We never sell data. We never train AI on your child's conversations."). **A11y:** consent is real text, AA, screen-reader-complete. **Metric:** completion rate per step; time-to-first-child-session.

### S22 · Learner first-run (child-facing, ≤2 minutes, zero forms)
**Job:** a kid signs in with their new username and immediately likes it here. **Research:** R1 (open the door the 85% never open); Synthesis's feel premium; no-dark-patterns rule. **Sequence:** avatar greets by first name → "what are you working on?" (subject grid, big tiles) → one tiny win (a single solvable question with celebratory ink-stamp animation) → home. **Design:** full hot dial; the tutor presence is the screen. **Copy:** second person, present tense, no exclamation inflation. **A11y:** dynamic type to XL without breakage; reduced-motion swaps the stamp for a static seal. **Metric:** first-session completion; D1 return.

### S23 · Tutor onboarding
**Job:** profile → teachable subjects/credentials → availability → first student connection; payouts arrive later (S18, M2). **Research:** tutor supply retention (R12); AI-prep is the differentiator they should meet on day one. **Sequence:** account (Google-first) → profile + subjects + credentials upload → AvailabilityEditor seeded with sensible defaults → connect: accept org invite or share a family-connect code → **preview of an AI SessionPrepCard on demo data** ("this is what you'll know before every session"). **Metric:** availability completed; first session scheduled ≤7 days.

### S24 · Business owner onboarding (the trial that converts itself)
**Job:** org live + first real booking inside day one. **Research:** activation milestones drive B2B conversion (doc 05 §2.3); TutorBird's no-mobile gap; Merchant onboarding embedded (doc 05 §5.2). **Sequence:** org create (name, locations, services) → import students/families (CSV with forgiving mapper) → invite tutors → embedded Stripe Merchant onboarding → milestone checklist pinned in the rail (import ✓, first booking ✓, first invoice ✓ — the S17 trial UI). **Metric:** milestones hit in trial; trial→paid by milestone count.

### S25 · Teacher onboarding
**Job:** Google in → class exists → first assignment out. **Sequence:** Google sign-in → school/class setup → roster (invite codes for 13+; guardian-mediated join links for <13 — a teacher never creates a child account, the guardian consent flow does) → first assignment from a template. **Metric:** first assignment sent; roster fill rate.

## 6. Security spec (build gates)
Adults: 12+ char passwords checked by a strength estimator (no composition theater), breached-password rejection, rate-limited auth routes, identical success/failure reset copy, session revocation on reset + email/password change, new-device notification emails. Children: guardian-set passwords with guidance UI, all §3.1 restricted-account hooks covered by tests (attempt to add email to a minor account = failing test), learner session maxAge < adult. Platform: email verification precedes billing and child creation; consent records immutable + versioned (re-consent on material change); `auditEvents` on create/link/grant/reset/revoke; the Khan-style cleanup — **guardian-created learner accounts never linked/used within 7 days are deleted** (retention hygiene that also matches our written retention schedule); account deletion cascades per plan §7.2 with completion receipts.

## 7. Collections/schema deltas
Better Auth (auth PG schema): its own tables + `subscription` + `passkey` (later) + username fields — all via the Better Auth CLI migration, committed. Payload: `guardianships` (already planned), `consents` gains `method: email-plus | text-plus | kba | card | …` + evidence refs, `learnerFlags` fields on the learner profile (guardianManaged, transcriptVisibilityWindow, aiEnabled, allowedViewers[]).

## 8. New PRs
- **PR-14 · Auth flows:** username plugin, guardian→child creation server action, restricted-account hooks + tests, resets (adult/child/guardian), sessions & device management, ConsentFlow v1 (email-plus + text-plus + KBA fallback).
- **PR-15 · Stripe×Auth:** §4 config, entitlement bridge into guards/PermissionGate, billing portal + in-app cancel, webhook wiring (extends PR-8's scope with the verified plugin surface).
- **PR-16 · Onboarding:** S21–S25 sequences on the archetype system, milestone checklist engine, family-connect + org-invite codes.


## 10. Plugin roster v2 (cross-checked against the Better Auth SaaS-plugin ecosystem)
Adopted, each with its job: `organization` (orgs/roles/invites; **`allowUserToCreateOrganization` gated** so orgs are born only through ops onboarding) · `stripe` (§4) · `username` (child credentials) · `@better-auth/expo` · **[add] `multi-session`** — list/setActive/revoke device sessions: this is the *family shared-device switcher* done natively (guardian authenticates once, learner sessions coexist, one tap swaps the active session; guardian revokes any child session remotely) · **[add] `two-factor`** (Phase 2, adults; TOTP + backup codes, enforced on sensitive ops: payout changes, consent-evidence access) · **[add] `magic-link` / `email-otp`** (guardian low-friction sign-in; OTP doubles as the text-plus consent verifier) · `passkey` (Phase 2, §1 caveat). **Explicitly rejected: the `admin` plugin** — its impersonation feature conflicts with doc 05 §4's no-impersonation rule; Payload remains the back office and support views stay consented + audited. Video reference: "10 Better Auth plugins that every SaaS should use" (Dreams of Code) — roster above is our take on that list, each item justified against this product rather than adopted wholesale.

## 9. Source register
- Better Auth Stripe plugin (customer auto-create, referenceId/customerType, authorizeReference, webhooks, trial-abuse prevention, one-sub-per-reference, success-URL race handling, seats, billing portal): better-auth.com/docs/plugins/stripe + repo mdx + DeepWiki plugin architecture pages (2025–26).
- Better Auth Expo integration (expo()/expoClient, SecureStore, scheme in trustedOrigins, dev exp:// wildcards, cached session, cookie for authed requests): better-auth.com/docs/integrations/expo + @better-auth/expo npm.
- Username plugin (signIn.username, isUsernameAvailable, validation/normalization) and Passkey plugin (WebAuthn, conditional UI, schema, rpID; community Expo module expo-better-auth-passkey): better-auth.com/docs/plugins/username, /plugins/passkey, kevcube/expo-better-auth-passkey.
- Amended COPPA VPC methods (KBA §312.5(b)(2)(vi); face-match w/ mandatory deletion §312.5(b)(2)(vii); text-plus limited to no-third-party-disclosure; sliding scale retained; separate consent for disclosure): Loeb & Loeb, Skadden, White & Case, Kirkland, Koley Jessen, Finnegan, promise.legal VPC guide (2025–26).
- Khan Academy child-account mechanics (parent creates username+password, no child email, non-identifying usernames urged, parent-only password reset, allow-coaches control, DOB regime, 13+ invite path, 7-day unlinked deletion, Khanmigo parent controls/chat history): support.khanacademy.org help-center articles (current).
