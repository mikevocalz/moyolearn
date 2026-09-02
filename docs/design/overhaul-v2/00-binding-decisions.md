# Overhaul v2 — Binding Decisions Digest (pack docs 36/37/38/31/33/34/12)

What it is: condensed index of the pack decisions that constrain every screen in the v2 overhaul.
Why it exists: the per-screen gate cites these instead of re-reading 100KB of pack docs; where this digest and the pack disagree, the pack wins.
Source of truth: docs/pack/* and docs/38-front-door-and-flow.md.
SOT-KEYWORDS: overhaul, binding-decisions, doc-36, doc-37, doc-38, grade-band, paywall, flow-contract

## ROSTER
`prompts/ROSTER.md` does not exist (confirmed repo-wide; docs/38-audit.md:14 already recorded this). The roster *rule* survives in doc 12 §1. Resolution for the overhaul: treat the overhaul prompt's §1 roster table as roster of record until `prompts/ROSTER.md` is authored.

## Doc 36 — role navigation (binding)
- Learner tabs by band, camera always the raised center slot: **K–2 = 3** (Today · Snap · My Stuff; giant tiles, voice prompts, no search, no settings), **3–5 = 4** (Today · Subjects · Snap · Me), **6–8/9–12 = 5** (Home · Subjects · Snap · Progress · You; Home resume-first). Learner web = same IA as Hot top-nav, no sidebar.
- Guardian (Hot) 4 tabs: Home · Reports · **Alerts** (incidents never hide under a bell) · Family. Tutor (Cool) 4: Today · Learners · Notes · You; web sidebar grouped (Neon pattern). Org (Cool, web-first): sidebar Overview · CRM · Scheduling · Money · Safety · Settings; mobile companion 4: Overview · Schedule · Inbox · Safety. District (Phase 3, web-only): Outcomes · Schools · Educators · Compliance · Settings. Platform admin = themed Payload, deliberately not a consumer shell.
- Navigator law (§2): separate navigator tree per role shell, never conditional rendering in one tree; n roles → last-used shell, never a picker wall; deep links resolve in-shell or drop silently. ≤5 top-level destinations, labels visible; role switch = full shell swap, lives in Profile/You.
- Role accent (§5): one system + one `--role-accent` token (+ `-underlay` 24%), OKLCH fixed L≈0.88 C≈0.10–0.13, hue rotated: learner 95° `#FFDB33`, guardian 230°, tutor 300°, org 50°, district 200°, admin = graphite no accent. Allowlist: active-nav underlay, avatar ring, hero band, header underline, email band. Never semantic states, body text, borders, or the primary button (ink-filled everywhere). One accent moment per screen.
- Bundler (§6): **Metro, binding.** Re.Pack declined (Mike, 2026-08-27); Phase-3 re-eval triggers only.

## Doc 37 — panes (binding)
- `TwoPaneShell` = auth/marketing layout, not navigation. Brand pane has **zero interactive content**; below wide width-class it collapses to a compact header band, never a second screen. Keyboard avoidance owns the form pane.
- `AdaptivePanes` = default renderer on every platform (promoted repo implementation); expo-router `unstable-split-view` is an optional iOS renderer, adopt behind the same API **only when it exits alpha**.
- Collapse decided by **width class, never device type**; primary pane wins on collapse; selection state survives the fold in a scoped Zustand store.
- Panes per role: tutor (Learners|detail, Notes|draft), guardian tablet (Reports|report), ops = web sidebar not panes, district = web grid. **Learner: never** — single-focus by design; lifting the ban even for 9–12 requires an ADR.
- Onboarding law (§1): value before signup; ≤3 contextual beats, skippable; never gate on permissions up front (camera at first Snap, notifications after first report).

## Doc 38 — front door + paywalls (binding; lives at docs/38-front-door-and-flow.md, not pack/)
- §0 rule: every cold-launch-reachable screen ships wired to the live provider in the same PR train. Auth screens are screens.
- 26 FD screens + 8 PW surfaces = 34, each with per-screen spec (§5) — these are de-facto Flow Contracts already; reuse, don't re-author.
- Flows: guardian FD-01→03→04→05→10→11→12→13→14→15→Home; learner code path FD-01→08→16→17→Today with ONE action ("Snap your homework"), **child never types credentials**; tutor via FD-09 invite or FD-03; org FD-20→21→22; teacher FD-23 (district SSO/LTI Phase 3); returning FD-02 → role dispatch, FD-06→07 3-step reset (verify code before new password — Better Auth `checkVerificationOtp()`), FD-24 switch profile, FD-25 session ended.
- Paywalls: PW-01 plan+trial (=FD-13/FD-22) · PW-02 trial-ending T−3 sheet · PW-03a guardian limit sheet · **PW-03b learner limit — no prices, no purchase controls, no store links, ever** · PW-04 lapsed (shown once) · PW-05 manage plan · PW-06 restore (mobile) · PW-07 cancel (no retention maze) · PW-08 web billing.
- Entitlement state machine: server truth via RevenueCat/Stripe webhooks → Payload; screens read `entitlement.status ∈ none|trialing|active|past_due|canceled|expired`, never derive from purchase results. Learner column is "nothing" for every paid state.
- Dual-pane numbers (§4): M3 window classes — compact <600dp, medium 600–839, expanded ≥840. Expanded brand 5/12 form 7/12 max 440dp; medium band 160dp form max 480dp; compact band 120dp (96 with keyboard). Learner FD screens single-pane at every width (560dp centered on expanded). Focus never lands in brand pane.
- `AuthPort`: one live impl + one test double; release bundle containing `auth-mock` fails the release job.

## Doc 31 — bands, voice, safety (binding)
- Bands **K–2 · 3–5 · 6–8 · 9–12**; band defaults from grade; `readsAt` override governs voice, curriculum follows grade.
- Voice: K–2 ≤8-word sentences, one question at a time, no idioms/sarcasm/rhetorical questions, FK≈1; 3–5 ≤12 words FK 3–4; 6–8 ≤17 words FK 6–7; 9–12 natural register FK 9–10 ceiling, **no artificial simplification**. Enforced by a post-generation readability gate (+1.5 grade tolerance; rewrite-don't-block).
- Guardrail ladder: S1 log (warm redirect) · S2 flag (auto-escalates on repetition) · S3 incident → guardian, 48h SLA (sexual content, explicit profanity, PII, violence, substances) · S4 urgent — tutoring stops, fixed human-written script (trusted adult + 988), never generated, human paged, 2h SLA. Cursing AND sexual content both reach the guardian as an Incident Report.
- Incident flow: one collection, two intakes, lifecycle new→triaged→in-review→actioned→resolved→closed, append-only timeline, `guardianVisible` default true for S3/S4, transcript excerpts permission-gated references never copies, **the CRM never reads incidents**.
- Screen constraints: intake has no severity choice (redpen appears nowhere on intake); guardian view fixed order What happened → What the tutor did → What happens next → Talk about it, no red page-frames; triage queue severity = 3px border-left + pill, never row-flooding; unassigned-S4 is the only interrupt.

## Doc 33 (PRD) — the 9 non-goals (v1)
1 no learner-to-learner social · 2 on-device voice STT only, children's audio never leaves device · 3 no emotion recognition of minors (permanent) · 4 **no answer mode, ever** · 5 no EU launch (US framing only) · 6 no district/LTI sales motion v1 · 7 no engagement-pressure mechanics · 8 no App Store Kids Category for Shipaton build · 9 no ads / data sale, ever.
- Roles (§5): learner ×4 bands, guardian, human tutor, org staff, platform admin, district (Phase 3). Five shells: learner/guardian/tutor/org/admin. Two clouds: Learning + Operations; **CRM never reads learner data**.
- Doc 08 is law: Hot dial (inset 20–24, rows 64+, ≥40% canvas) learner/guardian; Cool dial (inset 12–16, rows 44–52) ops/admin; one display moment + one highlighter accent per screen; redpen never for struggling learners. Family $11/mo early-bird, $15.99 regular, 1-month trial via RevenueCat; business tiers never rendered to guardians (structural). Learner avatars curated set, no upload.

## Doc 34 — session summary (binding)
- Eight blocks, fixed order, schema-enforced; every claim evidence-linked or it doesn't render. Block 3 accordion **all groups open by default**; status in trajectory language (`solved on their own` grade-green · `solved with help` graphite · `still working on it` highlighter), never pass/fail; redpen only for a wrong answer submitted as done.
- **Movement vs position, never conflated**: mastery delta (celebrated, MasteryBar before→after) vs grade-relative position (honest, normalizing language).
- Never contains: engagement metrics as wins, ability praise, grade predictions, comparisons, or safety content (incidents travel doc 31's channel only).
- Narrative model never sees the transcript — evidence table only. Blocks 3+8 deterministic. Human/hybrid sessions → tutor draft queue (`tutorApprovedBy` required). Teacher share = read-only tokened page, blocks 1–6+8.

## Doc 12 — systems design (binding; wins over earlier docs)
- Doc 12 never mentions `apps/admin*` — it binds a three-surface runtime (Expo app, Next web, internal-only Payload admin) and "one deployable" server core, not folder layout. The apps question is answered by `docs/deploy/moyo-vercel-deployment.md` rev 4 + ADR-004: `moyo-www`=web-vite marketing, `moyo-admin`=admin-vite super admin, `moyo-app`=web (app + district portals). Doc 03's "admin inside apps/web" description is superseded.
- Repositories are the only code touching Payload/Drizzle; three-store separation is schema-level in one Postgres; contract style `POST /api/ops/<domain>.<action>`; no tRPC; `versions: false` on tutor_sessions; messages are their own collection; default-deny RLS.
