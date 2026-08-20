# Moyo — the learning platform pack
**Moyo** (Swahili: *heart*) · tagline: **"Learn it by heart."** · brand spec: doc 02, Addendum B (name pending final trademark clearance)

**Mike W. Allen · Aug 19, 2026**

The mission in one line: help children get a better education — by opening the door 85% of students never open, and by making the humans around each child (parents, tutors, teachers) measurably better at helping them. Every document in this pack exists to serve that line; the privacy invariants aren't compliance overhead, they're child-outcome features.

## Reading order

1. **`01-ai-tutoring-platform-plan.md`** — market research, competitive teardown (Khanmigo's 15% engagement gap is the wedge), pricing, COPPA/FERPA constraints, ADRs (Supabase/Neon, Better Auth, Payload, Stripe, AI boundary), five role shells, screen inventory, roadmap, and the §9 agent-prompt roster + anti-slop gates.
2. **`02-adaptive-screens-design-spec.md`** — the Noto teardown, width classes, the popover→sheet→pane disclosure ladder, screen archetypes, the Neubrutalism × Swiss "Schoolhouse" language, motion spec, verification gates.
3. **`03-starter-tailoring.md`** — the two docs above corrected against your real repo: what already exists (a lot), what changes (Payload 4 canary stays, @acme/ui is the foundation, your window classes and snap points win), the dependency delta, and Phase 0 as seven ordered PRs.
4. **`04-screen-briefs.md`** — every critical screen with Job → Research → Layout → Design → Copy → A11y → Metric. The rule: no screen ships without a filled brief; a screen that can't cite a research finding hasn't been earned.

5. **`05-monetization-access-spec.md`** — pricing/trial research (hard-paywall and trial-LTV data, the post-click-to-cancel legal floor), the 30-day trial + paywall spec per shell, role routing with `Stack.Protected` + the visibility matrix, the Payload internal back office (founder + support), and the two-phase Stripe Connect rail: destination charges + payroll v1, then separate charges & transfers paying tutors directly.

6. **`06-auth-onboarding-spec.md`** — the account model (guardian-created child logins with username-only credentials, grant-access controls, guardian-only resets), verified Better Auth × Stripe wiring (referenceId per family/org, 30-day trials with built-in abuse prevention), COPPA-consent ladder, and the S21–S25 onboarding sequences per profile type.

7. **`07-security-spec.md`** — the device-first security pass: SecureStore policy (2KB rule, biometric-invalidation edges, THIS_DEVICE_ONLY), encrypted MMKV, the parent gate for shared family devices, EAS Update code signing, EXPO_PUBLIC_ discipline, server/data additions, the COPPA written-security-program mapping, and the per-PR security review gate.

8. **`08-visual-hierarchy-spacing-spec.md`** — the research-backed spacing tiers and age-band touch-target tokens (WCAG 2.2 floor → NN/g 2cm child targets), the UI type ramp the token file was missing, the neubrutalist hierarchy law (size/weight/space carry emphasis; borders are structure), component anatomy specs with exact tokens, and the imagery policy with the Pexels mood board.

9. **`09-screens-first-build-order.md`** — **the build order of record:** screens before auth. The Mock-Session Contract (one session interface, mock + live implementations, dev RoleSwitcher with age-band personas) that makes the deferral a provider swap instead of a rewrite, the five-wave roadmap, the guided-path Student Home research, and the per-screen definition of done.

10. **`10-types-components-spec.md`** — the typing contract (one strict tsconfig base, `any` banned, discriminated-union prop APIs, generated domain types, `as const satisfies` tokens) and the responsive reusable-component architecture (one `WidthClass` vocabulary, the CSS-before-JS responsive ladder, the kit contract, typed layout primitives). Read before writing any component in Wave 1/2.

11. **`11-architectural-guardrails.md`** + **`CLAUDE.md`** + **`PROMPTS.md`** — guardrail-coding methodology on the existing stack — **no tRPC, no new dependencies**. The `pnpm gen domain` generator already emits the layered architecture; this doc adds the shared block primitive, the permissions registry, lint rules that turn the generator's header comments into build errors, relationship scoping (identity is never a parameter — the child-safety form of tenant scoping), and the anti-slop/anti-forgetting discipline. `CLAUDE.md` and `PROMPTS.md` drop into the repo as-is.

Build order: doc 11's PR-26 (agent surface + CLAUDE.md) lands in Wave 1 before other work; doc 09 supersedes the PR sequencing in docs 03/05/06 — screens ship against the mock session first; auth lands in Wave 3.

Where documents disagree, the later one wins: security spec > auth spec > monetization spec > briefs > tailoring > design spec > plan (the tailoring doc lists each supersession explicitly).

## Where to start — day one

**PR-0 (an afternoon):** product scope rename; fix the README font drift; add semantic color aliases (`highlighter`, `ballpoint`, `redpen`, `grade`) in `packages/theme/tokens.ts` so renamed scales never leak into feature code.
**PR-1 (day one-two):** the hot/cool dial axis in tokens + `build-css.mjs`; Storybook page rendering every component at both temperatures; automated contrast check over every emitted pair. This makes the design language executable before any new screen exists.

**Week one:** PR-2 (Better Auth: `auth` PG schema, orgs/memberships/guardianship, context switcher in the drawer) and PR-3 (`domain-services` + first platform collections). **Week two-three:** PR-4/5 — schedule persistence + `validate.ts` + the disclosure ladder on the split view. That sequence makes **S1 (Ops Resource Schedule)** the first fully-realized screen — deliberately, because the research says it's the screen that wins paying businesses, and paying businesses are the distribution channel that puts the AI tutor in front of children.

**In parallel, non-code:** run the 2-week research sprint from plan §2.8 (owners, tutors, parents). Its exit criteria are already wired into the briefs — S2's <60s Find-a-Time test is the first acceptance gate.

## The gates (every PR, no exceptions)

`turbo typecheck` green · no invented APIs (cite installed source) · new deps enter through the catalog with versions resolved at install · generated output committed · stories for every new component · contrast check green · screen work matches its brief · the §9 roster header on every agent prompt.

## The two numbers that matter

**Weekly engaged-learner rate** (the anti-15%) and **next-item correctness** (did the child actually get stronger). Every screen brief names which of these it serves. If a feature moves neither, it waits.
