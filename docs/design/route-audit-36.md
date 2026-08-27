# Route audit — doc 36 target IA vs the repo (PR-137)
**Date:** Aug 27, 2026 · **Branch:** ops-dashboard · **SOT:** docs/pack/36-role-navigation-flows.md §0 §3
**Rule applied (doc 36 §0 / doc 30 §0):** screens already exist as features in `packages/app/features/*`; route files are thin wrappers. "Move" therefore means: re-home the *route* into the role shell and keep rendering the *existing* feature screen. Nothing below rebuilds a screen.

---

## 1 · Mobile — `apps/mobile/app/**`

### What exists today (pre-audit tree)
One shared tree for every role: `(drawer)/_layout.tsx` (role-guarded Drawer) wrapping `(drawer)/(tabs)/_layout.tsx` (one 4-tab bar — Home · Explore · Alerts · Profile — shown to every role), plus drawer stack routes gated by `Drawer.Protected`. Role adaptation happened *inside* screens (`features/home/home-content.tsx` switches on `activeContext.kind`), which is exactly the "conditional rendering inside one tree" doc 36 §2 bans.

### Delta table (mobile)

| Existing route | Verdict | Target home (doc 36 §3) |
|---|---|---|
| `_layout.tsx` (providers root) | **stays** | unchanged, still renders `Slot` |
| `(drawer)/_layout.tsx` | **retired** | replaced by per-role shell groups; the Drawer was the single-tree dispatch this doc removes |
| `(drawer)/(tabs)/_layout.tsx` + `AppTabBar` | **retired** (bar) / **moves** (screens) | each shell owns its own tab layout; `AppTabBar`'s slab visual language is inherited by the new per-shell bars |
| `(drawer)/(tabs)/index.tsx` (HomeScreen role-switch) | **moves, split** | learner → `(learner)/(tabs)/today` (`StudentHomeContent`) · guardian → `(guardian)/(tabs)/index` (`ParentHomeContent`) · tutor → `(tutor)/(tabs)/today` (`TutorTodayContent`) — the three contents already exist in `features/home/` |
| `(drawer)/(tabs)/explore.tsx` | **moves** | `(learner)/(tabs)/subjects` — §3.1's Subjects tab (bands 3–5+) |
| `(drawer)/(tabs)/notifications.tsx` | **moves** | `(guardian)/(tabs)/alerts` (§3.2 — its own tab, never a bell icon) · `(org)/(tabs)/inbox` (§3.4 companion) |
| `(drawer)/(tabs)/profile.tsx` | **moves** | `(learner)/(tabs)/you` (6–8/9–12) · `(learner)/(tabs)/me` (3–5) · `(tutor)/(tabs)/you` · role switcher lives here (§4.3) |
| `(drawer)/capture/index.tsx` | **moves** | `(learner)/(tabs)/snap` — the raised center slot on every band (§3.1) |
| `(drawer)/tutor.tsx` (live session) | **moves** | `(learner)/tutor` stack route |
| `(drawer)/practice.tsx` | **moves** | `(learner)/(tabs)/stuff` (K–2 "My Stuff") + reachable from Today on other bands |
| `(drawer)/plan.tsx` | **moves** | `(learner)/plan` stack route |
| `(drawer)/progress.tsx` | **moves** | `(learner)/(tabs)/progress` (6–8/9–12 tab; L2 for 3–5) |
| `(drawer)/ai-activity.tsx` | **moves** | `(guardian)/ai-activity` stack route (deep-linked from Alerts/Family) |
| `(drawer)/memory.tsx` | **moves** | `(guardian)/memory` stack route (Family → data & erasure) |
| `(drawer)/family-calendar.tsx` | **moves** | `(guardian)/family-calendar` stack route |
| `(drawer)/session-prep.tsx` | **moves** | `(tutor)/(tabs)/learners` — the roster→per-learner-trail §3.3 asks for is what session-prep already reads |
| `(drawer)/settings.tsx` | **moves** | `(guardian)/(tabs)/family` (§3.2 Family = children + controls + plan/billing — SettingsScreen carries those controls) · also `(tutor)/settings`, `(org)/settings` stack routes |
| `(drawer)/editor-settings/index.tsx` | **moves** | `(tutor)/editor-settings` (staff surface) |
| `(drawer)/split/*` (schedule split view) | **moves** | `(org)/(tabs)/schedule` (resource-major calendar, §3.4) — split-view internals unchanged |
| `onboarding/index.tsx`, `onboarding/[flow].tsx` | **stays** | first-run flows keep their routes; PR-142 extends the *steps*, not the routes |
| `+not-found.tsx` | **stays, behavior change** | becomes the silent deep-link drop (§4.4): unresolvable/role-mismatched links land here and redirect home with no permission copy |

