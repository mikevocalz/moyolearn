# Doc 38 · Phase 0 audit — front door & flow

**Date:** Aug 27, 2026 · **Branch:** `ops-dashboard` · **Scope:** Phase 0 of the doc-38 build prompt (audit only, no code changes).

> **Status: BLOCKED at the approval gate — two inputs the prompt names as binding do not exist in this repo.** The repo-state half of the audit below is complete and runnable. The doc-38 half (screen IDs FD-01…FD-26, PW-01…PW-08, §8 component list, §13 server surfaces, §14 checkboxes) cannot be filled, because there is nothing to diff against. Per §2 law 1 (no slop) and §8 (stop and ask), those columns are left empty rather than invented.

---

## 0 · Missing binding inputs

| Input | Prompt reference | Repo state |
|---|---|---|
| `docs/38-front-door-and-flow.md` | "Spec of record" | **Absent.** `docs/pack/` holds 00–37; there is no 38 anywhere (`docs/`, `docs/pack/`, `docs/design/`). |
| `prompts/ROSTER.md` | "embed verbatim above this block" | **Absent.** There is no `prompts/` directory. |
| Docs 05, 06, 07 | "binding companions" — plan tiers, auth/consent vendors, retention | Present in `docs/pack/`. Docs 08, 09, 30, 35, 36, 37 present. |

Everything the prompt defines by reference to doc 38 — the 34 surfaces, the screen-ID diff table, §5 copy, §5B paywall states, §7 a11y rows, §8 `[add]` list, §10 evidence rows, §11 journeys, §13 server surfaces, §14 release rows — is unresolvable until doc 38 exists. **This audit does not guess at them.**

Note also: the prompt writes the audit to `docs/38-audit.md`, but this repo's convention puts audits in `docs/design/` (`route-audit-36.md`, `pane-audit-37.md`) and specs in `docs/pack/`. I followed the prompt's explicit path; say the word and it moves.

---

## 1 · Skill inventory (§2.5) — 11 of 19 named skills are not installed

§8 requires these be named, never fabricated.

**Installed and usable:**

| Named in §2.5 | Installed as | Note |
|---|---|---|
| `frontend-design` | `frontend-design:frontend-design` | ✅ |
| `/code-review` | `code-review` | ✅ |
| Mobbin MCP `search_screens` | `mcp__mobbin__*` | ✅ screens/flows/sections |
| Callstack `react-native-best-practices` | `react-native-best-practices` | ⚠️ **This is Software Mansion's skill, not Callstack's** (`callstackincubator/agent-skills`). Different author, different content. Substituting silently would be fabrication. |
| accessibility review | `accessibility` (WCAG 2.1) | ⚠️ Named `/accessibility-review` in the prompt; the installed skill covers WCAG 2.1 A/AA, not the 2.2 rows §7 asks for. |
| design critique | `general-design-review`, `ux-heuristics-review`, `craft`, `design-analysis`, `cognitive-load-conversion` | ⚠️ Five adjacent skills; none is `/design-critique` and none emits "the critique in the skill's format". |
| user research | `ux-research-methods`, `ux-personas`, `journey-mapping`, `empathy-mapping`, `double-diamond` | ⚠️ Adjacent; none is `/user-research` and none emits the 5-line evidence note format. |

**Not installed — no substitute, output cannot be produced:**

`/user-research` · `/design-handoff` · `/design-system` (`extend`/`audit` output) · `/ux-copy` · `/design-critique` · `/accessibility-review` · `/architecture` (ADR) · `/testing-strategy` · `/system-design` · `/deploy-checklist` · `/research-synthesis` · `gauntlet-loop` · `react-native-community/skills` · Margelo `react-native-skills`.

**Consequence:** the §6 skill ledger (screen × steps 1–10) cannot be completed for any screen. Steps 1, 4, 5, 6, 8, 9 have no installed skill. This blocks every per-screen PR as specified, not just Phase 0.

---

## 2 · Repo state — grep results

### 2.1 Route guards (`Stack.Protected`)
Four role shells guard correctly; **there are no `(public)` or `(onboarding)` groups**, which doc 38 §2's guard model presumes.

