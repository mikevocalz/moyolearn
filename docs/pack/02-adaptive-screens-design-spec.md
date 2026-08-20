# Adaptive Screens & Design Language Spec
**Companion to:** `ai-tutoring-platform-plan.md` · **Date:** Aug 19, 2026
**Skills applied:** design-critique, frontend-design, design-system, design-handoff, accessibility-review
**Roster (standing rule, never dropped):** all engineering prompts derived from this spec carry the §9 roster from the plan doc — for this spec's seams, the operative tiers are Expo Router creator-tier (SplitView backends), Apple visionOS/HIG author-tier (adaptive presentation, popover→sheet adaptation), Reanimated/gesture author-tier (tile physics, sheet mechanics), Marc Rousavy (Nitro/JSI) for any native seam, and TypeScript language-architect tier for the layout/disclosure contracts. No invented APIs; every library claim below is pinned and source-verified; stop-and-ask on uncertainty.

---

## 1. Noto teardown (from the provided screenshot: desktop ops dashboard + tutor mobile app)

### First impression
Desktop reads instantly as a calm, competent back office: sidebar → activity feed → persistent inspector. Mobile reads as a *different product for the same person* — a today-first run list, not a shrunken dashboard. That instinct (re-project, don't shrink) is the single most important thing to steal. Biggest opportunity: the visual identity is anonymous soft-SaaS — pleasant, forgettable, zero risk taken. That's the gap our design language exploits.

### Patterns to adopt (with where they land in our system)

| # | Noto pattern (observed) | What it does | Where it lands for us |
|---|---|---|---|
| 1 | Persistent right inspector (Geometry class: schedule, Instructor, Roster, Details, Class settings) | Selection inspects; it never navigates. Operators scan dozens of records without page churn | `AdaptiveSplitLayout.Detail` on expanded/large; the L2 tier of the disclosure ladder (§3) |
| 2 | Collapsible inspector sections (chevrons on Instructor / Class Roster / Details) | Long records stay scannable | `InspectorSection` component; persist open/closed state per user per record type |
| 3 | Mobile = today-first re-projection (week strip → "Next" card → "Upcoming" list) | The phone answers one question: what's next and what do I do about it | Tutor **Today** tab and Student **Plan** tab are exactly this projection |
| 4 | Primary action inside the card ("Take attendance ↗" lives in the AP Chemistry card) | Zero-navigation completion of the most likely task | Rule: every schedule card carries its single most-likely action inline — Join / Prep / Take attendance / Pay — chosen by role + event state |
| 5 | Ruthless mobile nav reduction (4 tabs vs ~13 desktop destinations) | Mobile is jobs-to-be-done, not feature parity | Already our tab-bar spec; this screenshot is the proof it works in-market |
| 6 | Horizontal upcoming rail (Class 3/4/5 cards, edge-cut to signal scroll) | Glanceable pipeline without a grid | `CardRail` on Ops Overview and Teacher Home; edge-peek 16–24px is mandatory (the cut card *is* the scroll affordance) |
| 7 | Activity timeline mixing system + human events, entity names bolded, red badge only on exceptions ("overdue for Geometry class payment") | One feed = narrative of the business; color is reserved for exceptions | `ActivityTimeline` on Ops class/student detail; maps 1:1 to our `auditEvents` + domain events |
| 8 | Avatar stack with +N overflow on class occurrence cards | Roster density without a list | `AvatarStack` (max 4 + overflow chip) |
| 9 | Week strip with selected-day ring (S–S, 11–17, "T 15" outlined) | Calendar orientation in 44px of height | `WeekStrip` — student/parent/tutor compact calendars; swipe-paged with haptic detents |
| 10 | Metadata discipline: cards show exactly two facts (time + enrollment; time + assignment due) | Scan speed | Card content budget: 1 title, 1 time row, ≤2 metadata rows, ≤1 action. Enforced in component API, not convention |

### Where we beat it (award-level gaps)
1. **Identity:** near-white surfaces, lavender wash, default rounded cards — no brand risk anywhere. Our ink system (§5) is the differentiation.
2. **No visible command layer:** no ⌘K, no find-a-time. Our `FindTimeCommand` is omnipresent on scheduler surfaces.
3. **Fixed density:** one visual temperature for everything. We run a density/tone dial per shell (§5.3).
4. **Contrast risk:** the gray secondary text on white in the screenshot looks near/below 4.5:1 — we enforce AA in tokens and CI, and it costs us nothing because ink-on-paper is our aesthetic.
5. **Disclosure is desktop-only thinking:** their inspector has no visible phone equivalent in this shot. Our disclosure ladder (§3) is one continuum from hover-peek to bottom sheet.

---

## 2. The adaptive layout system

### 2.1 Width classes and pane budget

Breakpoints follow window size classes (measured on the app window, not the device — split-screen multitasking and dual-screen halves reclassify honestly):

| Class | Window width | Pane budget | Primary pane | Detail pane |
|---|---|---|---|---|
| **compact** | < 600dp | 1 | collapses into header controls (filter button, child-picker chip) | **Gorhom bottom sheet** |
| **medium** | 600–839dp | 2 | rail (icons) or hidden | second column on selection |
| **expanded** | 840–1199dp | 2–3 | collapsible column (his working expand/collapse pane chrome) | persistent column |
| **large** | ≥ 1200dp | 3 | full column | persistent column |

### 2.2 Backend resolution (one contract, three implementations)

`AdaptiveSplitLayout` (Primary / Content / Detail) resolves per platform:
- **iOS/iPadOS:** Expo Router SplitView — used strictly within its documented constraints (alpha API, root-level only, not nestable, up to two columns before content + trailing inspector). No screen imports it directly.
- **Android:** **the local Android split view already working (2- and 3-column)** — it is the Android backend of the same contract, keeping its explicit pane expand/collapse buttons and optional search-bar slot; pane transitions stay on Legend Motion (`@legendapp/motion`) as implemented. Rule: one animation driver per subsystem — panes animate via Legend Motion, sheets/tiles via Reanimated; never both on the same element.
- **Web/desktop:** CSS grid panes with identical class thresholds.
- Contract invariant: pane composition is declared semantically per screen; the backend never leaks upward. A screen says "Duet with Detail-on-selection," never "SplitView with inspector."

### 2.3 Dual-screen & foldables (the 2-view case)

- The hinge is a **hard pane boundary**. Each half is measured and classed independently (two compact halves ≈ two phones side by side; two medium halves = a natural Duet).
- **Cross-hinge inspection is the signature dual-screen move:** tap an event on the left half → Detail fills the right half. No popover, sheet, or dialog ever straddles the hinge.
- Tabletop posture (half-folded, horizontal hinge): Content on the upper half, actions/composer/sheet content docked to the lower half.
- Focus surfaces (Tutor Room) span fullscreen and treat the hinge as a safe-area inset, never as a layout boundary.

---

## 3. The disclosure ladder (popover → sheet → pane, one system)

Four levels, one shared selection state. This is the pattern the calendar-event tap runs on, and it is platform-sanctioned: the HIG's own adaptation rule is that popovers become sheets in compact width — we're formalizing the native behavior, not inventing one.

| Level | Name | Content budget | compact | medium | expanded/large | pointer (web/iPad+trackpad) |
|---|---|---|---|---|---|---|
| **L0** | Glance | the event tile itself: time, name, mode chip, status ink | tile | tile | tile | tile |
| **L1** | Peek | who/when/where/price + **two** actions max | **Gorhom sheet @ ~45% snap** | anchored popover (PanelUI popover primitive) | selection highlights + Detail pane populates (peek and inspect merge) | hover 400ms → non-modal mini-popover; click → select |
| **L2** | Inspect | full record: collapsible sections (Noto pattern) — details, roster, billing, attendance, notes, activity | same sheet dragged to ~92% snap | Detail pane replaces/slides in | persistent Detail pane | Detail pane |
| **L3** | Edit | reschedule / cancel (policy-aware) / attendance / notes form | full-screen pushed route | modal or pushed route in Detail slot | form takes over Detail pane; destructive confirms via `ConfirmSheet` | same |

Rules that make it feel designed rather than assembled:
- **One selection store.** Selecting a tile at L0 *is* opening L1; dragging the sheet up *is* L2. Rotating an iPad mid-peek re-renders the same selection in the new container (sheet → pane) without losing state.
- **L1 carries exactly two actions,** chosen by role + event state: student → Join / Reschedule request; tutor → Prep / Start; scheduler → Edit / Message; parent → Pay / Reschedule. Everything else lives at L2.
- **Sheets are for context-keeping** (calendar stays visible behind at 45%); pushed routes are for commitment (L3 edits). Never push a route just to show L1 content.
- **Popovers never scroll more than their own content budget.** If it needs to scroll, it's L2 content in the wrong container.

### 3.1 Bottom-sheet engineering spec (verified)

- Library: `@gorhom/bottom-sheet` **pinned ≥ 5.1.8** — the floor Reanimated's own 3→4 migration guide names for Reanimated v4 support. **Gate:** open issues exist for some 5.2.x × Reanimated 4.3.x combos (sheet fails to open/animate), so CI smoke-tests the sheet against the repo's exact Reanimated 4 version before the pin is accepted; fallback if the combo is broken at install time: PanelUI's sheet primitive (already Reanimated-4-native, since PanelUI is built on Reanimated 4).
- Config: snap points `['45%','92%']`, `BottomSheetScrollView` for L2 content, backdrop with tap-to-dismiss at L1 only (L2 requires explicit close or drag), grabber visible, `keyboardBehavior="interactive"` for the notes/quick-edit field, `android_keyboardInputMode="adjustResize"`.
- Accessibility: sheet traps focus while open, announces "Session details, Maya Johnson, sheet, swipe up for more," Escape/back gesture dismisses, 44pt grabber hit-slop.

---

## 4. Screen archetypes and per-role responsive behavior

Five archetypes cover every screen; each screen declares one. Archetype × width class fully determines pane composition, so responsiveness is a lookup, not a per-screen improvisation.

| Archetype | Panes (semantic) | Used by |
|---|---|---|
| **A · Triptych** | Primary (filters/contexts) · Content (collection) · Detail (inspector) | Ops schedule, CRM pipeline, Students, Inbox, Marketplace search |
| **B · Duet** | Content · Detail | Tutor Today+Prep, Parent Calendar+Detail, Teacher Class+Detail, Student Week+Today (tablet) |
| **C · Focus** | single immersive stage | Tutor Room, AI session, onboarding, checkout |
| **D · Feed** | single column, max-width 680, centered ≥ expanded | Student Home, Parent Home, Notifications |
| **E · Board** | dense grid/canvas + optional Detail | Analytics, Learn subject map, Utilization heatmap |

### 4.1 Calendar per role (the hero system)

| Role | compact | medium | expanded / large | dual-screen |
|---|---|---|---|---|
| Student (Plan) | WeekStrip + mixed agenda (sessions+homework+AI, one timeline); tap → sheet | Duet: week grid · today list | Duet stays — a child never gets the Triptych | week grid ‖ today list |
| Parent | family agenda + child-picker chips; tap → sheet (Pay/Reschedule at L1) | month/agenda · Detail on selection | Triptych only when >1 child (children/filters column); else Duet | calendar ‖ event detail |
| Tutor | **Today run-list** (Noto mobile pattern: Next card w/ inline Prep) | Duet: day/agenda · Student Prep | Triptych: filters+views · schedule · **Prep pane** (learning context, not ops metadata) | schedule ‖ prep |
| Scheduler | day agenda + persistent Find-a-Time button; results as sheet | Duet: resource day · Detail | **Full Triptych command center:** filters/people/rooms · ResourceLane grid · Session inspector | resource grid ‖ inspector |
| Owner/Manager | ops summary (Today: sessions/confirmed/attention counters) | Duet: calendar · issues | Triptych with business inspector (billing, tutor pay, utilization) | calendar ‖ inspector |
| Teacher | academic agenda (classes, due, office hours) | Duet: class calendar · detail | Triptych: classes · calendar · assignment/student detail | calendar ‖ detail |

**Hero state — Ops schedule, large (Triptych):**
```
┌──────────────┬────────────────────────────────────┬───────────────────┐
│ ‹ collapse   │  TUE AUG 18      Day Week Res ⌘K   │ SESSION           │
│ Views        │  9    10    11    12    1    2     │ Maya Johnson      │
│ · Today      │ JAMES  ▓▓▓▓▓▓        ▓▓▓▓▓▓▓▓     │ Algebra II        │
│ · Week       │ AISHA       ▓▓▓▓▓▓                │ Tue 4–5 PM        │
│ Tutors       │ DANIEL ▓▓         ▓▓▓▓▓▓          │ ▸ Instructor      │
│ ☑ James      │ ROOM A ▓▓▓▓▓ ▓▓▓▓▓                │ ▸ Roster (6)      │
│ ☑ Aisha      │ ROOM B      ▓▓▓▓▓▓▓               │ ▸ Billing $75/$42 │
│ Rooms  Progs │ VIRTUAL ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      │ [Edit] [Message]  │
└──────────────┴────────────────────────────────────┴───────────────────┘
```
Tiles are `InkTile`s (§6); clicking populates the inspector (L1≡L2 merged); dragging a tile reschedules with snap + conflict/travel validation live.

**Hero state — Tutor, compact (Today + sheet):**
```
  Tuesday, Aug 18 · 6 sessions          ┌────────────────────────┐
  ┌──────────────────────────┐          │ ══ grabber ══          │
  │ 9:00  MAYA JOHNSON       │   tap →  │ Maya Johnson · Alg II  │
  │ Algebra II · Virtual     │          │ Today 9:00 · Virtual   │
  │ AI PREP: struggled w/    │          │ [ Prep ]   [ Start ]   │
  │ factoring in 2 AI sess.  │          │ … drag up: mastery,    │
  │ [ Prep ]      [ Start ]  │          │ notes, history, billing│
  └──────────────────────────┘          └────────── 45% ─────────┘
```

**Dual-screen (parent, two medium halves):**
```
┌─────────────────────────┐ ‖ ┌─────────────────────────┐
│  AUGUST  · Maya ● Noah ▲│ ‖ │ SESSION                 │
│  family month grid      │ ‖ │ Maya · James · Alg II   │
│  (tap any event…)       │ ‖ │ Thu 4:00 · $75 prepaid  │
│                         │ ‖ │ [Reschedule] [Message]  │
└─────────────────────────┘ ‖ └─────────────────────────┘
        left half tap → right half inspects (no popover crosses the hinge)
```

### 4.2 Non-calendar Triptychs inherit identically
CRM (Pipelines · Leads · Lead inspector), Students (Filters · List · Profile), Inbox (Inboxes · Threads · Thread+profile), Marketplace (Filters · Results · Tutor detail/booking). Same disclosure ladder: compact list → sheet peek → pushed detail; expanded three panes. Learned once, true everywhere — that consistency is itself the award-craft.

---

## 5. Design language: **Neubrutalism × Swiss** ("Schoolhouse")

### 5.1 The blend, and why this pairing
Raw neubrutalism (thick ink borders, hard offset shadows, flat saturated fills, chunky grotesques) is perfect for the learner's world and fatal at ops density — 2px borders and 4px shadows on 200 calendar cells is noise. Its natural partner is **Swiss/International Typographic Style**: strict grid, typographic hierarchy, functional color, generous negative space. Brutalism and Swiss share DNA (honesty of structure, no ornament), so the blend reads intentional rather than themed: **Swiss discipline is the skeleton everywhere; neubrutalist ink is the voice, turned up or down per shell.** The screenshot's soft-lavender SaaS look is exactly what this refuses to be.

### 5.2 Tokens (palette grounded in the subject's own materials — school supplies on paper)

| Token | Hex | Role |
|---|---|---|
| `paper` | `#FBFAF7` | surfaces (learner surfaces may add a faint graph-grid overlay, ballpoint @ 6–8%) |
| `ink` | `#17150F` | text, borders, shadows — the brand pigment |
| `ballpoint` | `#2547E8` | primary actions, links, selection |
| `highlighter` | `#FFE94A` | attention/selected marker — background only, always with ink text |
| `redpen` | `#D93A25` | overdue/error/needs-attention — semantically instant in education |
| `grade-green` | `#1E7F4F` | success/mastered/paid |
| `graphite` | `#5F5B54` | secondary text |

Contrast targets (AA floor; values chosen to clear it, re-verified by an automated token test in CI, not by eye): ink/paper ≈18:1, graphite/paper ≥5:1, ballpoint/paper ≥6:1, ink-on-highlighter ≥12:1, redpen-text/paper ≥5:1, white-on-ballpoint ≥6:1. Redpen is never used as a text-on-fill pair with white below 18pt — use redpen text on paper or ink on a redpen tint.

Type stack (all OFL / Google Fonts; load via the matching `@expo-google-fonts/*` packages — verify exact package ids at install per the no-guessing gate):
- **Display:** Bricolage Grotesque — characterful, chunky at heavy weights, unmistakably not Inter.
- **UI/body:** Schibsted Grotesk — high legibility at density, real distinction from the display face.
- **Data:** Spline Sans Mono, tabular figures — every time, price, percentage, and mastery number in the product. Mono data columns are simultaneously Swiss, brutalist, and genuinely functional in calendars.

### 5.3 The dial: one DNA, two temperatures

| Property | **Hot** (Learner/Family surfaces) | **Cool** (Ops/Educator/Institution) |
|---|---|---|
| Border | 2px solid ink | 1px ink @ 80% |
| Shadow | hard offset `4px 4px 0 ink` | none, or `2px 2px 0` ink @ 10% on interactive cards |
| Radius | 14 (chunky-friendly) | 8 |
| Fills | saturated (ballpoint, highlighter, subject colors) | paper/white; color = status semantics only |
| Type | Bricolage display freely; big sizes | Bricolage at page titles only; Schibsted everywhere else |
| Motion | tactile physics (§6), playful | 120–160ms utility transitions |

Same ink, same paper, same radii family, same type stack → one brand across a kid's practice screen and an owner's payroll table. Parent surfaces sit between: cool structure, hot accents on child-related cards.

### 5.4 Signatures (boldness spent in exactly one place per shell)
- **Learner:** the tutor-presence avatar (already the platform signature — tab icon → session stage → future AR body).
- **Ops:** **tactile tiles** — schedule blocks that physically press, lift, and snap (§6). The scheduling command center should *feel* like moving magnets on a steel board; nobody in the Teachworks/TutorBird cohort has an interaction worth remembering, and this is ours.
- Everything else stays quiet and Swiss. Refused defaults (per the frontend-design calibration): warm-cream + serif + terracotta; near-black + acid-green; broadsheet hairlines. Also refused: the screenshot's lavender-wash SaaS neutrality.
- **Open design question (flagged, not decided):** whether 15–18-year-olds get the full Hot dial or a mid setting — neubrutalism can read young to a test-prep teen. Recommend an age-band token (`hot` / `hot-muted`) decided by learner grade band, and validated in the usability round from the research plan.

---

## 6. Interaction & motion spec (the award layer)

| Interaction | Behavior | Feel |
|---|---|---|
| Tile press (`InkTile`) | translate `2,2`, shadow `4,4,0 → 2,2,0`, 80ms ease-out; release springs back | the tile is a physical chip being pressed into the paper |
| Tile drag (reschedule) | lift: shadow `6,6,0`, slight scale 1.02; snaps to 15-min grid with `selection` haptic per snap; invalid targets (conflict / travel-infeasible / outside availability) render redpen hatch and refuse the drop with `notification-error` haptic | scheduling feels like moving magnets; the engine's rules are *felt*, not toasted |
| Drop commit | shadow snaps to rest, `success` haptic, inspector updates in place | |
| Sheet | snap 45/92 with `light` haptic per detent; backdrop fade 0.4 | |
| WeekStrip | swipe-paged weeks, `selection` haptic per page (habit-calendar reference behavior) | |
| Popover (medium/pointer) | 120ms scale-from-anchor 0.96→1, ink border, hard shadow at the current dial temperature | |
| Reduced motion | all offsets/springs replaced with instant state + opacity; haptics retained (they're not motion) | accessibility floor, not an afterthought |

Drivers: tiles/sheets/popovers on Reanimated (worklets, 60fps under load); Android pane chrome stays on the existing Legend Motion implementation — the two never animate the same element.

---

## 7. Component deltas (added/changed vs. the plan doc's library)

| Component | Purpose | Key API/states |
|---|---|---|
| `AdaptiveDisclosure` | resolves L1/L2 into popover / sheet / Detail pane from width class + selection store | `level`, `anchor`, controlled `selection`; container swap preserves state on rotation |
| `InkTile` | pressable/draggable event tile with press/lift/snap physics + status inks | `status: default·attention·overdue·selected`, `dial: hot·cool`, drag-validate callback |
| `EventPeek` | L1 content budget enforcer (2 actions max, role-aware) | `role`, `event`; overflow is a type error, not a scroll |
| `InspectorSection` | collapsible Detail sections (Noto pattern) with persisted open state | `id`, `defaultOpen` |
| `WeekStrip` | 7-day strip, selected-day ring, swipe paging + haptics | `selected`, `markers` |
| `ActivityTimeline` | mixed system/human event feed, bolded entities, exception badges | maps `auditEvents` + domain events |
| `AvatarStack` | max 4 + `+N` chip | |
| `CardRail` | horizontal rail with mandatory 16–24px edge-peek | |
| `HingeAwarePane` | dual-screen pane placement + cross-hinge inspect wiring | posture: `flat·book·tabletop` |
| `SheetForm` | keyboard-interactive quick-edit inside the sheet (notes, attendance) | Gorhom `keyboardBehavior` wired |

---

## 8. Verification gates (design quality as CI, per the standing anti-slop standard)

1. **Screenshot matrix:** every archetype's gallery route rendered at 390 / 744 / 1024 / 1280 dp + one folded posture; visual regression on PRs.
2. **Token a11y test:** automated WCAG contrast check over every fg/bg token pair per dial; failing pair fails the build.
3. **Disclosure invariants tested:** rotate-mid-peek preserves selection; sheet never appears ≥ medium for L1 when a pane exists; no popover renders across a hinge.
4. **Device matrix:** iPhone, iPad (portrait+landscape, Stage Manager narrow), Pixel phone, Pixel Tablet/Fold (his working Android split view), desktop web at all four classes.
5. **Interaction budget:** tile press < 16ms to first frame; drag at 60fps with 40 visible tiles (profiled, not assumed).
6. **A11y pass per release train:** keyboard path through Triptych (arrow-key tile navigation, Enter = inspect, Esc = collapse Detail), screen-reader labels on every tile ("Maya Johnson, Algebra Two, four to five PM, virtual, selected"), 44pt targets including sheet grabber.
7. **Award-craft review:** one deliberate signature per shell present; no refused-default aesthetics anywhere; copy follows sentence-case action-verb rules (buttons say what happens: "Take attendance," "Reschedule session").

---

## Addendum A (v2, researched) · The blend: "Schoolhouse Modern," validated

### A.1 The verdict the research gives
The pairing isn't two styles bolted together — **neubrutalism already contains the modern-minimal gene.** The trend literature defines it exactly that way: "a refreshing combination of the brutalist trend as well as the modern, minimalist trend" (Envato), "boldness plus modern UI structure… usually pro-UX in navigation clarity" (neubrutalism.com), NN/g's definition ("high contrast, blocky layouts, bold colors, thick borders… more colorful and orderly than pure brutalism") paired with its warning that the look must be balanced against usability. So the blend work is **completing the style's own genetics deliberately**: the ink language supplies stance and tactility; Swiss-modern discipline (space, ramp, grid, quiet data type, purposeful ≤200ms motion) supplies the order that makes it usable at product scale. The same source draws our dial for us: "minimalism optimizes for calm, efficiency… the better default for dense products," while neubrutalism works as "an expressive overlay" — which is precisely Hot (expressive learner world) vs Cool (calm ops instrument), one token system.

### A.2 The precedent that matters most
**Mozilla used neubrutalism specifically to talk to both adults and children** — muted, clashing, gradient-free color, thick black outlines, and modern, easy-to-read typography, explicitly set apart from clunkier brutalist type. That is this product's audience shape exactly, and it validates the two calibration rules already in this spec: modern readable type (Space Grotesk everywhere; Archivo Black rationed) and the muted-vs-saturated tension managed by the dial ("muted color palettes help balance expression and clarity" — the Cool dial's palette rule, now sourced).

### A.3 Second refinement from research: bento composition as the Cool-dial layout grammar
Bento grids are 2026's dominant modular layout (majority adoption across top SaaS; the Apple-popularized pattern now standard in data-heavy dashboards), and the research explains *why* it fits us: **tile size encodes priority** (a 2×2 block outranks a 1×1 without a bigger header — hierarchy by area, exactly doc 08's size-before-color law), **uniform gutters create the rhythm** (our `gap-group` token, literally), and NN/g's chunking research shows visually distinct sections lower cognitive load. Two rules come with it: bento is an **information-architecture decision, not a style layer** — priority tiers and tile sizing are decided before any frame is drawn; and bento is **wrong for sequential experiences** (long-form, step-by-step) — so it governs Ops/Educator/Parent dashboards and never the child's guided path (doc 09 §4), which stays a single spine on purpose. The ownable move: everyone's bento is soft-rounded and airy — **ours is ink-framed with slab shadows**, a bento that looks like a pegboard of school supplies. Ops Home, Parent Home, and Tutor Today become ink-bento compositions of the existing StatCard/ScheduleCard/InkTile anatomy.