### Missing → build (mobile)
- **Shell groups** `(learner)` `(guardian)` `(tutor)` `(org)` with `Stack.Protected` guards — separate navigator trees per §2 (PR-138).
- **Root dispatcher** `app/index.tsx` — role resolution: 1 role → its shell; n roles → last-used (persisted MMKV), never a picker wall (PR-138).
- **Learner band-adaptive tab bar** — 3/4/5 destinations from `gradeBand` (`young`→K–2 3 tabs · `child`→3–5 4 tabs · `teen`/`adult`→5 tabs), raised center Snap on every band, K–2 hub tiles (PR-139).
- **Guardian/tutor/org tab layouts** (PR-140) — new `_layout` + thin route files only; every screen behind them exists.
- **Device-handoff** — guardian `handoff` step + code service + learner redeem entry (PR-142). No prior art in the repo (grep: no handoff/redeem hits).
- **Org mobile Safety tab** — no mobile incident-queue screen exists (`features/safety` is service-only; the guardian-side UI is `ai-activity/safety-section.tsx`). Built as a thin queue over the existing `/api/safety/incidents` route in a later pass; the tab slot is reserved in the org layout and points at Inbox until then. Honest gap, stated here rather than faked.

## 2 · Web — `apps/web/app/**`

Web already separates the big shells by route group — the audit finding is that the *groups* are right and the *nav inside `(site)`* is role-blind.

| Existing | Verdict | Notes |
|---|---|---|
| `(auth)` login + onboarding | **stays** | first-run flows S21–S25 live here; PR-142 extends steps |
| `(site)` shared pages (reports, schedule, progress, practice, capture, memory, ai-activity, family-calendar, plan, explore, notifications, profile, settings, session-prep, report-queue) | **stays** | routes keep their URLs (deep links, notification links already point here) |
| `(site)` `SiteHeader` single `NAV_ITEMS` | **replaced** | one static nav for every role violates §3; nav items become per-role (learner Hot top-nav Today/Subjects/Snap/Progress · guardian Home/Reports/Alerts/Family · tutor Today/Learners/Notes) driven by `useAppSession().activeContext.kind` |
| `(session)/tutor` | **stays** | the learner live session, already chrome-free |
| `(ops)/ops` | **stays** | org shell — DashboardShell sidebar already implements the Neon grouped pattern |
| `(share)/share/report/[token]` | **stays** | the §3.3 school-teacher tokened read-only page — already no shell, no login |
| `(payload)` admin | **stays** | §3.6 — deliberately not a consumer shell |

Missing → build (web): per-role `NAV_ITEMS` (done in this change); district shell (§3.5) is Phase 3 — IA recorded, nothing built, per the doc.

## 3 · Shell IA as built (with Mobbin structure refs)

- **Learner** K–2: Today · Snap(center) · My Stuff — 3–5: Today · Subjects · Snap(center) · Me — 6–8/9–12: Home · Subjects · Snap(center) · Progress · You. Refs: Speechify raised center (mobbin.com/screens/6fd8ade9-3090-4143-9141-a1c4051a81e2), Babbel 3-tab (af715e9f-3b74-4de5-b014-55fa6748aa34), Quizlet 4-tab (d8bb66b8-7bae-4cc3-8241-7aab8e04be5a), Breathwrk raised primary + You (0591b7d1-ac2c-4b5a-88f9-880730ab8545), Skillshare resume-first (eaa37d84-6ac3-44d2-a888-35e0198919db).
- **Guardian**: Home · Reports · Alerts · Family. Refs: Skillshare resume-first (eaa37d84), Headway 4-tab (b7fa7b42-bea8-4d9d-b89f-1042779ffb17), Oura Today-feed 3-tab (bce8101b-5be9-4cef-a9c7-e7a9d88d12c6), Garmin Connect activity feed cards (31580095-08ba-4849-b5dd-23554d4cf6e0).
- **Tutor**: Today · Learners · Notes · You. Refs: Quizlet 4-tab (d8bb66b8), Noom today-plan timeline (b3115f13-4888-4643-bdcf-bd43a916432a), pliability day-selected session list (d85a40ef-63f9-439e-adac-9c673e57963f).
- **Org companion**: Overview · Schedule · Inbox · Safety(reserved). Refs: Neon grouped sidebar (5ee84a14-05fb-475b-bc29-7896ee2274b9), Airwallex (871a9a24-673e-4994-9da1-b494114e0ab4), Headway 4-tab (b7fa7b42).

## 4 · Deep-link law (§4.4) as implemented
`Stack.Protected` purges other roles' shells from the route table, so a role-mismatched deep link (incident link on a learner device) matches nothing → `+not-found` → immediate `<Redirect href="/" />` → the dispatcher lands the child on their own Today. No toast, no permission copy, no error surface — the link just goes nowhere, per §4.4.

## 5 · Handoff-code contract (PR-142, doc 36 §2)
- `POST /api/handoff` — guardian session, `protectedOperation` (identity from ctx; the child is a *resource*, verified against the `guardianships` collection server-side, never trusted from the client). Rotates the learner's credential to a one-time secret, stores only a hash + expiry in `handoff-codes`, returns `{ code, expiresAt }` — 6-char A–Z/2–9 short code, also rendered as QR (`moyo://handoff?code=…`).
- `POST /api/handoff/redeem` — anonymous by design: the code IS the credential, exactly like a password at `/api/auth`. Validates hash + TTL + single-use, then signs the learner in through Better Auth's own username sign-in, which sets the session cookie. A child never types an email or password; they type (or scan) a 6-character code once.
- Codes: 15-minute TTL, single-use, hash-at-rest, redemption marks `redeemedAt` and the row is dead.