```
apps/mobile/app/(guardian)/_layout.tsx:29   <Stack.Protected guard={isGuardian}>
apps/mobile/app/(learner)/_layout.tsx:30    <Stack.Protected guard={isLearner}>
apps/mobile/app/(org)/_layout.tsx:23        <Stack.Protected guard={isOwner}>
apps/mobile/app/(tutor)/_layout.tsx:23      <Stack.Protected guard={isEducator}>
```

### 2.2 Route inventory
- **Mobile: 39 route files.** Role shells `(guardian)` `(learner)` `(org)` `(tutor)` + `index.tsx` (dispatcher), `handoff.tsx`, `onboarding/index.tsx`, `onboarding/[flow].tsx`, `settings.tsx`, `editor-settings/`, `+not-found.tsx`.
- **Web: 26 pages.** `(auth)` login · login/[org] · onboarding · onboarding/[flow] · handoff; `(site)` 15 pages; `(ops)`, `(session)/tutor`, `(share)/share/report/[token]`, `(payload)/admin`.
- **There is no login or signup route on mobile at all.** Anonymous cold launch redirects to `/onboarding`. This is the single largest gap between the repo and any front-door spec.

### 2.3 Doc-38 components — none exist

`rg TwoPaneShell|BrandPaneContent|OtpField|RoleChoiceCard|PlanCard|PasswordField|ConsentCheckpoint|LearnerCodeEntry|ProfileSwitcher` → **zero hits in source.** Only `AdaptivePanes` matches, and only because PR-146 landed it today (`packages/ui/adaptive-panes/`).

Kit today: **71 exports** in `packages/ui/index.ts`; `TextField` exists (with `PasteEventPayload`); no password, OTP, or PIN field.

⚠️ **Naming collision:** doc 38's `PlanCard` means a *pricing tier* card. This repo already has a `plan` feature that means a *study plan* (`packages/app/features/plan/`, `PlanScreen`, `(learner)/plan.tsx`, `plan.store.ts`). `(learner)/plan.tsx` is the study plan, **not** a paywall — no children's-surface violation, but the name must be disambiguated before `PlanCard` enters the kit.

### 2.4 State law — 24 violations of "Zustand only"

`useState`/`useReducer` outside allowed hooks (must be empty per §2 law 4): **24 occurrences**, including:

```
packages/ui/InspectorSection.tsx:38          packages/ui/StreamedText.tsx:28,29
packages/ui/TutorStage.tsx:343               packages/app/features/summary/draft-queue-content.tsx:61
packages/app/features/onboarding/onboarding-content.tsx:22   (the S14 consent switches)
packages/app/features/onboarding/consent/consent-flow-content.tsx:67,68
packages/app/features/tutor/tutor-screen.tsx:38,56
```

The onboarding ones sit directly in the front-door path.

### 2.5 Autofill — effectively absent
`textContentType`: **zero hits.** `autoComplete`: one prop *declaration* (`packages/ui/html/dom.web.tsx:142`), no consumer. Every credential field in the front door will need this added.

### 2.6 Better Auth — installed vs configured

- **Installed:** `better-auth@1.7.2`, `@better-auth/expo@1.7.2`, `@better-auth/stripe` present.
- **The `email-otp` plugin ships in the installed package** (`node_modules/better-auth/dist/plugins/email-otp/`, client + server) — so doc 38's OTP path is buildable against real symbols.
- **Configured today** (`packages/auth/src/server.ts:151`): `betterAuth({ … emailAndPassword @157 … expo() @228 })`.
- **Not configured:** `emailOTP`, `socialProviders` (no Apple, no Google, no idToken path), `trustedOrigins`, `rateLimit`.

### 2.7 Billing rails
- **Stripe:** present (`@better-auth/stripe` + `stripe` in `packages/auth`).
- **RevenueCat: not installed.** No `react-native-purchases`, no `react-native-purchases-ui` anywhere in the workspace. Phase 4b's mobile rail does not exist yet.
- **Existing prior art to extend, not fork:** `packages/app/features/paywall/` (`paywall-content.tsx`, `cancel-content.tsx`, `paywall.data.ts`), `packages/app/features/trial/` (`convert.ts` + tests, `milestones.ts`), `packages/app/providers/entitlements/` (`gate-decision.ts` + tests, `permission-gate.tsx`, `entitlements-sync.tsx`, `store.ts`).

