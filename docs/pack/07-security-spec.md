# Security Spec — Client (Expo), Server, Data & the COPPA Security Program
**Doc 07 · Companion to the platform pack · Date:** Aug 19, 2026
**Skill applied:** engineering code-review (security dimensions + severity/verdict format govern §6); consolidated with plan §7.2 and doc 06 §6 — this doc goes deep where those stopped: the device. Roster + anti-slop gates apply; every Expo claim below is verified against current docs (§8).

---

## 1. Threat model (what we protect, from whom)

| Asset | Adversary | Surface | Controls (section) |
|---|---|---|---|
| Child learning data + transcripts | data brokers, curious staff, breach | server stores, support console, logs | plan §7.2 three-store split, doc 05 §4 field access, §3–4 here |
| Sessions (guardian, learner, staff) | device thief, sibling on shared iPad, phishing | SecureStore, resets, deep links | §2.1–2.4 |
| Money (cards, payouts) | card testers, refund fraud, webhook forgery | Stripe surfaces, webhooks | §3, doc 05 §5 risk notes |
| The app binary + updates | supply chain, OTA tampering | deps, EAS Update | §2.5, §7 |
| Guardian trust | dark patterns, silent data flows | every screen | doc 04/05 briefs; nothing silent by design |

The device deserves its own section because a children's-education app lives on **shared family hardware**: the strongest server posture in the world doesn't help if a sibling opens the parent's billing tab on the kitchen iPad.

## 2. Client security — the Expo layer

### 2.1 SecureStore policy (verified against current expo-secure-store docs)
What the platform stores in SecureStore, and nothing else:

| Key | Content | Options |
|---|---|---|
| Better Auth session cookie | via `expoClient` (already the doc-06 wiring) | plugin-managed |
| `mmkv.<userId>.key` | 256-bit key for the encrypted MMKV instance | `WHEN_UNLOCKED_THIS_DEVICE_ONLY` |
| `parentgate.secret` | random secret proving the parent-gate was passed on this device | `requireAuthentication: true` + `authenticationPrompt` |

Rules, each mapped to a verified constraint:
- **Small values only** — the documented value limit is **2048 bytes** (a warning today; the docs say a future SDK may throw, and some iOS releases have rejected larger values outright). SecureStore holds *keys and tokens*; anything bigger lives in encrypted MMKV whose key lives here.
- **`keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` is the default** for our entries: not readable while locked, and the `THIS_DEVICE_ONLY` family is excluded from backup migration — session material must never restore onto a different device. Android Auto Backup is configured to exclude the secure prefs for the same reason.
- **`requireAuthentication` is reserved for the parent-gate secret**, with two documented sharp edges engineered around: entries are **invalidated when biometrics change** (a new fingerprint/face profile kills the value — the gate must degrade gracefully to account-password re-auth, never lock a parent out), and the option **doesn't work in Expo Go** (fine: the repo uses dev builds).
- iOS export compliance: `ios.config.usesNonExemptEncryption: false` in app config (the documented setting for SecureStore-only encryption use).
- SecureStore is per-project-isolated and unavailable on web — web sessions ride Better Auth's httpOnly cookies instead; no token ever touches `localStorage`.

### 2.2 Local data: encrypted MMKV, wiped on sign-out
The repo's MMKV cache becomes per-user encrypted instances: instance id = user id, `encryptionKey` generated once and held in SecureStore (§2.1). Sign-out deletes the instance and its key; learner instances additionally exclude anything transcript-shaped — client caches hold schedule/mastery projections, never conversation bodies.

### 2.3 The parent gate (shared-device reality)
Entering the **Family shell from a device where a learner session is active** — and the billing, permissions, and AI-activity screens regardless — requires `expo-local-authentication` biometric/passcode confirmation (the established kids-app parental-gate convention). The child can hand the iPad back without the parent's surfaces being one tap away. Fast account-switching (doc 06 §3.2) rides the same gate in reverse: guardian authenticates, then children pick avatars.

### 2.4 Deep links & navigation
`trustedOrigins` already carries the app scheme (doc 06); production links to sensitive destinations use **verified Universal Links / Android App Links** (custom schemes are claimable by other apps — fine for OAuth return, not for anything that implies trust); every deep-link route parses params through zod and re-checks the `Stack.Protected` guard tree (docs verify guards apply to deep links); no tokens, usernames, or child identifiers ever appear in URLs.

### 2.5 Updates, secrets, and the bundle
- **EAS Update code signing on from day one** (end-to-end public-key signing of updates is the documented mechanism): certificate checked into the repo, **private key in KMS**, ~1-year certificate validity with a rotation runbook — the docs' own guidance is that shorter validity limits exposure from a compromised key.
- **`EXPO_PUBLIC_` means public.** The docs are unambiguous: client env vars are inlined into the bundle at build time and extractable by anyone running the app, and EAS secret visibility adds nothing to values embedded client-side. Therefore: only publishable values (API base URL, Stripe publishable key, Sentry DSN) carry the prefix; every real secret is server-only; `.env*.local` gitignored; `--environment` discipline on builds and updates so staging keys can't leak into production bundles.
- Screen privacy: capture-prevention (`expo-screen-capture` — pin + verify API at install, like every dependency) on **payment-method entry** and the **internal support view**; iOS/Android app-switcher snapshots blurred on Family and Learner shells so transcripts and children's names don't sit in the recents carousel.
- Crash/error hygiene (Sentry is already connected): PII scrubbing on, `beforeSend` redaction of names/usernames/free text, no breadcrumbs from child conversation surfaces, session replay disabled on child surfaces entirely.