### A.4 Platform coexistence note (iOS Liquid Glass)
Apple's current system design language renders native chrome (sheets, tab bars) in Liquid Glass. Policy: **system chrome may be glass; our canvas never is.** The ink language stops at the app surface boundary — no frosted/translucent materials inside our screens — and the treatment of the kit's native `@expo/ui` sheets (adopt system material vs. opaque ink surface) is assessed at build on-device and recorded as an ADR. This keeps the app native-feeling where the OS owns pixels and unmistakably ours where we do.

### A.5 Sleek, operationally (the do/never table)
| Sleek means | Never means |
|---|---|
| ≥40% canvas on Hot screens; spacing tiers enforced (doc 08) | gradients, glassmorphism, blur *inside the canvas* |
| one display moment per screen; disciplined ramp | soft/diffuse drop shadows (slabs only) |
| tabular-mono data everywhere numbers live | decorative 3D, clay, skeuomorph textures |
| motion ≤200ms, state-communicating (press physics, settle) | ambient/parallax motion on child surfaces |
| 1px-border Cool surfaces; ink-bento composition | rounding past `radius-sheet`; pill-ifying the language |

**Sources (adds to §register):** NN/g "Neobrutalism: Definition and Best Practices" (2026); neubrutalism.com definitive guide (2026); Envato Tuts+ neubrutalism guide incl. Mozilla case (2025); CC Creative brutalism-vs-neubrutalism (2026); bento research: SaaSFrame practical guide, Orbix dashboard guide (IA-first rule), MyDesigner/NN-chunking framing, senorit/landdding adoption data (2025–26).

