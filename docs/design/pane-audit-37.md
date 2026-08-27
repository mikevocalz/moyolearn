# PR-143 · Doc 37 inventory — what exists vs what the doc asks

**Date:** Aug 27, 2026 · **Branch:** `ops-dashboard` · **Scope:** doc 37 §4 PR-143 — existing auth/onboarding screens (§A) + the local adaptive split-view (§B), diffed against `docs/pack/37-onboarding-dual-pane.md`. Verdicts feed PR-144..147.

---

## §A · Auth + onboarding

### A.1 Auth surfaces today

| Surface | File | Layout today |
|---|---|---|
| Web login (plain + district) | `apps/web/app/(auth)/login/page.tsx`, `login/[org]/page.tsx` → `apps/web/components/auth/LoginContent.tsx` | **Single centred pane** (`max-w-sm`), signin/signup as a mode toggle in one component; `BrandLockup` stacked *above* the form — vertical, not a lateral pane |
| Web handoff | `apps/web/app/(auth)/handoff/page.tsx` | Single pane, reads `?code=` |
| Mobile login | — | **Does not exist.** `apps/mobile/app/index.tsx` dispatches `anon → /onboarding`; no `(auth)` group, no login route |
| Mobile handoff | `apps/mobile/app/handoff.tsx` | Deep-link target `moyo://handoff?code=…` |

