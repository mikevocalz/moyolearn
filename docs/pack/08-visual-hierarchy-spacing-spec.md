# Visual Hierarchy, Spacing & Component System
**Doc 08 · Companion to the platform pack · Date:** Aug 19, 2026
**Skills applied:** frontend-design (hierarchy, signature, restraint), design-system (token + component doc discipline), accessibility-review, design-critique. **Grounded in the repo:** every number below either comes from `packages/theme/tokens.ts` / `packages/ui/Button.tsx` as they exist today, or is a proposed addition marked **[add]**. Roster + anti-slop gates apply.

---

## 1. Research this system stands on (§9 sources)

**Touch-target ladder (verified):** WCAG 2.2 SC 2.5.8 (Level AA, one of the six new 2.2 criteria) sets a **24×24 CSS px floor** with a spacing exception (a 24px circle centered on an undersized target may not intersect a neighbor's); **24 is a floor, not a recommendation** — Apple's HIG says 44×44pt, Material says 48×48dp (~9mm physical), and AAA asks 44 with no spacing escape.

**Children need bigger everything (NN/g, verified):** children must be designed for in three bands — **3–5 (pre-readers), 6–8 (beginner readers), 9–12** — because physical and cognitive ability differ sharply; NN/g recommends **at least 2cm × 2cm touch targets for young children — four times the ~1cm adult target** (~75px+), converging toward adult sizes with age; big-target taps and swipes are easy for all children while fine drags are hard for the youngest; **UIs that exceed a kid's motor ability make them lose confidence in the device**; kids need instant feedback (sound/animation/haptic) on nearly every action and do best with **one task at a time and a single clear goal**.

**Reading science (verified, with its real nuance):** the landmark PNAS study (Zorzi et al., 2012; 94 Italian/French dyslexic children) showed **extra-large letter spacing substantially improved reading immediately, without training**, attributed to dyslexics' abnormal sensitivity to *crowding*; later work complicates the picture — wider spacing helps slower readers (and reduced fixation durations broadly in one eye-tracking study) but **can impair fast readers' reading rates**, and replications on accuracy are mixed. Design consequence: **spacing relief is a per-learner setting, never a global default.**

**Line length:** the repo already encodes the classic 45–75-character finding — `contentWidths['content-prose'] = '65ch'`. Kept as law.

**The neubrutalism-specific problem this doc exists to solve:** in this design language, ink borders sit on *everything*, so borders cannot signal importance — a bordered card next to a bordered card is just two cards. **Hierarchy must come from size, weight, and space; borders are structure, not emphasis.** The systems below make that enforceable.

---

## 2. The spacing system

### 2.1 One scale, named tiers
The repo's spacing is the Tailwind 4px-base scale (Button: `px-4/5/6/8`, `py-2…4`, `gap-2`). Canonized: **no raw pixel values in feature code, ever** — a stylelint/ESLint rule bans arbitrary values (`p-[13px]` fails CI). On top of the raw scale, named tiers **[add]** so spacing choices are decisions, not habits:

| Tier | Value (Cool / Hot) | Used for |
|---|---|---|
| `inset-tight` | 12 / 16 | chips, table cells, dense list rows |
| `inset` | 16 / 20 | **default component padding** (cards, sheet content, inputs) |
| `inset-roomy` | 20 / 24 | hero cards, learner practice cards, empty states |
| `gap-element` | 8 / 12 | icon↔label, control clusters (Button's `gap-2` today) |
| `gap-stack` | 12 / 16 | items within one group (list rows, form fields) |
| `gap-group` | 24 / 32 | **between groups** — the hierarchy workhorse (see 2.3) |
| `gap-section` | 32 / 48 | between page sections; screen top/bottom rhythm |

### 2.2 Optical border compensation (the neubrutalist tax)
A 2px ink border visually eats into padding: a Hot card with `inset` 20 and `border-2` *reads* as 18. Rule: **padding tokens are border-inclusive by convention** — component specs state *visual* padding, and the implementation adds the border width (Hot card: `p-[22px]`? no — stay on scale: Hot cards use `inset-roomy` 24 with border-2 → visual 22, which is why the Hot inset column runs one step larger than Cool. The dial's spacing offset *is* the compensation). Corollary: never place two 2px-bordered elements flush — stacked borders read as a 4px error; minimum `gap-element` between bordered siblings.

### 2.3 Space is hierarchy (the grouping law)
Because everything has a border, **proximity is the only grouping signal left with any contrast** — so it's used with discipline:
1. Related items sit at `gap-stack`; unrelated groups at `gap-group` — a ≥2× jump, so the eye parses structure without reading.
2. **Never add a divider where a `gap-group` would do.** Dividers are for scannable dense tables (Cool) only.
3. Whitespace ratio rule per dial: Hot screens target ≥40% empty canvas (a child's screen should feel like an uncluttered desk); Cool screens may run dense but every data region keeps `inset` breathing room from its ink frame.
4. One-screen-one-job (NN/g): a Hot screen presents **one primary action**; anything past 4–5 choices becomes a new screen, not a longer list.

### 2.4 Touch-target tokens **[add]** (research → tokens)
| Token | Size | Applies to |
|---|---|---|
| `target-floor` | 24 | absolute CI minimum (WCAG 2.2 AA), spacing-exception logic encoded in the test |
| `target-adult` | 44 (48 preferred on Android) | all Cool-dial interactive elements |
| `target-teen` | 48 | Hot dial, grades 6–12 |
| `target-child` | 56 | Hot dial, grades 3–5 |
| `target-young` | 72 (~2cm, the NN/g 4× finding) | Hot dial, K–2 primary actions; the Tutor tab's 64pt already sits between child and young — raise to 72 on K–2 profiles |
Implementation: `hitSlop` tokens fill the gap when the visual element is smaller than its target; the age band comes from the learner profile (grade band — already a Safety Plane input), so **target size is a function of the signed-in child, not a hardcode.**

### 2.5 Density dial summary (extends doc 03 §2.6)
| Property | Hot (Learner/Family child-cards) | Cool (Ops/Educator) |
|---|---|---|
| Base inset | 20–24 | 12–16 |
| Row height (lists/tables) | 64+ | 44–52 |
| Interactive target | per age-band tokens | 44/48 |
| Type base | 17–18 | 14–15 |
| Empty-canvas target | ≥40% | data-first, framed |

---

## 3. Type hierarchy

### 3.1 The ramp (display exists; UI ramp is the gap)
`tokens.ts` today defines only the display ramp (`display-2xl` 4.5rem/1.05/−0.02em → `display-sm` 1.875rem/1.2) — Button falls back to Tailwind's `text-sm/base/lg`. **[add] the UI ramp**, one set of names, values per dial:

| Token | Cool | Hot | Notes |
|---|---|---|---|
| `title-lg` | 20/1.25, 600 | 24/1.25, 700 | screen titles (Space Grotesk) |
| `title` | 17/1.3, 600 | 20/1.3, 700 | card/section titles |
| `body-lg` | 16/1.5 | 18/1.55 | learner reading text |
| `body` | 15/1.45 | 17/1.5 | default UI text |
| `label` | 13/1.35, 500 | 15/1.4, 600 | buttons, form labels (sentence case) |
| `caption` | 12/1.35 | 13/1.4 | metadata; **never below 12, never for anything a user must act on** |
| `data` / `data-lg` | 13 / 16, **Spline Sans Mono, tabular figures** | 15 / 20 | every time, price, %, count — columns align, always |
| display-* | (existing ramp) | | **Archivo Black only**, one display moment per screen maximum |

### 3.2 The hierarchy recipe (the enforcement of §1's neubrutalism problem)
Tools in priority order: **(1) size step, (2) weight step, (3) `gap-group` isolation, (4) semantic color.** Ink borders and slab shadows are *structural* (what is a thing / what is pressable) and are never used to say "this one matters more." Highlighter fill is the single attention accent and appears **once per screen at most** (design spec's rule, now measurable). Every screen answers in one glance: *what is this screen (title-lg or one display moment), what matters most (largest object + most space around it), what do I do (one primary Button variant visible).*

### 3.3 Reading-comfort setting **[add]** (the Zorzi-informed feature)
A per-learner toggle (guardian- or learner-set, in `learnerFlags`): body text switches to `body-lg`, letter-spacing +0.06em, line-height 1.7, `gap-stack` +1 step. Framed as "comfy reading," never as a diagnosis (plan's no-labeling rule); default off because the same literature shows wider spacing can slow fast readers. Dynamic Type / font-scale compliance up to XL without layout breakage stays the global floor.

---

## 4. Component anatomy (design-system doc format; numbers are token names, not vibes)

### 4.1 Button (audit of the existing component + deltas)
What exists is strong: tv() slots; `border-2 border-border-strong`, `shadow-card`, press = `translate 3px + shadow-none` (the tile physics at button scale); **disabled drops the shadow because the shadow IS the pressable affordance** — the component's own comment explains a real usability failure it fixed; sizes step up at `md:` so the control grows with its text. **Deltas [add]:** `size="xl"` for Hot child bands (min-height from the age-band target token, `label` → Hot `label` 15–17); a CI assertion that every size × dial meets its target token; icon-only variant requires `aria-label` (type-enforced) and 44/48 min box.

### 4.2 ScheduleCard (the doc-02 content budget, now with numbers)
```
┌──────────────────────────────────────┐  border-2 ink · radius-card · shadow-card
│ inset (16/20)                        │
│ 9:00 AM–10:00 AM      [mode chip]    │  data (mono) · chip inset-tight
│ MAYA JOHNSON                         │  title · gap-element (8) below time row
│ Algebra II · Virtual                 │  body, graphite
│ ── gap-stack (12) ──                 │
│ [ Prep ]        [ Start ]            │  ≤1 primary + 1 secondary; targets per band
└──────────────────────────────────────┘
```
Budget enforced in the component API (doc 02 §1): 1 title, 1 time row (mono), ≤2 metadata rows, ≤1 inline action pair. Anything more is L2 content.

### 4.3 InkTile (calendar block)
Height = duration × zoom step; internal `inset-tight`; **text priority when short:** time (mono) survives last; at <32px height the tile shows color + border only and the lane header carries identity. Selected = highlighter underlay + border-strong; invalid drop = redpen hatch at 45°, 8px period. Press/lift physics per doc 02 §6.

### 4.4 EventPeek (sheet/popover L1)
Grabber (44pt slop) → title block (`title` + `data` time) → `gap-group` → two actions full-width stacked at Hot / inline at Cool → `gap-group` → "Open details" text button. Content region `inset`; sheet radius = `radius-sheet`; **nothing scrolls at L1** (the budget rule made spatial).

### 4.5 InspectorSection
Header row: `title` at left, chevron right, row height 44 (whole row is the target); content `inset` with `gap-stack`; sections separated by `gap-group`, **no divider lines** — the collapse affordance + space do the work.

### 4.6 DataTable row (Cool only)
Row 44–52; cell `inset-tight`; numeric columns right-aligned in `data` mono (tabular figures = columns that actually align); header `label` weight 600, graphite; selected row = highlighter underlay at 24% + border-left 3px ink (the one place a border edge signals state, because position distinguishes it from the frame).

### 4.7 StatCard
`data-lg`/display-sm number + `caption` label below (never above — the number is the point), `inset`, one optional trend chip; **no icon unless it disambiguates** (icons as decoration are the SaaS tell).

### 4.8 MasteryBar / MasteryRing
Track: ink @ 12%; fill: grade-green; struggling ≠ red — `needs-attention` renders highlighter, because in a school-supplies language **red pen means "marked wrong," and a child's overall progress is never "wrong"** (dignity rule from doc 07 ¶2, now a color spec). Value label in `data` mono adjacent, never inside the bar below 24px height.

### 4.9 TabBar / Rail
Tabs: 49–56pt bar, targets full-height, `label` 11–12 under icons (Cool) / 13 (Hot); the Tutor center action 64pt (72 on K–2). Rail at ≥600dp: 48pt items, `gap-stack`, active = highlighter pip + label weight step (not a fill — fills are for the child's world).

## 5. Hierarchy playbook per archetype
- **Feed (D):** one `title-lg`, cards at `gap-stack`, groups at `gap-group`; the Action-Needed group always first and the only group allowed a highlighter header chip.
- **Duet (B):** Content pane owns the display moment; Detail pane starts at `title` — the inspector is never louder than the thing it inspects.
- **Triptych (A):** Cool density everywhere; the *selection* is the hierarchy (highlighter underlay + inspector population); page titles are quiet (`title-lg`), the grid is the hero.
- **Focus (C, child):** one goal, one primary action, `inset-roomy`, ≥40% canvas, feedback (haptic + ink-stamp) on every completed action — the NN/g findings as layout law.

## 6. Imagery policy + mood board (his rule: real Pexels photos, or AI-generated when needed)

**Where photography is allowed:** tutor/teacher profile photos, business marketing pages, parent-facing onboarding/empty states (sparingly), press/site. **Where it is banned: child learning surfaces** — decorative stock competes with the one-task rule and the tutor-presence signature; illustration there is ink-line + flat token fills only.
**Treatment spec:** every in-product photo sits in an ink frame — `border-2 border-strong`, `radius-card`, `shadow-card` — and may use a paper/ink duotone so photography never breaks the palette. Alt text mandatory; faces of minors never in marketing without the doc-05/06 consent machinery.
**Sourcing:** Pexels (license: free to use without attribution per Pexels; verify per image at download). Seed mood board, verified URLs:
- Graphing paper close-up — https://www.pexels.com/photo/graphing-paper-pexels-577180/
- School-supply pens/markers/highlighters in case (Tim Gouw) — https://www.pexels.com/photo/school-supplies-office-pens-53874/
- Curated hunting grounds: pexels.com/search/graph%20paper/ · /search/school%20supplies/ · /search/highlighter/
**Recipe for the board (10–12 images):** graph-paper macro (paper token), highlighter stroke on lined paper (attention accent), ballpoint ink writing macro (ink/ballpoint), red pen marking (status semantics), pencil shavings/graphite (neutrals), gold-star sticker sheet (celebration motif) — each image annotated with the token it justifies. AI-generated fills are acceptable **only** for compositions Pexels lacks (e.g., the exact palette flat-lay) and are labeled as such in the board.

## 7. Verification additions (extends docs 02/03 gates)
1. **Spacing lint:** arbitrary values banned; only scale classes/tier tokens pass.
2. **Target-size CI:** every interactive Storybook story measured against its dial × age-band token; 24px WCAG floor with the spacing-exception algorithm as the last-resort pass.
3. **Type-ramp page:** both dials rendered side-by-side; contrast test already covers every pair (doc 03).
4. **Hierarchy audit in design-critique:** per screen PR — one display moment max, one highlighter accent max, primary action identifiable in a 5-second squint test screenshot.
5. **Reading-comfort snapshot:** every learner text surface rendered with the toggle on, layout must not break.

## 8. New PRs
- **PR-20 · Token completion:** UI type ramp, spacing tiers, target tokens (age-band aware), reading-comfort variants — all in `tokens.ts` → `build-css.mjs`, Storybook ramp/density pages.
- **PR-21 · Anatomy retrofit:** Button xl + target assertions, ScheduleCard/EventPeek/InspectorSection/DataTable/StatCard/MasteryBar to spec, hierarchy-audit checklist wired into the PR template, mood board committed to `docs/design/`.

## 9. Source register
- WCAG 2.2 SC 2.5.8 Target Size (Minimum): 24×24 CSS px AA floor, spacing exception mechanics, 2.5.5 AAA 44px, "floor not recommendation," Apple 44pt / Material 48dp ladder: wcag22aa.org, TestParty, TetraLogical, W3C issue record (2022–26).
- Children's UX: NN/g UX Design for Children (4th ed., ages 3–12; 156 guidelines) — age bands 3–5/6–8/9–12, **2cm×2cm targets for young children (4× adult)**, motor-ability/confidence finding, instant-feedback and one-task guidance: nngroup.com articles/reports; Fruto summary (~75px for young kids).
- Reading science: Zorzi et al., *Extra-large letter spacing improves reading in dyslexia*, PNAS 2012 (crowding mechanism, immediate improvement, no benefit for typical readers); Frontiers in Psychology 2020 eye-tracking (wider spacing helps slower readers, impairs fast readers); Łuniewska et al. 2021 (mixed accuracy replication) — pnas.org, frontiersin.org, PMC.
- Repo ground truth: `packages/theme/tokens.ts` (display ramp, contentWidths incl. 65ch prose, radius, slab shadows), `packages/ui/Button.tsx` (anatomy, press physics, disabled-shadow rationale).
- Pexels: photo 577180 (graphing paper), photo 53874 (school supplies, Tim Gouw), search collections — pexels.com (license per Pexels terms; verify per image).
