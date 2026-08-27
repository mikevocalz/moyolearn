# Role Navigation & Flows — one product, five doors
**Doc 36 · Moyo platform pack · Date:** Aug 27, 2026
**Problem (Mike's words):** screens exist, but no proper user flow — what happens when a parent, teacher, district, or student logs in, and what does navigation look like, web and mobile? Plus: each user type gets its own color, but everything still reads as one product.
**Builds on:** doc 02 (adaptive screens), doc 06 (auth, five role shells), doc 08 (design law, Hot/Cool, bands), doc 24 (capture), doc 31 (incidents), doc 33 PRD (personas), doc 34 (reports feed).
**§0 audit-first:** routes and screens already exist in the repo. This doc defines the *target* flow and IA; the build step diffs existing routes against it and moves screens, never rebuilds them (doc 30 §0 convention).

---

## §1 · Research base
- **Multi-role platforms adapt navigation per role — one nav for everyone fails every role.** The LMS case is the canonical example: students, teachers, parents, and administrators each need role-scoped nav and modular role-default dashboards, with RBAC as the technical foundation (Multi-Role UX 2026 guide, createbytes.com). Decluttered, role-scoped menus are the point: an admin sees user management; a learner never does.
- **Mobile: 3–5 top-level destinations, visible labels, no more.** Both platform bibles agree (Apple HIG tab bars · Material 3 navigation bar). Overflowing into a "More" tab is IA failure, not a solution.
- **Children's navigation is its own discipline:** young kids need shallow hub-and-spoke structures, big obvious targets, zero hidden gestures, and instant visible feedback; they don't scan, they don't infer hamburger menus, and mis-taps must be recoverable (NN/g children's UX). This is why the learner shell is **band-adaptive** (§3.1), not one nav.
- **Pattern evidence (Mobbin):** the raised **center primary-action tab** (Speechify: mobbin.com/screens/6fd8ade9-3090-4143-9141-a1c4051a81e2) — the slot Moyo's camera earns; **resume-first home** ("Continue…" as the hero — Skillshare: mobbin.com/screens/eaa37d84-6ac3-44d2-a888-35e0198919db); a calm **3-tab learner minimum** (Babbel: mobbin.com/screens/af715e9f-3b74-4de5-b014-55fa6748aa34); 4-tab utility layouts (Quizlet: mobbin.com/screens/d8bb66b8-7bae-4cc3-8241-7aab8e04be5a · Headway: mobbin.com/screens/b7fa7b42-bea8-4d9d-b89f-1042779ffb17); and for Cool web sidebars, the grouped-sections pattern already banked in the admin prompt (Neon: mobbin.com/screens/5ee84a14-05fb-475b-bc29-7896ee2274b9 · Airwallex: mobbin.com/screens/871a9a24-673e-4994-9da1-b494114e0ab4).

## §2 · The router — one login, five doors
```
login → session { userId, roles[], activeRole, band?, orgId? }
      → role resolution:
          1 role  → dispatch to that shell
          n roles → last-used shell, switcher in Profile (never a picker wall at login)
      → shell dispatch = SEPARATE navigator/layout tree per role (doc 06),
        not conditional rendering inside one tree — a learner bundle should
        not even contain org screens
      → deep links carry through auth: notification → login → the exact
        screen in the CORRECT shell, or dropped if role-mismatched (an
        incident link opened by a learner account goes nowhere, silently)
```
**First-run flows (the missing connective tissue):**
- **Guardian:** signup → verifiable parental consent (COPPA, doc 33 FR-9.1) → create family → add learner (band from grade, `readsAt` optional) → **device handoff**: guardian's app shows a QR/short code; the learner device redeems it — **a child never types an email or password** (doc 06). Land on the family feed with a "first session" card.
- **Learner:** redeems code → picks avatar from the curated set (doc 30 §8.4) → Natalie's baked greeting (doc 32) → lands on Today with one action: *Snap your homework*.
- **Tutor:** org invite → profile → availability → lands on Today's sessions.
- **Org staff:** owner onboarding (org, Stripe Connect, seats) → lands on Overview.
- **District (Phase 3):** SSO/LTI → lands on Outcomes.

## §3 · Per-role IA — mobile tabs · web nav · landing · primary action