---

## Addendum B · Brand identity: Moyo
**Name:** **Moyo** — Swahili for *heart*; the same word carries heart/life across Bantu languages, including Shona, where Moyo is one of the great family names and clan totems. Product lockup: **Moyo AI** (descriptive), spoken as just *Moyo*.
**Flagship tagline:** **"Learn it by heart."** — the idiom flipped back to literal: memory *and* love in one line. It is also literally true of the product: the Student Knowledge Graph (doc 07 §4) is how Moyo helps a child learn by heart, and S27 is the window into it.
**Tagline drawer:** "Until they can do it alone." (parent promise / next-item correctness) · "Help that teaches." (anti-answer-engine) · "It takes a village. Here's yours." (the platform's structural truth: parent, tutor, teacher, and Natalie around one child).
**Dictionary device** (tabular mono, every brand touchpoint): **moyo** · *n.* heart (Swahili · Shona)
**Motif:** the ink-stamped heart — drawn in the Adinkra-adjacent stamp language of this spec, celebration-stamp compatible.
**Brand-voice guardrail (doc 07 firewall, applied to brand):** the heart is the *child's*, the *family's*, and the *love of learning* — copy never claims the AI has a heart, feelings, or love for the child. Natalie "helps you learn it by heart"; she never "loves you." This line is testable in the red-team suite like any other.
**Register note:** Swahili/Bantu register — pairs naturally with the kanga-proverb heritage layer (e.g., "Elimu ni mwanga" / "Education is light," native-speaker verify) or a deliberately pan-African story; decision open, to be made consciously.
**Screening status (Aug 2026 — research only, NOT legal clearance):** *Domains (RDAP-verified):* moyo.ai registered since 2019 (Dynadot) and **listed for sale on Atom**; **getmoyo.ai, moyolearn.com and learnmoyo.com are unregistered**; heymoyo.com taken June 2026; moyoai.com held since 2017, expires Nov 28 2026 (backorder watch); moyo.app taken. *Marks:* no "MoyoLearn" mark found, **but MOYO is not clear in the education class** — a MOYO application exists in education/training services (Class 41, yoga classes, filed 2008; **status unverified — must be pulled from USPTO TSDR**), a MOYO fidget-toy mark (Class 28) went abandoned in 2020, and live education-adjacent users exist: MOYO Training (nature/tourism training, explicitly built on the same Swahili "heart" etymology) and Moyo Innovations Academy (tech education, Chennai). Other-class users: moyoAI (credit-scoring fintech), moyo (UX-research SaaS), MOYO retail. **Conclusion: Class 41 conflict analysis by trademark counsel is required before brand spend — this is the open risk on the name, not the domains.**
