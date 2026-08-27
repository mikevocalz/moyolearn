# Onboarding & Adaptive Dual-Pane — first impressions, every screen size
**Doc 37 · Moyo platform pack · Date:** Aug 27, 2026
**Scope:** (A) role-scoped onboarding flows with realistic imagery and animation — screen-level treatment on top of doc 36's first-run skeletons; (B) the dual-pane/split-view system: brand+form auth layouts on wide screens collapsing responsively to one pane, and where native SplitView genuinely applies.
**§0 audit-first:** the repo has auth/onboarding screens and (per prior local work) a **working Android 2/3-column adaptive split-view** (Legend Motion, expand/collapse controls). This doc is the target; the build step diffs and moves, never rebuilds (doc 30 §0). I can't read the repo from this environment — PR-143 starts with the route/screen inventory.

---

## §1 · Onboarding law (research-grounded)
1. **Value before signup.** The first screens sell the one promise; account creation comes after the person wants it ([NN/g mobile-app onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/)).
2. **Contextual beats front-loaded.** Long feature tours are skipped and forgotten; teach the camera *at the camera*, the report *at the first report*. Slides carry ≤3 beats, always skippable, dots visible (On's `01/04`, Nibble's dots).
3. **Personalize the instant you know a name.** Nike Run Club's *"WELCOME SAM, YOU'RE IN"* moment converts a form into a relationship — Moyo does it the moment the guardian names the family, and again when the learner redeems the code.
4. **Social proof one line, evidence-flavored.** Strava's *"you're in good company"*; Nibble's App-of-the-Day laurels. Moyo's line is the doc 33 evidence: *"Tutors that guide beat answer-machines 3-to-1 — Moyo never just gives the answer."*
5. **Never gate on permissions up front.** Camera permission is asked at the first Snap, notifications after the first report exists (doc 36 first-run order).