### §3.1 Learner (Hot dial, band-adaptive — the K–2 nav IS a safety/usability feature)
| Band | Mobile | Notes |
|---|---|---|
| **K–2** | **3 destinations, hub-and-spoke:** `Today` (Natalie hub, voice-first) · **`📷 Snap` (raised center)** · `My Stuff` | Giant tiles, band type tokens, voice prompts on every screen, zero gestures-only actions, no search, no settings (guardian-side only) |
| **3–5** | 4 tabs: `Today` · `Subjects` · `📷 Snap` (center) · `Me` | Reading nav labels now; progress becomes visible (doc 34-consistent framing) |
| **6–8 / 9–12** | 5 tabs: `Home` · `Subjects` · `📷 Snap` (center) · `Progress` · `You` | Home is **resume-first**: the top card is always "continue where you left off" |
**Web:** same IA as a Hot top-nav (no sidebar — learners don't get dashboards). **Landing, all bands:** Today. **Primary action, all bands: the camera** — it's the product's signature and it lives in the raised center slot on every band.

### §3.2 Guardian (Hot dial)
**Mobile — 4 tabs:** `Home` (family feed: one card per child, doc 34 session cards + upcoming) · `Reports` (the doc 34 trail, per child) · `Alerts` (incidents doc 31 + acknowledgments — its own tab so serious things never hide under a bell icon) · `Family` (children, controls: voice default, session budget, `readsAt`, data & erasure, plan/billing).
**Web:** identical IA as top-nav. **Landing:** family feed. **Primary action:** open the newest report. Multi-child: child-switcher chips on Home, never separate logins.

### §3.3 Tutor / educator (Cool dial)
**Mobile — 4 tabs:** `Today` (sessions timeline) · `Learners` (my roster → per-learner trail) · `Notes` (doc 34 draft queue awaiting approval) · `You`.
**Web sidebar (grouped, Neon pattern):** Today · My learners · Session notes · Incidents (mine + my sessions) · Resources. **Landing:** Today. **Primary action:** start/prep next session. School-teacher variant (share-link viewer, doc 34) is a tokened read-only page — no shell, no login.

### §3.4 Org staff (Cool dial, web-first)
**Web sidebar, grouped:** `Overview` · **CRM** (Leads · Families · Enrollment) · **Scheduling** (resource-major calendar) · **Money** (Payouts · Invoices) · **Safety** (incident queue, doc 31 §5.3) · `Settings`. The doc 23 wall is visible in the IA itself: nothing under CRM can open learner content.
**Mobile — companion, 4 tabs:** `Overview` · `Schedule` · `Inbox` · `Safety`. **Landing:** Overview. **Primary action:** today's exceptions (cancellations, unassigned S-items).

### §3.5 District (Phase 3 — IA now, build later)
**Web only, Cool sidebar:** `Outcomes` (k-anonymous aggregates, doc 21 — suppressed cells say "Not shown") · `Schools` · `Educators` · `Compliance` (consent records, incident stats — counts, never contents) · `Settings`. **Landing:** Outcomes.

### §3.6 Platform admin
The themed Payload CMS (docs 03 + admin prompt) plus canary dashboards. Internal tooling — deliberately not a consumer shell.

## §4 · Cross-role laws
1. ≤5 top-level destinations per shell, labels always visible.
2. Every role lands on *the thing they came to do*, ≤1 tap from launch: learner→camera, guardian→newest report, tutor→next session, org→today's exceptions, district→outcomes.
3. The role switcher lives in Profile/You; shells never blend — switching is a full shell swap.
4. Notification deep links resolve inside the correct shell or die silently (never "you don't have permission" toasts to a child).
5. Android predictive back + iOS swipe-back everywhere; tab roots never trap back.
6. Empty states carry verbs (doc 08); offline states per doc 24; K–2 offline speaks (doc 32).

## §5 · Role color — same product, different door
**The rule that makes "varies in color but same product" true:** one neubrutalist system (doc 08 — paper, ink borders, slab shadows, type ramp, spacing: all invariant) plus exactly **one themed token: `--role-accent`** (+ derived `--role-accent-underlay` at 24%).

**The engineering move — fixed lightness/chroma, rotated hue.** All accents are minted in OKLCH at (approximately) the highlighter's L≈0.88, C≈0.13, hue rotated per role. Because contrast is a function of lightness, **ink-on-accent passes identically for every role** (~14:1, matching ink-on-highlighter from the verified ramp) — one contrast verification covers all roles forever, and every accent fails-as-text/border equally, so the doc 08 underlay-only rule transfers unchanged.

| Role | Hue | Working value (verify with the doc-08 contrast script; `[add]` to tokens.ts) |
|---|---|---|
| Learner | 95° (the brand highlighter, unchanged) | `#FFDB33` |
| Guardian | ~230° sky | `[add] oklch(0.88 0.10 230)` |
| Tutor | ~300° violet | `[add] oklch(0.88 0.10 300)` |
| Org | ~50° tangerine | `[add] oklch(0.88 0.12 50)` |
| District | ~200° teal | `[add] oklch(0.88 0.10 200)` |
| Admin | neutral | graphite ramp, no accent — the back office earns no color |

**Where the accent may appear (allowlist):** active tab/nav indicator underlay · avatar ring · login/onboarding hero band · shell header underline · email header band. **Where it may never appear:** semantic states (redpen/grade-green keep their jobs in every shell), body text, borders, or the primary button (stays ink-filled everywhere — the press physics are the brand, not the hue). Within the learner shell, highlighter keeps its doc 08 dual duty (accent + needs-attention); other shells' accents carry no semantic load, ever. One accent moment per screen — the doc 08 budget applies to the role accent identically.

## §6 · Bundler decision: **Metro — binding** (Re.Pack evaluated and declined)
**Decided (Mike, Aug 27 2026): Moyo stays on Metro.** The evaluation that settled it:
- Expo + Re.Pack is **not officially supported** — it takes a custom bare template plus prebuild/CNG hacks, and the expo-router combo is a community workaround by its own author's admission (repack#1309 · community guide ceopaludetto.com/expo-router-repack). Unsupported bundler path × Expo SDK 57 × expo-router × EAS × a Sep 30 deadline = risk with zero user-visible payoff.
- Callstack's own docs: Metro has less overhead and trades configurability for performance; if you don't need the advanced cases, stick with Metro — with Re.Pack the config and its maintenance are on you (Re.Pack v4 docs).
- **Metro is absorbing the one feature only Re.Pack had:** Module Federation support has landed in Metro with CLI support on the way (metro#1480, cited inside Re.Pack's own discussion) — so the re-evaluation bar is *raised*, not just deferred.
- The goals that motivated the question never needed a bundler: role color = one token (§5); role splitting = separate navigator trees + lazy routes (§2); web splits per route via Next for free.

**Re-evaluation triggers** (Phase 3, and only if metro#1480's Module Federation still doesn't cover it by then): districts demanding an embeddable/independently-updated module; role teams shipping on separate release trains; the org/tutor surfaces becoming a de-facto second app inside the binary.
### Skills & resources (binding for build agents — same tier as the roster rule)
- **github.com/react-native-community/skills** — loaded in every RN build prompt for this repo (navigation, performance, New Architecture skills).
- **metrobundler.dev** and **Expo's Metro customization guide** (docs.expo.dev/guides/customizing-metro) — the two sources of truth for bundler config; no Metro tweak ships without checking Expo's guide first (Expo layers its own defaults over Metro).
- **Metro Module Federation (metro#1480)** — the watch item for the Phase-3 triggers.
- **Re.Pack (github.com/callstack/repack)** — reference only; not in this stack.
- Metro perf hygiene already in the pack: doc 33 NFRs (build size, lazy 3D assets), Callstack/Margelo optimization passes.

## §7 · PRs
- **PR-137 · Route audit** — existing screens vs this IA; the delta doc (move, don't rebuild).
- **PR-138 · Shell dispatch + role switcher** — separate navigator trees, deep-link resolution, silent role-mismatch drops.
- **PR-139 · Learner band-adaptive tab bar** — 3/4/5 destinations, raised camera center, K–2 hub tiles + voice prompts.
- **PR-140 · Guardian + tutor shells** — tabs, family feed landing, notes queue.
- **PR-141 · Role-accent token layer** — OKLCH mint, allowlist lint (accent class usable only on allowlisted slots), contrast script run.
- **PR-142 · First-run flows** — guardian consent→family→device-handoff code; learner redemption; org onboarding.

## §8 · Sources
Multi-Role UX 2026 (createbytes.com) · Apple HIG tab bars · Material 3 navigation bar · NN/g children's UX · Mobbin: Speechify · Skillshare · Babbel · Quizlet · Headway · Neon · Airwallex · Re.Pack · react-native-community/skills · Pack docs 02/06/08/21/23/24/31/33/34.
