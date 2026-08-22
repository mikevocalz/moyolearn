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

12. **`12-systems-design-prompt.md`** — the systems-design prompt of record (roster-framed per the standing rule): binding high-level architecture (one server core around the Block, one Postgres with schema-level three-store separation, inference gateway as sole model egress), the five binding flows including the fail-closed learner AI turn, pg-boss/caching/SSE decisions with explicit trade-offs, the token-cost scale model, and the agent's deliverables. Where docs disagree, this one wins.

13. **`13-public-api-spec.md`** — the public API (Operations Cloud surface), studied from Noto's live spec and exceeded: registry-derived errors/scopes/docs/SDK, idempotency on all writes, signed webhooks, opaque IDs, sandbox powered by the persona fixtures, and the child-safety line — learner learning data has no public endpoints in any version.

14. **`14-integrations-spec.md`** — the researched integration catalog (Noto/Teachworks/TutorCruncher/classroom/MCP landscapes verified), tiered T1–T8 with phases: money (QBO+Xero native two-way), time (GCal/Outlook/ICS), the classroom-provider adapter Noto lacks entirely, consent-scoped comms, the catalog-generated Zapier/Make/n8n rail, the education-standards track, and the flagship Moyo MCP server. All of it rides the doc-13 API+webhooks — no side doors.

15. **`15-native-ai-client-spec.md`** — Natalie's chat surface built on the Margelo/Callstack stack: streaming client, native sheets and detents, the "thinking" state, and the staged voice plan (v1 on-device `AVSpeechSynthesizer`; the premium Natalie voice with phoneme timing is a Phase-3 server-TTS ADR).

16. **`16-i18n-spec.md`** — one message catalog, two renderers (next-intl on web, `use-intl` core in Expo), locale-aware formatting, and the rule that a language ships only when the Safety Plane can screen it.

17. **`17-interaction-quality-spec.md`** — optimistic coordination (Aurora Scharff's ordered-write pattern, which *is* our ops schedule) and layout/view transitions, with reduced-motion killing the lot.

18. **`18-tutor-ai-stack.md`** — **ADR-018**, the model stack of record: Claude primary, Gemini paired into complementary lanes (not either/or), ExecuTorch at the edge, per-cell eval routing, and the constraint every later doc inherits — **zero model weights in the app binary**; the capability manager downloads everything.

19. **`19-learning-outcomes-spec.md`** — the learning loop at three altitudes: how the tutor gets better at teaching *this* child, how Moyo sees kids improving, and how a district knows the investment paid — one privacy architecture underneath all three.

20. **`20-build-optimization-spec.md`** — Callstack's and Margelo's agent skills wired into the repo, per-platform size budgets with CI ratchets (Expo Atlas as the bundle x-ray), barrel discipline, and a narrow `react-native-runtimes` adoption. Carries doc 18's zero-weights rule forward and extends it: **every Natalie 3D/avatar asset lives on the CDN, never in the bundle.**

21. **`21-bun-gauntlet-spec.md`** — `gauntlet-loop` adopted for the surfaces it's actually built for, and the pnpm → Bun 1.4 migration, phased, with one non-negotiable gate at the front.

22. **`22-embodied-tutor-avatar-spec.md`** — the 3D tutor stage: the working `gnm-avatar` renderer ported to React Native WebGPU (three.js `WebGPURenderer`/TSL), layer-by-layer parity for every shader patch, device tiers with automatic demotion, the on-device golden-image gate, and the child-safety boundary on the *body* — the companionship firewall, reduced motion as a render mode, no paywall on the stage. Fills the `TutorStage` mount point doc 01 reserved; Phase 3+, blocks nothing in Waves 1–2.

23. **`23-tutorstage-handoff.md`** — the build contract for the S9 tutor session surface, written from the TutorStage design canvas: the nine-state discriminated union (including the two states that must exist and are deliberately undrawn), the token map per element, layout at both width classes, the motion table with its reduced-motion column, the 2D↔3D swap contract, and the edge cases. It adds no new decisions — it makes docs 04/07/08/12/17/22 executable for one screen.

**On the numbering:** docs are cited by number throughout the pack, and each doc's own header line is the authority on which number it is. There are no fractional numbers.

Build order: doc 11's PR-26 (agent surface + CLAUDE.md) lands in Wave 1 before other work; doc 09 supersedes the PR sequencing in docs 03/05/06 — screens ship against the mock session first; auth lands in Wave 3.

Where documents disagree, the later one wins: security spec > auth spec > monetization spec > briefs > tailoring > design spec > plan (the tailoring doc lists each supersession explicitly). Two docs win inside their own scope regardless of date: **doc 12** on systems architecture, **doc 22** on the 3D avatar.

## Where to start — day one

**PR-0 (an afternoon):** product scope rename; fix the README font drift; add semantic color aliases (`highlighter`, `ballpoint`, `redpen`, `grade`) in `packages/theme/tokens.ts` so renamed scales never leak into feature code.
**PR-1 (day one-two):** the hot/cool dial axis in tokens + `build-css.mjs`; Storybook page rendering every component at both temperatures; automated contrast check over every emitted pair. This makes the design language executable before any new screen exists.

**Week one:** PR-2 (Better Auth: `auth` PG schema, orgs/memberships/guardianship, context switcher in the drawer) and PR-3 (`domain-services` + first platform collections). **Week two-three:** PR-4/5 — schedule persistence + `validate.ts` + the disclosure ladder on the split view. That sequence makes **S1 (Ops Resource Schedule)** the first fully-realized screen — deliberately, because the research says it's the screen that wins paying businesses, and paying businesses are the distribution channel that puts the AI tutor in front of children.

**In parallel, non-code:** run the 2-week research sprint from plan §2.8 (owners, tutors, parents). Its exit criteria are already wired into the briefs — S2's <60s Find-a-Time test is the first acceptance gate.

## The gates (every PR, no exceptions)

`turbo typecheck` green · no invented APIs (cite installed source) · new deps enter through the catalog with versions resolved at install · generated output committed · stories for every new component · contrast check green · screen work matches its brief · the §9 roster header on every agent prompt.

## The two numbers that matter

**Weekly engaged-learner rate** (the anti-15%) and **next-item correctness** (did the child actually get stronger). Every screen brief names which of these it serves. If a feature moves neither, it waits.