**PR-144 consequence:** `TwoPaneShell` has exactly one consumer (`LoginContent`, both login routes) — **web-only unless a mobile login route is added**. Parts already built to compose it from: `BrandLockup` (org-aware, cites the Deputy/Expensify brand-panel pattern), `useSizeClass` (`compact|regular` @ 768), `Container` width tokens, `theme/tokens.ts` pane widths, `KeyboardAwareScroll` (exists, **unused by LoginContent** — the doc's keyboard law is currently unmet). The only size-class two-pane precedent is `TutorStage.tsx:424`, but its collapse rule is "drop the pane", not the doc's "collapse to band".

### A.2 Onboarding flows — five step machines exist (guardian S21, learner S22, tutor S23, owner S24, teacher S25), routed via `onboarding/[flow]` on both platforms. Delta per role vs doc 37 §2:

**Guardian** (`GUARDIAN_STEPS = welcome·account·consent·children·grants·handoff·plan`)

| Doc beat | Status |
|---|---|
| Value slide (photography + promise) | **Wrong place, wrong form** — it's the *shared* S14 `promise` step, text-only, before role pick |
| Evidence line ("3-to-1") | **Missing** — string exists nowhere |
| Consent | **Exists, stronger than doc** (verified record) — but S14's three-Switch block duplicates the surface |
| Name the family (personalization) | **Missing** — `account` asks only for an email |
| Add learner | Exists (`children`, DOB-first) |
| Handoff code screen | **Partial** — code-as-hero panel exists; **no QR anywhere in the repo** |
| Family feed "what happens next" card | **Missing** — flow exits to `/` dispatcher |
| *Not in doc* | `grants` is a content-free stub; `plan` (paywall) sits mid-sequence |

**Learner** (`LEARNER_STEPS = avatar·hello·subjects·win`)

| Doc beat | Status |
|---|---|
| Code redeem | Exists, both platforms |
| Avatar pick (curated) | Exists (6 choices) |
| Natalie baked hello | **Partial** — *audio only* (`/api/tutor/voice/baked/greeting-first`, degrades to silent). No clip, no captions, no still-frame swap, no K–2 band take. Copy conflict: screen says "I'm **Moyo**", button says "Hear **Natalie** say hi" |
| Guided first Snap w/ sample worksheet | **Missing** — replaced by `subjects` + `win` MCQ (neither in the doc's sequence) |
| Land on Today | Exists |
| K–2 zero-reading / voice-every-screen | **Missing** — band is persisted on exit but the screens don't branch on it |

**Tutor** (`account·profile·availability·connect·preview`): invite lives in `connect` (step 4, doc says first); notes contextual card at first Notes visit **missing**; `preview` is a front-loaded tour beat the doc would push to context.

**Org** (`org·import·invite·payments·checklist`): Stripe (`payments`) and `invite` are swapped vs the doc's order; seeded example rows on Overview **missing** (flow ends on the activation checklist instead).

**Teacher (S25) exists but doc 37 §2 doesn't mention it** — the doc's per-role list needs a fifth entry or an explicit exclusion.

### A.3 Media + motion + coach marks

- **Photography: zero.** No image anywhere under `features/onboarding/` — every screen is type on `bg-surface`.
- **Lottie/Rive: absent** (no dep, no asset) — consistent with the doc's "micro-transitions only" rule; nothing to remove.
- **Reduced motion: primitive-level only.** `packages/ui/motion.tsx` (`useReducedMotion` → `FadeIn`/`ScaleIn`/`SlideUp`) covers entrances; the doc's **media swap** (clip → still + text) has no mechanism. A second, unwired reduced-motion system lives in `packages/avatar/src/reduced-motion.ts`.
- **Coach marks (PR-147): greenfield.** No component, no seen-once store, no anchor primitive. Prior art to reuse: `pane-overrides.store.ts` (MMKV one-time persistence pattern), `capture/guided-frame.native.tsx` (permission-at-the-camera already honours §1.5), `BottomSheet`/`Toast` as presentation bases.
- **Risk:** no onboarding store uses `persist()` — a mid-flow reload loses the guardian draft (children entered, consent state).

---

## §B · The adaptive split-view

### B.1 What exists — and the one correction to doc 37 §0

`apps/mobile/src/navigation/split-view/` is 37 files: the adaptive navigator (`index.android.tsx`, 2/3-column, Legend Motion pane slides, inspector-as-drawer, panes animate width and never unmount), pure policy modules (`constants`, `pane-overrides`, `pane-search`, `resize`, `back-navigation`, `sticky-header`, `swipe-actions` — all node-tested), chrome (`PaneToggle`, `PaneDivider` drag-resize, `PaneSearchBar`, `DetailNavbar`, `PaneListHeader`, `SidebarSection`, `CollapsiblePane`, `SwipeableRow`), three Zustand stores, a 384-line README, and a hinge-awareness proposal (`PHASE-8-FOLDING-FEATURE.md`, no code).

**Doc 37 §0 calls it "working". It is *written*, not *shipped*:** `grep -rn "navigation/split-view" apps packages` finds **zero imports outside the module**. Nothing mounts it. README's own Phase-7 table lists divider drag and pane transitions as unverified on any device, and focus traversal between panes unimplemented. The schedule feature the README names as its consumer imports none of it.

### B.2 Platform reality — the exact inversion of §3.2

The fork is by filename, no `Platform.OS` anywhere: `index.android.tsx` is the adaptive layout; **`index.ios.tsx` re-exports `expo-router/unstable-split-view`** — so iOS currently gets the alpha renderer the doc says to defer, and never gets the adaptive layout. (Those are the only runtime uses of `unstable-split-view` in the repo; `expo-router 57.0.15`, `react-native-screens ~4.26.0` ≥ the 4.24 floor.)

Portability blockers for "default renderer on every platform":
1. `use-split-view-back.ts` — Android `hardwareBackPress` only; iOS needs swipe-back, web needs history.
2. `pane-overrides.store.ts` — MMKV; web needs a `localStorage` fork (repo's `.native/.web` pattern).
3. Detail pane requires expo-router `<Slot/>`; `apps/web` has no expo-router — needs a `children` escape hatch (which also fixes "host isn't storyable").
4. `react-native-gesture-handler` (`PaneDivider`) not in Next's `transpilePackages`.

The sizing math itself is portable (dp/points, no PixelRatio).

### B.3 Width classes — three competing systems, none shared

| Source | Values |
|---|---|
| Doc 02 §2.1 | compact <600 / medium / expanded / **`large`** ≥1200 dp |
| `split-view/constants.ts` | same numbers **hardcoded**, top class named **`extraLarge`** |
| `packages/ui/size-class.constants.ts` | `compact\|regular` @ 768 — used by `TutorStage`, `DashboardShell` |
| `theme/tokens.ts` breakpoints | Tailwind rem scale (CSS only) |

No dp width-class token exists in `packages/theme`/`packages/ui`. Pane *widths* are tokenized (`pane-primary` 20rem etc.) but `pane-widths.ts`/`resize.ts` duplicate them as raw dp guarded only by a unit test. Doc 02's promised `AdaptiveSplitLayout.Detail` and `AdaptiveDisclosure` exist nowhere.

### B.4 Per-role panes + selection

**Zero panes wired anywhere.** Tutor session-prep, tutor notes (a `DataTable`), guardian reports, and every home screen are single-column with no size-class read. Learner correctly has none (by accident — nothing has any). The three stores hold column/visibility/search state; **no store holds the selected record** — §3.2's "selection survives the fold" is unmet, and `store.ts` being a module-level singleton blocks per-surface scoping (three roles × different panes).

---

## §C · Verdicts feeding the build PRs

**PR-144 `TwoPaneShell`** — build fresh (nothing to promote); web-first with `LoginContent` as the one consumer; compose `BrandLockup` + `useSizeClass` + `KeyboardAwareScroll`; collapse-to-band is new behavior with no precedent.

**PR-145 onboarding** — the machines/stores/routing all exist; the work is beats, not scaffolding: evidence line, name-the-family, QR on the handoff panel, "what happens next" card, guided first Snap, photography slots, Natalie clip contract (blocked externally on doc 32 Path B rendered clips — audio path already degrades gracefully), Moyo/Natalie naming fix, `persist()` on the guardian store, and the reorders (guardian `grants`/`plan`, tutor `invite`, org `payments`↔`invite`). Decide teacher's place in doc 37 §2.

**PR-146 `AdaptivePanes`** — promote the module to `packages/ui/`; delete the platform fork (iOS alpha renderer becomes opt-in, not default); add the dp width-class tokens (rename `extraLarge`→`large`) and reconcile with the 768 `SizeClass` system; add record selection to the store (scoped, not singleton); do the four portability forks; **then mount it** (tutor Learners|detail, Notes queue|draft, guardian tablet Reports|report) and verify on a device — until then §0's "working" stays unearned.

**PR-147 coach marks** — greenfield; MMKV seen-once store on the `pane-overrides.store` pattern; first two targets capture-at-camera and notes-at-notes currently have zero tip surface.