### 2.6 Deliberately not shipped in v1 (reasoned, not forgotten)
- **Certificate pinning:** the APIs are TLS-only with HSTS; pinning's real-world failure mode (bricked clients on certificate rotation) outweighs its marginal gain for this threat model. Revisit for the institution tier if a district security review demands it.
- **Root/jailbreak detection:** high false-positive cost, trivially bypassed, protects nothing our server-side authorization doesn't already; noted for the same district-review contingency.

## 3. Server & API (extends plan §7.2 — additions only)
zod validation at every route/server-action boundary (the `domain` package's schemas are the single source); rate-limit classes: auth 5/min/IP+account, inference per-learner budget, webhooks by signature only; security headers on web incl. CSP that also covers the mounted Payload admin, HSTS, `frame-ancestors 'none'`; **uploads:** content-type allowlist, AV scan (already planned), and **EXIF/GPS stripped from every image** — a photographed worksheet must not carry the family's home coordinates into storage; SSRF guard on any server-side fetch of user-supplied URLs; **Payload admin hardening:** served on an internal subdomain, 2FA required for internal `Users`, optional IP allowlist, never rendered inside the mobile app.

## 4. Data security
Encryption at rest is platform-provided (Supabase); **consent evidence is additionally app-layer encrypted** with superadmin-only decryption (doc 05 §4.2); backups with a **quarterly restore drill** on the calendar (a backup that's never been restored is a hope, not a control); retention jobs as already specced (7-day unlinked-learner cleanup, transcript expiry windows) each emit `auditEvents`; deletion cascades produce completion receipts.

## 5. The COPPA written security program (rule requirement → artifact)
The amended rule requires a written children's-data security program with a designated coordinator, annual risk assessments, regular testing of safeguards, and oversight of service providers. Mapping:

| Rule requirement | Our artifact |
|---|---|
| Written information security program | this doc + plan §7.2 + doc 05 §4, versioned in-repo |
| Designated security coordinator | named role (founder until a hire), recorded in the program doc |
| Annual risk assessment | threat-model review (§1) on a yearly calendar entry + after any architecture change |
| Regular testing of safeguards | CI security suite (§7) every PR + pre-launch external pen test (already planned) |
| Service-provider oversight | the sub-processor registry (plan ADR-005) with an annual review pass and contract terms (no-training, retention limits) |
| Data retention limits | written retention schedule per data class, enforced by the §4 jobs |

## 6. The security review gate (code-review skill format — every PR touching auth, money, child data, or a new endpoint)
**Checklist:** authorization asserted server-side for every new read/write (who may call this, proven by a test) · new data classified (which store, which retention class) before it's written · no new SecureStore key without a §2.1 table row · no new `EXPO_PUBLIC_` var carrying anything non-publishable · inputs zod-parsed · errors don't leak internals · child-surface changes re-checked against doc 05 §3.2 visibility · webhooks idempotent + signature-verified.
**Severity rubric:** 🔴 Critical = child data exposure, auth bypass, money movement flaw — blocks merge; 🟠 High = missing rate limit/validation on a sensitive route — blocks release train; 🟡 Medium = hygiene (logging, headers) — ticketed with owner. Verdict recorded on the PR (Approve / Request changes) with the table above, per the skill's output format.

## 7. CI & operations
Dependency audit + lockfile integrity check per PR (the pnpm catalog makes drift loud); secret scanning on push; the security test suite runs the invariants already specced across the pack — cross-tenant and cross-relationship denials, minor-account hooks (add-email-to-minor fails), guard-tree invariants, anon-key-yields-nothing; **key rotation runbooks:** Better Auth session secrets (multi-secret, zero-downtime), EAS Update signing key (annual), Stripe webhook secret; incident response follows the engineering incident-response workflow (triage → comms → blameless postmortem) with a child-data-specific page: guardian notification duty and the rule's breach posture are pre-drafted, not improvised.

## 8. New PR + sources
**PR-17 · Security hardening:** SecureStore policy module + parent gate, encrypted MMKV instances + sign-out wipe, EAS Update code signing, deep-link zod guards + Universal/App Links, EXIF stripping, Payload admin hardening, Sentry redaction config, CI security suite + secret scanning, the written program doc committed.
**Sources:** expo-secure-store current docs + source (2048-byte limit and future-throw note, requireAuthentication biometric invalidation + Expo Go caveat, keychainAccessible constants incl. THIS_DEVICE_ONLY backup exclusion, usesNonExemptEncryption, Android Auto Backup, per-project isolation) — docs.expo.dev/versions/latest/sdk/securestore + expo/expo source. EAS environment variables (EXPO_PUBLIC_ inlined at build, client values public, secret visibility not readable outside EAS, static dot-notation) — docs.expo.dev/eas/environment-variables + guides. EAS Update end-to-end code signing (mechanism, certificate validity tradeoff, private-key handling) — docs.expo.dev/eas-update/code-signing. Amended COPPA security-program elements (coordinator, annual risk assessment, testing, service-provider oversight, retention prohibition) — Loeb & Loeb 2025 amendments summary (doc 06 §9 register). Better Auth trusted origins / guard behavior — doc 06 §9 register.