### 2.8 Deep links & release engineering
- `apps/mobile/app.config.ts`: `scheme: 'moyo'` (:13), `bundleIdentifier: 'com.moyolearn.app'` (:22), `package: 'com.moyolearn.app'` (:33).
- **No `associatedDomains`, no `intentFilters`** → universal links / App Links are **not configured**. Doc 38's invite-token-over-universal-link path (FD-09) has no transport today.
- **EAS profiles:** `base`, `development`, `preview`, `production`. **No `staging` profile** — and every "live check" gate in §6 is defined against staging.
- **No E2E runner installed** (no Maestro, Detox, Playwright, or Cypress). §8 lists this as a stop-and-ask; it is confirmed absent.
- **No `copy/front-door.ts`** and no copy-snapshot test anywhere.

---

## 3 · What I can state as the diff, without doc 38

| Area | Verdict |
|---|---|
| Role shells + guards | **Exists** (PR-144-era work landed today), missing `(public)`/`(onboarding)` groups |
| Mobile auth screens | **Missing entirely** — no login, signup, forgot, reset, OTP, or invite screen exists on mobile |
| Web auth screens | **Partial** — one centred `LoginContent` (signin/signup mode toggle), `login/[org]` branding, handoff redeem. No forgot/reset/OTP/invite. |
| Onboarding flows | **Exists, five machines** (guardian/learner/tutor/business/teacher) with stores + tests + routing, extended today by PR-145 |
| Front-door kit components | **All missing** except `TextField`; `AdaptivePanes` newly available |
| Auth server surfaces | **Partial** — email+password and Expo plugin only; OTP plugin available but unconfigured; no social, no trustedOrigins, no rateLimit |
| Paywall system | **Partial prior art** (paywall/trial/entitlements features exist); **mobile rail absent** (no RevenueCat) |
| Universal links | **Absent** |
| Staging + E2E + copy table | **Absent** |
| Zustand-only law | **24 violations**, several in the front-door path |
| Autofill | **Absent** |

---

## 4 · Open questions (§8) — blocking, in priority order

1. **Where is doc 38?** Without it there are no screen IDs, no copy, no §14 rows. Should I (a) wait for you to add it, (b) draft `docs/pack/38-front-door-and-flow.md` from the audit + docs 05/06/07/36/37 for your review, or (c) build only the unambiguous gaps above?
2. **`prompts/ROSTER.md`** — absent; the roster block cannot be embedded.
3. **Eleven missing skills** (§1 above). The per-screen ledger cannot be produced as specified. Do you want them installed, or the sequence re-scoped to the skills that exist?
4. **Callstack vs Software Mansion** `react-native-best-practices` — the installed one is Software Mansion's. Confirm which governs.
5. **RevenueCat is not installed.** Adding it is a native dependency + prebuild; confirm before I touch the native projects.
6. **No staging environment or EAS staging profile**, and no E2E runner. Every §6 "live check against staging on a physical device" gate is unmeetable today. I also cannot exercise a physical device from here — device recordings and store-sandbox purchases need you.
7. **Provider credentials** — Apple/Google client IDs, the transactional email provider, and the COPPA vendor are not in the repo. Per §2 law 3 I will not pick any.
8. **`PlanCard` naming collision** with the existing study-plan feature — confirm the pricing component's name before it enters the kit.

---

## 5 · Also landed today (context for the diff)

`ops-dashboard` is 4 commits ahead of the `main` merge earlier today: doc-36 role shells + handoff codes (`49e15e6`), doc 37 spec (`f5fc533`), PR-143 pane audit (`a4c7c7d`), PR-145 onboarding beats (`41571d8`), PR-146 AdaptivePanes promotion + mounts. Gates green: typecheck 16/16, `@acme/ui` 104 tests, `@acme/app` 418, web build 44/44 pages, lint 0 errors. The one red gate repo-wide remains the avatar lash-bake golden, which is deliberately awaiting human re-approval.