## §2 · The Moyo signature: Natalie-led, realistically imaged
**The mascot-guide pattern (Gentler Streak's "Let's get to know each other") is Moyo's, but real:** onboarding's hero animation is **Natalie's baked greeting clips from doc 32 Path B** — Eleven v3 voice + A2F blendshape performance, rendered once, served from Bunny. The "realistic animation" Mike wants is *the actual product performing*, not a Lottie approximation of it. Rules: clips ≤6s, captioned always, `prefers-reduced-motion` swaps clip → still frame + text, K–2 gets the slower/warmer take (doc 32 band modulation).
**Realistic photography (the On / Nike Run Club / Strava register):** real kitchen tables, real homework mess, real families — full-bleed with the doc 08 ink-on-scrim type treatment. Casting law: diverse families, real desks, **never stock-child-smiling-at-laptop**; photography shows the *moment* (a kid mid-eraser-crumb), not the category. Stills for value slides; Natalie clips for the greeting beats; Lottie/Rive only for micro-transitions (progress ticks, confetti at `celebrate-small` scale).
**Per-role sequences** (screens on doc 36's skeletons):
- **Guardian:** value slide (photography + one promise) → evidence line → consent (plain-language COPPA, doc 33 FR-9.1) → name the family (*personalization moment*) → add learner → **handoff code screen** (the QR moment is designed, not a settings afterthought — it's the product's first magic trick) → family feed with a "what happens next" card.
- **Learner:** code redeem → avatar pick (curated set, doc 30 §8.4) → **Natalie's baked hello, band-voiced** → guided first Snap with a sample worksheet ("try it on this one") → Today. K–2: voice carries every screen; zero reading required to complete.
- **Tutor:** invite → profile → availability → a 30-second "how session notes work" contextual card at the first Notes visit, not before.
- **Org:** owner setup → Stripe Connect → invite tutors → Overview with seeded example rows labeled as examples.

**Amendment (PR-145, Aug 27 2026):** this list omitted the **teacher (S25)** flow, which exists and ships: account → class → roster → assignment. It keeps that sequence as-is; its contextual polish (photography, Natalie beats) is deferred until the guardian/learner treatment has proven out. Two items above are **externally blocked**, not skipped: onboarding **photography** waits on the doc 08-conformant shoot (no asset exists; type-on-surface stays until it does), and **Natalie's baked greeting clips** wait on doc 32 Path B renders — the baked *audio* path shipped and degrades gracefully, but the clip contract (≤6s, captioned, reduced-motion still-frame swap) has nothing to bind to yet. The learner **sample worksheet** for the guided first Snap is likewise an open asset item: until it exists the snap beat honestly offers "try it on your own homework" rather than staging a pretend one.

## §3 · The dual-pane system
**Three different problems wearing one trenchcoat — name them apart:**

### 3.1 Auth/marketing split (the login screen Mike described)
Brand pane (logo + tagline + photography/Natalie still) left, form pane right. **This is layout, not navigation — no SplitView involved.** One responsive component (`TwoPaneShell`, web CSS grid / RN flex) with the collapse law: below the wide breakpoint (doc 02's width classes), **the brand pane collapses to a compact header band** (logo + one tagline line) above the form — it never becomes a second screen and it never scrolls the form out of reach. Hard rule: **the brand pane contains zero interactive content**, so collapsing it can never orphan a control. Keyboard-avoidance owns the form pane; the brand band yields first.

### 3.2 Native list-detail (iPad / tablets / foldables)
**`AdaptivePanes` is cross-platform, and the reference implementation already exists in this repo: the working local 2/3-column adaptive layout** (Legend Motion animated panes, optional search bar, explicit expand/collapse controls) — **proven on Android, and being plain RN, it runs on iOS and web too.** Promote it into `ui/` per doc 30's category-6 rule; it is the default renderer on **every** platform.

**expo-router's [`unstable-split-view`](https://docs.expo.dev/versions/latest/sdk/router/split-view/) is an *optional iOS renderer*, not the headline** — verified against the doc: **alpha**, iOS-only (falls back to a `Slot` elsewhere), **root-layout only** (can't nest, can't sit inside another navigator), headers not customizable yet, up to two `SplitView.Column`s plus an `Inspector` (iOS 26+), iPhone auto-collapse via `topColumnForCollapsing`, `.show()` needs `react-native-screens ≥4.24`. Adopt it behind the same `AdaptivePanes` API **only when it exits alpha and its constraints fit** — until then the local layout serves iOS as well, which also means one behavior to test instead of two. The trade being deferred, honestly: native SplitView buys system polish (pointer/keyboard behavior, sidebar gestures, Stage Manager resize) at the cost of alpha churn + root-only rigidity; the local layout buys total control and identical cross-platform behavior. Revisit when SplitView goes beta.
- **Collapse is decided by width class, never device type** — a folded foldable is a phone, an unfolded one is a tablet, a resized iPad window is whatever width it currently is. Single source: doc 02's breakpoints.
- On collapse, primary pane wins (`topColumnForCollapsing="primary"` / same rule in the Android layout); detail is reached by navigation, back returns to the list; state survives the fold transition (Zustand scoped store holds selection).

### 3.3 Where panes apply per role — and where they're banned
Tutor: Learners|detail, Notes queue|draft. Guardian (tablet): Reports|report. Ops: already a web sidebar app (doc 28) — no SplitView. **Learner: never.** A child's tutoring screen is single-focus by design (doc 08 Hot dial, ≥40% canvas); a split learner UI is attention arbitrage. District: web grid, not SplitView.

## §4 · PRs
- **PR-143 · Inventory** — existing auth/onboarding screens + the local Android split-view vs this doc; delta list.
- **PR-144 · `TwoPaneShell`** — auth/marketing split with collapse-to-band, keyboard law, zero-interactive brand rule.
- **PR-145 · Onboarding flows** — per-role sequences, Natalie baked greeting integration, photography slots, reduced-motion swaps.
- **PR-146 · `AdaptivePanes`** — one API over iOS SplitView + the promoted Android layout; width-class collapse; scoped selection store.
- **PR-147 · Contextual coach marks** — camera-at-camera, notes-at-notes; shown once, dismissible, never modal-stacked.

## §5 · Sources
[NN/g — mobile app onboarding](https://www.nngroup.com/articles/mobile-app-onboarding/) · [Expo Router SplitView (fetched Aug 27 2026)](https://docs.expo.dev/versions/latest/sdk/router/split-view/) · [Apple HIG — split views](https://developer.apple.com/design/human-interface-guidelines/split-views) · Mobbin: [Gentler Streak — character-led personalized welcome](https://mobbin.com/screens/3e1eb0e5-c4d4-48f9-9130-8b8ba1e82190) · [Nike Run Club — personalized "you're in" over real photography](https://mobbin.com/screens/71a1ed74-dc52-4be7-9435-4279182183cd) · [Strava — social proof over full-bleed photo](https://mobbin.com/screens/940e830e-d7b9-4c97-b122-fd6c24d037be) · [On — carousel with progress + dual auth actions](https://mobbin.com/screens/a7e05e78-a6b5-4d2d-926a-bb83e348e284) · [Noom — single hero + one-line promise](https://mobbin.com/screens/cfc2f03f-5df8-4f37-bc4e-6cf0cb0bc96e) · [Nibble — value prop + laurels + dots](https://mobbin.com/screens/43b10bcd-05d6-496b-a3ae-051f56687de5) · [Spotify — feature card + Next](https://mobbin.com/screens/dca01050-bea2-4f0b-b81e-79304ba0337d) · [Liven — full-bleed illustrated welcome](https://mobbin.com/screens/3eb0162b-13f1-4f14-9a8b-352b1a14433a) · Pack docs 02/08/30/32/33/36.
