# Design reset — binding constraints digest

What it is: every rule the design reset must obey, extracted from the binding inputs with a `path:line` citation per rule, so a designer or engineer can work from one file instead of forty.
Why it exists: the reset touches nav, accent, tokens, learner surfaces, evidence copy, entitlement UI and Natalie at once — the constraints on all six live in different documents, and a rule that has to be rediscovered is a rule that gets broken.
Source of truth: the cited file at the cited line. This digest never overrides its source; where this file and its source disagree, the source wins (same rule `docs/design/overhaul-v2/00-binding-decisions.md:4` states for itself).
Verified 2026-09-05 against branch `design/reset-v2`.
SOT-KEYWORDS: reset, binding-constraints, nav-law, role-accent, token-law, learner-ban, evidence, entitlement, natalie, open-questions, conflicts

## Precedence

Stated by the task and consistent with the docs' own claims:

1. `docs/pack/*`
2. `docs/38-front-door-and-flow.md`
3. `docs/design/overhaul-v2/00-binding-decisions.md`
4. `design/screens/**/contract.md`

Two corollaries the documents assert themselves:

- The digest at rank 3 defers to rank 1 and 2 explicitly — "where this digest and the pack disagree, the pack wins" (`docs/design/overhaul-v2/00-binding-decisions.md:4`).
- ADRs in `docs/decisions/` are not in the four-rank list but supersede rank 1 where they say so and name the doc they contradict. `docs/decisions/adr-107-learner-pane-ban-reaffirmed.md:76` and `:162` do exactly that. Treat a signed ADR that names its contradicted doc as senior to that doc's sentence, and nothing more.
- The repo's own always-on rules sit under `CLAUDE.md` §UI and §Children's surfaces (`CLAUDE.md:31-40`) and restate a subset of the below. They are enforced, not advisory.

---

## 1 · NAV LAW

Source: `docs/pack/36-role-navigation-flows.md`.

### 1.1 Tab set per role and band — exact, no substitutions

| Shell | Band | Destinations, in order | Citation |
|---|---|---|---|
| Learner | K–2 | 3: `Today` · **`📷 Snap` (raised center)** · `My Stuff` | `docs/pack/36-role-navigation-flows.md:40` |
| Learner | 3–5 | 4: `Today` · `Subjects` · **`📷 Snap` (center)** · `Me` | `docs/pack/36-role-navigation-flows.md:41` |
| Learner | 6–8 / 9–12 | 5: `Home` · `Subjects` · **`📷 Snap` (center)** · `Progress` · `You` | `docs/pack/36-role-navigation-flows.md:42` |
| Guardian | n/a | 4: `Home` · `Reports` · `Alerts` · `Family` | `docs/pack/36-role-navigation-flows.md:46`; reaffirmed `docs/decisions/adr-101-guardian-tab-set.md` |
| Tutor | n/a | mobile 4: `Today` · `Learners` · `Notes` · `You` | `docs/pack/36-role-navigation-flows.md:50` |
| Tutor | n/a | web sidebar grouped: `Today · My learners · Session notes` then `Incidents · Resources` | `docs/pack/36-role-navigation-flows.md:51`; grouping fixed by `docs/decisions/adr-105-tutor-web-schedule-item.md` |
| Org | n/a | web sidebar: `Overview` · `CRM` · `Scheduling` · `Money` · `Safety` · `Settings` | `docs/pack/36-role-navigation-flows.md:54` |
| Org | n/a | mobile companion 4: `Overview` · `Schedule` · `Inbox` · `Safety` | `docs/pack/36-role-navigation-flows.md:55` |
| Teacher | n/a | mobile 4, Cool: `Home` · `Classes` · `Assign` · `You` | `docs/decisions/adr-102-teacher-shell-ia.md` (doc 36 defines no teacher tab set) |
| School admin | n/a | mobile parks at `Overview` only; if it ever ships: `Overview · People · Academics · Inbox`, never `More` | `docs/decisions/adr-103-school-admin-ia.md` |
| District | n/a | web only: `Outcomes` · `Schools` · `Educators` · `Compliance` · `Settings`; **no mobile tab bar** | `docs/pack/36-role-navigation-flows.md:58`; `docs/decisions/adr-104-district-mobile-retirement.md` |
| Platform admin | n/a | themed Payload CMS + canary dashboards; not a consumer shell | `docs/pack/36-role-navigation-flows.md:61` |

Learner web is the same IA rendered as a Hot top-nav — no sidebar (`docs/pack/36-role-navigation-flows.md:43`). K–2 additionally has no search and no settings; settings are guardian-side only (`docs/pack/36-role-navigation-flows.md:40`).

The camera is the learner primary action at every band and lives in the raised center slot on every band (`docs/pack/36-role-navigation-flows.md:43`).

### 1.2 Cross-role laws

1. ≤5 top-level destinations per shell, labels always visible (`docs/pack/36-role-navigation-flows.md:64`). Overflowing into a "More" tab is IA failure, not a solution (`docs/pack/36-role-navigation-flows.md:11`).
2. Every role lands on the thing they came to do, ≤1 tap from launch: learner→camera, guardian→newest report, tutor→next session, org→today's exceptions, district→outcomes (`docs/pack/36-role-navigation-flows.md:65`).
3. The role switcher lives in Profile/You; switching is a full shell swap, never a blended shell (`docs/pack/36-role-navigation-flows.md:66`).
4. Notification deep links resolve inside the correct shell or die silently — never a "you don't have permission" toast to a child (`docs/pack/36-role-navigation-flows.md:67`).
5. Android predictive back + iOS swipe-back everywhere; tab roots never trap back (`docs/pack/36-role-navigation-flows.md:68`).
6. Empty states carry verbs; K–2 offline speaks (`docs/pack/36-role-navigation-flows.md:69`).
7. Separate navigator/layout tree per role, never conditional rendering inside one tree — a learner bundle should not contain org screens (`docs/pack/36-role-navigation-flows.md:21-23`).
8. n roles → last-used shell, never a picker wall at login (`docs/pack/36-role-navigation-flows.md:20`).
9. The account sheet is the mobile chrome form of Profile/You and is never a sixth destination; nothing in it duplicates a tab (`docs/decisions/adr-106-account-sheet-is-profile-you.md`).

### 1.3 What triggers an ADR

The register is `docs/design/overhaul-v2/G-navigation-maps.md:196-206`. Its legend defines the trigger: "⚠ ADR-NEEDED (divergence from or silence in doc 36 — decide before Phase-2 wiring)" (`docs/design/overhaul-v2/G-navigation-maps.md:10`), and the file's standing rule is "every divergence from doc 36 is flagged ADR-NEEDED, never silently adopted" (`docs/design/overhaul-v2/G-navigation-maps.md:4`).

Concretely, an ADR is required to:

- Add, remove or rename a top-level destination in any shell relative to §1.1 above (`docs/design/overhaul-v2/G-navigation-maps.md:200-205`).
- Ship a shell or IA for a role doc 36 is silent on — teacher (`:201`), school admin (`:202`).
- Ship a surface doc 36 rules out — district mobile (`:203`).
- Mount panes on any learner surface (`:206`, and the ratchet at `docs/design/overhaul-v2/00-binding-decisions.md:22`).
- Introduce a component the reset brief names that no screen contract references — `docs/design/overhaul-v2/J-component-plan.md:10` makes contract demand the build trigger and `:212-224` lists what that rule already refused.

Each register row carries a "Default if no ADR" column: silence resolves to doc 36, never to the divergence (`docs/design/overhaul-v2/G-navigation-maps.md:198-206`). ADR-101 through ADR-107 are the seven that have been written and accepted.

---

## 2 · ROLE-ACCENT LAW

Source: `docs/pack/36-role-navigation-flows.md:71-85`; enforcement `tooling/check-role-accent.mjs`.

### 2.1 The rule

One neubrutalist system — paper, ink borders, slab shadows, type ramp, spacing all invariant — plus exactly one themed token, `--role-accent`, and its 24% underlay (`docs/pack/36-role-navigation-flows.md:72`).

**One accent moment per screen.** The doc 08 budget applies to the role accent identically (`docs/pack/36-role-navigation-flows.md:85`). Doc 08's own phrasing: one display moment and one highlighter accent per screen (`docs/pack/08-visual-hierarchy-spacing-spec.md:84`), restated as a repo-wide rule at `CLAUDE.md:35`.

### 2.2 Allowlisted slots — the complete list

Active tab/nav indicator underlay · avatar ring · login/onboarding hero band · shell header underline · email header band (`docs/pack/36-role-navigation-flows.md:85`).

### 2.3 Where it may never appear

Semantic states, body text, borders, or the primary button. The primary button stays ink-filled in every shell — "the press physics are the brand, not the hue" (`docs/pack/36-role-navigation-flows.md:85`). Within the learner shell the highlighter keeps its doc 08 dual duty (accent + needs-attention); every other shell's accent carries no semantic load, ever (`docs/pack/36-role-navigation-flows.md:85`).

### 2.4 What `tooling/check-role-accent.mjs` actually enforces

Read the script, not the doc, before assuming a class will pass.

- **Detection pattern** — `ROLE_CLASS = /\b([a-z][a-z-]*?)-role-(?:accent|learner|guardian|tutor|org|district)(?:-underlay)?\b/g` (`tooling/check-role-accent.mjs:65`). It matches any utility whose color segment is a role token, capturing the property prefix.
- **Ban list, enforced in every file, no allowlist can waive it** — `BANNED_PREFIX = /^(?:text|border|divide|outline|decoration|caret|placeholder)(?:-[a-z]+)*$/` (`tooling/check-role-accent.mjs:62`). The comment explains the widening: "`divide`/`outline`/`decoration`/`caret` are borders and text by other names" (`:54`).
- **Allowlist, file-scoped** — every other prefix (`bg-`, `ring-`, `fill-`, …) is legal only in the files in `ALLOWLIST` (`tooling/check-role-accent.mjs:41-55`), each entry naming the §5 slot it implements:
  - `packages/ui/RoleScope.stories.tsx` — kit review surface
  - `apps/mobile/components/ShellTabBar.tsx` — active tab/nav indicator underlay
  - `apps/mobile/components/ShellHeader.tsx` — shell header underline
  - `packages/ui/RoleChoiceCard.tsx` — login/onboarding role-choice selection (FD-03)
  - `packages/app/features/profile/account-sheet-content.tsx` — avatar ring (ADR-106)
  - `packages/ui/AvatarSheet.stories.tsx` — avatar ring, kit review surface
  - `packages/ui/PlanCard.tsx` — plan chooser selection (FD-13)
- **Scope** — walks `packages/` and `apps/`, all `.ts`/`.tsx`, skipping `node_modules|.next|.turbo|dist|build` (`tooling/check-role-accent.mjs:34`, `:84-87`). `packages/theme/` is exempt because it is the mint, not className usage (`tooling/check-role-accent.mjs:88-89`). Lines beginning `//`, `*` or `/*` are skipped (`tooling/check-role-accent.mjs:93`).
- **Deliberate exemption** — bare `role-<name>` scope classes are not matched; the scope paints nothing, it re-points the generic pair for a subtree (`tooling/check-role-accent.mjs:16-17`).
- **Adding a slot is a design decision, not a lint fix.** A new consumer lands in `ALLOWLIST` with the slot named, or it fails by default (`tooling/check-role-accent.mjs:37-40`, error text at `:103-106`).

Two regressions were used to prove the gate red before it landed: a `text-`-prefixed role class in `Heading.tsx` and a `bg-` one in `Button.tsx` (`tooling/check-role-accent.mjs:19-20` (header)).

### 2.5 The OKLCH mint, and what shipped

Doc 36 specified fixed lightness/chroma with rotated hue so ink-on-accent passes identically for every role (`docs/pack/36-role-navigation-flows.md:74`) and gave working values at L≈0.88, C 0.10–0.13 (`docs/pack/36-role-navigation-flows.md:76-83`). Implementation raised lightness per hue because WCAG luminance is not OKLab L — three hues measured below the learner parity bar at L 0.88 (`packages/theme/tokens.ts:311-317`). The shipped values are in §3.6 below. `tooling/check-contrast.mjs` gates the parity at 14:1 (`packages/theme/tokens.ts:316-317`).

---

## 3 · TOKEN LAW

Source of values: `packages/theme/tokens.ts`. Documented at `docs/design/overhaul-v2/I-token-system.md`, which "documents, never defines" (`docs/design/overhaul-v2/I-token-system.md:3`). Use these identifiers verbatim; no raw values downstream (`CLAUDE.md:32`).

### 3.1 Control radius — one, tool-enforced

```
radius.control = '0.375rem'      packages/theme/tokens.ts:738
```

Every interactive control shares it. The rationale in the file: a button at `md` (6px) beside an input at `card` (10px) "reads as two components from two systems sitting in the same row" (`packages/theme/tokens.ts:734-736`). Enforced by `tooling/check-controls.mjs` (`packages/theme/tokens.ts:737`).

Full scale, non-control uses: `radius.xs` 0.125rem · `sm` 0.25rem · `md` 0.375rem · `lg` 0.5rem · `card` 0.625rem · `sheet` 0.875rem · `full` 9999px (`packages/theme/tokens.ts:739-745`).

### 3.2 Shadow spec — hard offset slabs, zero blur

```
shadows.card    = '4px 4px 0 0 var(--color-border-strong)'   packages/theme/tokens.ts:750
shadows.raised  = '6px 6px 0 0 var(--color-border-strong)'   packages/theme/tokens.ts:751
shadows.overlay = '9px 9px 0 0 var(--color-border-strong)'   packages/theme/tokens.ts:752
```

"RETRO elevation: hard offset slabs in the border color — no blur, ever" (`packages/theme/tokens.ts:748`). Per-dial shadows differ (§3.5). The shadow is the pressable affordance — `Button` drops it when disabled, and doc 08 records that as a real usability failure it fixed (`docs/pack/08-visual-hierarchy-spacing-spec.md:94`).

### 3.3 Typefaces

```
fontFamilies.display = "'Archivo Black', 'Arial Black', sans-serif"                      packages/theme/tokens.ts:624
fontFamilies.sans    = "'Space Grotesk', system-ui, -apple-system, sans-serif"           packages/theme/tokens.ts:625
fontFamilies.mono    = "'Chivo Mono', ui-monospace, SFMono-Regular, Menlo, monospace"    packages/theme/tokens.ts:633
```

Native resolves by file basename, not CSS family — React Native has no font-family fallback list and an unmatched name silently drops to the system face (`packages/theme/tokens.ts:638-643`):

```
nativeFontFamilies.display = "'ArchivoBlack-Regular'"     packages/theme/tokens.ts:652
nativeFontFamilies.sans    = "'SpaceGrotesk-Variable'"    packages/theme/tokens.ts:653
nativeFontFamilies.mono    = "'ChivoMono-Variable'"       packages/theme/tokens.ts:654
```

Display face is Archivo Black only, one display moment per screen maximum (`docs/pack/08-visual-hierarchy-spacing-spec.md:81`). Mono is every time, price, %, and count so columns align (`docs/pack/08-visual-hierarchy-spacing-spec.md:80`; `packages/theme/tokens.ts:788`).

UI ramp identifiers, `[size, lineHeight, weight]` per dial (`packages/theme/tokens.ts:794-803`): `title-lg` · `title` · `body-lg` · `body` · `label` · `caption` · `data` · `data-lg`. `caption` is the floor — never below 12, never for anything a user must act on (`packages/theme/tokens.ts:792`). Display scale `display-2xl … display-sm` is reserved for hero moments (`packages/theme/tokens.ts:657-664`).

### 3.4 Band touch targets

```
targets.floor = '24px'   WCAG 2.2 SC 2.5.8 AA floor — CI minimum, never a design target
targets.adult = '44px'   Apple HIG 44pt
targets.teen  = '48px'   Hot, grades 6–12
targets.child = '56px'   Hot, grades 3–5
targets.young = '72px'   ~2cm, NN/g 4× finding — Hot, K–2 primary actions
                                                        packages/theme/tokens.ts:864-870
```

PX not rem, deliberately: the mobile bundler sets `polyfills.rem = 14`, which shipped the adult band at 38.5 and the K–2 band at 63 while CI asserted the design intent at rem-16 (`packages/theme/tokens.ts:849-862`). Consumed as `min-h-target-*` (`docs/design/overhaul-v2/I-token-system.md:54`). Target size is a function of the signed-in child, not a hardcode (`docs/pack/08-visual-hierarchy-spacing-spec.md:54`; `CLAUDE.md:34`).

Nav chrome geometry, also px (`packages/theme/tokens.ts:909-942`): `navChrome.rail` 80px · `navChrome.raised` 64px (the learner Snap slab) · `navChrome.raise` 58px (how far it breaks above the bar) · `navChrome.indicator` 40px, square in both bar and rail. There is deliberately no separate indicator height token — shipping one undercut the K–2 band to 54.7dp on device (`packages/theme/tokens.ts:898-907`).

### 3.5 Hot / Cool dial semantics

Hot = learner and family surfaces. Cool = ops, educator, institution (`packages/theme/tokens.ts:959-960`).

```
dial.hot.radius       = '0.875rem'  // 14px — chunky-friendly
dial.hot.shadow       = '4px 4px 0 0 var(--color-border-strong)'
dial.hot['row-height'] = '4rem'     // 64+
dial.hot.duration     = '200ms'
dial.cool.radius       = '0.5rem'   // 8px
dial.cool.shadow       = '2px 2px 0 0 var(--color-border-faint)'
dial.cool['row-height'] = '2.75rem' // 44 — the adult target floor
dial.cool.duration     = '140ms'
                                                        packages/theme/tokens.ts:973-985
```

The dial is not a theme. It travels as a component prop, because a single guardian screen is "cool structure, hot accents on child-related cards" and both temperatures render in one tree; React Native has no cascade to inherit from (`packages/theme/tokens.ts:961-967`). Color is deliberately absent from the dial — it governs which fills get used, not what the values are, so both temperatures share one palette and one contrast pass (`packages/theme/tokens.ts:969-971`).

Density, from doc 08 (`docs/pack/08-visual-hierarchy-spacing-spec.md:56-63`): Hot base inset 20–24, rows 64+, type base 17–18, **empty-canvas target ≥40%**; Cool inset 12–16, rows 44–52, type base 14–15, data-first.

Spacing tiers are `{cool, hot}` pairs (`packages/theme/tokens.ts:812-839`): `inset-field` · `inset-tight` · `inset` · `inset-roomy` · `element` · `stack` · `group` · `section` · `brand-clear`. Token names carry no `gap-` prefix on purpose — Tailwind composes `gap-stack` from `--spacing-stack`, and a prefixed token silently no-ops every usage (`packages/theme/tokens.ts:821-826`). `group` is the hierarchy workhorse; related items sit at `stack`, unrelated groups at `group`, a ≥2× jump (`docs/pack/08-visual-hierarchy-spacing-spec.md:41`). Never add a divider where a `gap-group` would do (`docs/pack/08-visual-hierarchy-spacing-spec.md:42`).

Width systems are two, deliberately separate, do not merge (`docs/design/overhaul-v2/I-token-system.md:60-63`): `widthClassMinDp` compact 0 / medium 600 / expanded 840 / large 1200 (`packages/theme/tokens.ts:724-729`) drives pane policy; a binary compact|regular split at 768 in `size-class.constants.ts` drives one-vs-two-column decisions.

Reading comfort, per-learner, default off: `readingComfort['letter-spacing']` 0.06em, `readingComfort['line-height']` 1.7 (`packages/theme/tokens.ts:951-954`). Framed as "comfy reading", never as a diagnosis (`docs/pack/08-visual-hierarchy-spacing-spec.md:87`).

Motion: `motion.duration.fast` 120ms · `base` 200ms · `slow` 300ms · `slower` 500ms; `motion.easing.standard|emphasized|exit` (`packages/theme/tokens.ts:767-779`).

### 3.6 The OKLCH accent roles — shipped identifiers and values

`accentRoles` is the single list driving the `.role-*` scopes, `RoleScope`, and the contrast pairs, so an eighth role cannot be added in one place and missed in another (`packages/theme/tokens.ts:531-537`):

```ts
export const accentRoles = ['learner','guardian','tutor','teacher','org','school','district'] as const
                                                        packages/theme/tokens.ts:537
```

| Token | Value | OKLCH origin | Line |
|---|---|---|---|
| `role-accent` / `role-accent-underlay` / `on-role-accent` | generic pair, re-pointed per `.role-*` scope | — | `packages/theme/tokens.ts:327-329` |
| `role-learner` | `palette.burgundy[400]` = `#FFDB33` | brand hue 95°; 14.36:1 under ink — **this ratio is the parity bar** | `packages/theme/tokens.ts:330-333` |
| `role-guardian` | `#95EBFF` | `oklch(0.90 0.10 230)` sky | `packages/theme/tokens.ts:334-336` |
| `role-tutor` | `#EDD4FF` | `oklch(0.915 0.10 300)` violet | `packages/theme/tokens.ts:337-339` |
| `role-org` | `#FFD7A5` | `oklch(0.95 0.12 50)` tangerine | `packages/theme/tokens.ts:340-343` |
| `role-teacher` | `#FFD5C4` | `oklch(0.955 0.11 30)` coral | `packages/theme/tokens.ts:344-350` |
| `role-school` | `#BFF5C8` | `oklch(0.92 0.10 150)` mint | `packages/theme/tokens.ts:351-354` |
| `role-district` | `#83EFF5` | `oklch(0.89 0.10 200)` teal | `packages/theme/tokens.ts:355-357` |
| admin | none — graphite ramp, no accent token minted | deliberate | `packages/theme/tokens.ts:321-323` |

Every role also mints `role-<x>-underlay` as pre-resolved `rgba(..., 0.24)` because React Native cannot evaluate `color-mix()` (`packages/theme/tokens.ts:325-326`). Accent values are identical in light and dark — the accent is the door's identity and must not shift under the theme (`packages/theme/tokens.ts:323-325`).

Separate from the accent, each role claims one brand pastel for its shell chrome via `roleTheme` → `chromeTint` (`packages/theme/tokens.ts:557-617`): learner and district lavender, guardian guava, tutor mango, teacher/org/school mint. The chrome cannot go dark because the wordmark's purple M falls under 1.5:1 on any dark bar, and recoloring the mark is not on the table — "If the mark does not read on a bar, the BAR is wrong" (`packages/theme/tokens.ts:361-375`).

### 3.7 Semantic marks that outrank hue

`highlighter` / `highlighter-underlay` (attention, and needs-attention in the learner shell), `ballpoint`, `redpen`, `grade` (`packages/theme/tokens.ts:296-302`). Borders are ink — `border` / `border-strong` / `border-soft` / `border-faint` — and are structure, never emphasis (`docs/design/overhaul-v2/I-token-system.md:22`; `CLAUDE.md:35`). Hierarchy comes from size step → weight step → `gap-group` isolation → semantic color, in that order (`docs/pack/08-visual-hierarchy-spacing-spec.md:84`).

`MasteryBar` law: track ink @ 12%, fill grade-green, and struggling renders highlighter, not red, "because in a school-supplies language red pen means 'marked wrong,' and a child's overall progress is never 'wrong'" (`docs/pack/08-visual-hierarchy-spacing-spec.md:125`).

Primitive scale names are documented lies kept for class-name stability — `burgundy` is electric yellow, `gold` is blue, `ember` is hot pink, `ink` runs paper-cream→black. Feature code uses semantic aliases only (`docs/design/overhaul-v2/I-token-system.md:16`).

---

## 4 · LEARNER CONSTRAINTS

### 4.1 The pane ban (ADR-107)

Doc 37 states it: panes are for tutor (`Learners|detail`, `Notes|draft`), guardian tablet (`Reports|report`); ops is a web sidebar; district is a web grid; **"Learner: never"** — "a split learner UI is attention arbitrage" (`docs/pack/37-onboarding-dual-pane.md:40`). The ratchet: lifting the ban even for 9–12 requires an ADR (`docs/design/overhaul-v2/00-binding-decisions.md:22`).

The ADR reaffirms it: "no learner surface renders `AdaptivePanes`, `unstable-split-view`, or any two-pane composition, at any width class, on any platform" (`docs/decisions/adr-107-learner-pane-ban-reaffirmed.md:38`). Learner screens use width for a single generous column, generalizing doc 38 §4's 560dp-centered pattern (same line). Any future lift must supersede that file explicitly and may not even be evaluated until the band-population defect is fixed, because "a band-gated exception on a never-populated band is a ban that fails open" (`docs/decisions/adr-107-learner-pane-ban-reaffirmed.md:38`).

**One exemption exists, and only one.** The S9 tutor session (`TutorStage`) at `expanded` (840dp) and above renders three panes, left to right: conversation · work · presence (`docs/decisions/adr-107-learner-pane-ban-reaffirmed.md:96-98`). Its five binding conditions (`docs/decisions/adr-107-learner-pane-ban-reaffirmed.md:106-143`):

1. **One work surface, and the middle pane is not a second one.** The middle pane holds `TutorWorkCanvas` — a *display* of the problem and its photo. Nothing is authored, chosen, navigated or submitted there; no controls, no second reading order. If anything a child has to *do* is added to it, the exemption stops covering the screen (`:106-115`).
2. **Collapsible, and collapsed is first-class.** Two labelled `PaneToggle`s in `SessionToolbar` — "Homework" and "Natalie". The conversation has no toggle; `resolvePaneVisibility` refuses to hide the last pane standing (`:126-132`).
3. **Compact is unchanged.** Below 600dp the session is a single spine; below 840dp there is no middle pane and the work rides inside the turn (`:133-138`).
4. **Hot dial still applies** — ≥40% canvas measured with the panes open (`:139-141`).
5. **It does not generalise.** No other learner route may mount `AdaptivePanes` by citing the amendment (`:142-143`).

Everything else — Today, My Stuff, the guided path, capture, onboarding — stays single-pane at every width class on every platform (`docs/decisions/adr-107-learner-pane-ban-reaffirmed.md:59`).

Front-door corollary: learner FD screens are single-pane at every width; on expanded the content column is max-width 560dp, centered, larger type (`docs/38-front-door-and-flow.md:233`).

### 4.2 Protected routes and guards

Three guard states drive the whole front door; `Stack.Protected` redirects to the anchor route when a guard is false, purges history on a true→false flip, and is enforced on deep links (`docs/38-front-door-and-flow.md:121`).

- `(public)/` — guard `session.status === 'anon'`. Holds FD-01 Welcome, FD-02 login, FD-03/04/05 signup, FD-06/07 reset, **FD-08 learner code entry**, FD-09 invite (`docs/38-front-door-and-flow.md:126-136`, guard sketch `:164`).
- `(onboarding)/` — guard `authed && !onboarding.complete`; resumes from `onboarding.step` (`docs/38-front-door-and-flow.md:137-138`, `:165`). Learner branch is `learner/avatar.tsx` (FD-16) and `learner/hello.tsx` (FD-17) (`:145-146`).
- Role shells `(learner)/ (guardian)/ (tutor)/ (org)/ (teacher)/ (district)/` — one `Stack.Protected` block per role, guarded on `authed && onboarding.complete && activeRole === <role>`; separate trees per doc 36 (`docs/38-front-door-and-flow.md:153`, `:166-167`).
- `account/` — `switch.tsx` (FD-24), `signed-out.tsx` (FD-25), `delete.tsx` (FD-26); inside every authed guard (`docs/38-front-door-and-flow.md:154-157`, `:167`).
- Session contract additions shipped with the live provider, not deferred: `onboarding: { complete: boolean; step: OnboardingStep | null }` and `status: 'loading' | 'authed' | 'anon' | 'expired'` (`docs/38-front-door-and-flow.md:170`).
- Deep links captured while `anon` are stored and replayed after auth; role-mismatched links drop silently (`docs/38-front-door-and-flow.md:170`).

A child never types an email or password — the learner path is code redemption only (`docs/pack/36-role-navigation-flows.md:29`; `docs/38-front-door-and-flow.md:54-59`). The learner is a sub-profile, never an account (`docs/38-front-door-and-flow.md:54`).

`learner.home`'s contract states the same shape from the screen side: back at the shell root exits the app and never leaves the learner shell; "Single-pane at every width (learner pane ban, doc 37 §3.3)" (`design/screens/learner/learner.home/contract.md:31`); first-run state is Natalie's greeting plus exactly one action, "Snap your homework" (`design/screens/learner/learner.home/contract.md:34`); camera permission is asked at first Snap, notifications after the first report (`design/screens/learner/learner.home/contract.md:35`).

### 4.3 Doc 33 non-goals that bind design (v1, explicit)

All nine are at `docs/pack/33-moyo-learn-prd.md:158-167`. The ones the reset can violate by accident:

- **No engagement mechanics** — "streaks-as-pressure, variable rewards, FOMO notifications" (`docs/pack/33-moyo-learn-prd.md:165`). Reinforced by the metric law: no engagement-farming metrics anywhere, no DAU maximization, no session-length-up goals, no streak retention; "Time-in-app going *down* while mastery goes up is success" (`docs/pack/33-moyo-learn-prd.md:183`). Repo rule: no shame copy, no guilt notifications, no late-night pushes (`CLAUDE.md:39`).
- **No answer mode. Not a toggle, not a premium tier. Ever.** (`docs/pack/33-moyo-learn-prd.md:162`).
- **No prices on learner surfaces** — PW-03b carries "no prices, no purchase controls, no store links" and "a child is never shown a purchase prompt" (`docs/38-front-door-and-flow.md:477`); the entitlement table's learner column is "Nothing" for every paid state (`docs/38-front-door-and-flow.md:462-469`); "learner surfaces contain no purchase language at all" (`docs/38-front-door-and-flow.md:489`); repo-wide: "No paywall, price, or upgrade prompt may render on a learner surface. Ever." (`CLAUDE.md:38`). Business tiers are never rendered to guardians, structurally (`docs/design/overhaul-v2/00-binding-decisions.md:44`).
- No learner-to-learner social — no DMs, feeds, or friend graphs (`docs/pack/33-moyo-learn-prd.md:159`).
- No emotion recognition of minors, permanent, not deferred (`docs/pack/33-moyo-learn-prd.md:161`).
- Children's audio never leaves the device; on-device STT only (`docs/pack/33-moyo-learn-prd.md:160`).
- No third-party ads or data sale, ever (`docs/pack/33-moyo-learn-prd.md:167`).

Learner avatars come from a curated set; no upload (`docs/design/overhaul-v2/00-binding-decisions.md:44`).

Photography is **banned on child learning surfaces** — decorative stock competes with the one-task rule and the tutor-presence signature; illustration there is ink-line plus flat token fills only (`docs/pack/08-visual-hierarchy-spacing-spec.md:138`). Photography is allowed on tutor/teacher profile photos, business marketing, and parent-facing onboarding/empty states, sparingly (same line). Every in-product photo sits in an ink frame — `border-2 border-strong`, `radius-card`, `shadow-card` — and may use a paper/ink duotone; alt text mandatory; faces of minors never in marketing without the consent machinery (`docs/pack/08-visual-hierarchy-spacing-spec.md:139`).

### 4.4 Doc 31 voice and readability gate — the actual thresholds

Bands: **K–2 · 3–5 · 6–8 · 9–12** (`docs/pack/31-grade-voice-safety-incidents.md:18`). Band defaults from grade; the learner profile carries a separate `readsAt` override. **Voice follows `readsAt`; curriculum follows grade** (`docs/pack/31-grade-voice-safety-incidents.md:20`).

Per-band voice constraints (`docs/pack/31-grade-voice-safety-incidents.md:26-41`):

| Band | Sentence length | Readability target | Other |
|---|---|---|---|
| K–2 | ≤8 words, one idea per sentence | Flesch-Kincaid grade near **1** | one question at a time, never two; numbers under 20 in examples; no idioms, no sarcasm, no rhetorical questions; concrete objects only |
| 3–5 | ≤12 words | FK **3–4** | defined-on-use vocabulary |
| 6–8 | ≤17 words | FK **6–7** | abstractions allowed when anchored to an example |
| 9–12 | natural register | FK **9–10 ceiling** | **no artificial simplification** — teens hear condescension instantly, and it is as much a failure as complexity |

The gate itself (`docs/pack/31-grade-voice-safety-incidents.md:46-53`):

- **Metrics by band** — Spache for K–2 and 3–5; Dale-Chall as the 3–5 cross-check; Flesch-Kincaid Grade Level + Reading Ease for 6–8 and 9–12; plus simple-word ratio and mean sentence length (`:49`).
- **Tolerance thresholds** — passes within **+1.5 grade levels** of band target; **+1.5 to +3 triggers a rewrite**; **beyond +3 always rewrites**. Never gates below target — simpler than needed is not a failure (`:50`).
- **On violation: rewrite, don't block.** If the rewrite still fails, ship the rewrite and log the miss — "a slightly-too-hard reply beats a frozen tutor" (`:51`).
- **Streaming** — computed per accumulated sentence window; a mid-stream breach cuts to the rewrite path at a sentence boundary (`:52`).
- **Vocabulary exception** — the lesson's target vocabulary is exempt from the complexity penalty when it appears with an in-band definition. "The gate enforces that new words arrive explained, not that they never arrive" (`:53`).
- **Eval cells** — a model/prompt combo passes a band cell only at **≥95%** eval-set pass rate *and* human confirmation the register is not condescending (`:56`).

Safety ladder, which the design must render without shouting (`docs/pack/31-grade-voice-safety-incidents.md:67-74`): S1 log (warm redirect) · S2 flag (repetition auto-escalates to S3) · S3 incident → guardian, 48h SLA · S4 urgent — tutoring stops, fixed human-written script, never generated, human paged, 2h SLA (`:117`).

Screen constraints inside doc 31 §5, which bind any reset of these surfaces:

- Intake has **no severity choice**, and **redpen appears nowhere on the intake form** — "a wall of red at the moment of reporting reads as alarm and suppresses reports" (`docs/pack/31-grade-voice-safety-incidents.md:127`).
- Guardian incident view has a fixed order — **What happened → What the tutor did → What happens next → Talk about it** — with no red page-frames and no sirens (`docs/pack/31-grade-voice-safety-incidents.md:130`). Redpen is reserved for S3/S4; S1/S2 use graphite (same line).
- Triage queue severity is a **3px `border-left` + a `label` pill**, never row-flooding color; unassigned-S4 is the one thing allowed to interrupt and is the screen's single highlighter use (`docs/pack/31-grade-voice-safety-incidents.md:133`).
- The CRM never reads incidents (`docs/pack/31-grade-voice-safety-incidents.md:114`).

---

## 5 · EVIDENCE SEMANTICS

Source: `docs/pack/34-session-summary-reports.md`.

### 5.1 Movement vs position — never conflated

Block 4 renders the two axes separately (`docs/pack/34-session-summary-reports.md:29-31`):

> **Movement** (celebrated): the mastery delta, rendered as the doc 08 MasteryBar before→after. *"Practicing → Getting it."*
> **Position** (honest): where this skill sits relative to the learner's grade expectations, in normalizing language: *"Still building toward where 2nd grade lands — right where the work should be."* Struggling is **never red** (doc 08 law) and never hidden. **These two axes are never conflated** — conflation is exactly how 80% of kids get B's while 30% are proficient.

Restated in the binding digest: "mastery delta (celebrated, MasteryBar before→after) vs grade-relative position (honest, normalizing language)" (`docs/design/overhaul-v2/00-binding-decisions.md:48`).

### 5.2 The permitted trajectory phrases — quoted exactly

Block 3 problem status, in trajectory language, never pass/fail (`docs/pack/34-session-summary-reports.md:27`):

> `solved on their own` (grade-green) · `solved with help` (graphite) · `still working on it` (highlighter — doc 08: a learner mid-struggle is never red; redpen is reserved for an *incorrect final answer the child submitted as done*, rendered as the answer's underline, the one place "marked wrong" is honest and school-native).

The schema literals behind those three phrases are `'solved-independently' | 'solved-with-help' | 'still-working'`, plus `submittedIncorrect?: boolean` for the redpen-underline case only (`docs/pack/34-session-summary-reports.md:58-59`).

The trajectory *is* the accomplishment: *"missed twice → solved on her own"* on one row does more than any adjective — the block is the concrete proof the headline claims (`docs/pack/34-session-summary-reports.md:28`).

### 5.3 The eight blocks, fixed order, schema-enforced

Every claim is evidence-linked or it does not render (`docs/pack/34-session-summary-reports.md:20`). Order (`docs/pack/34-session-summary-reports.md:22-35`): 1 Headline accomplishment (the screen's single display moment) · 2 What we worked on · 3 The problems, grouped by subject, **accordion open by default** · 4 How it went (movement + position) · 5 A moment of effort · 6 What's next · 7 How to help at home (exactly two items) · 8 The facts strip, de-emphasized in `caption`/`data` mono.

Block 3 groups are **all expanded on load** — "a parent reads the report, they don't excavate it"; the collapse affordance exists for long multi-subject sessions, not as the default posture (`docs/pack/34-session-summary-reports.md:24`). Rendering spec: subject headers as `title` 17/600 with a 44px chevron target, `gap-group` between subjects, rows at Hot height 64+, status as a `label` pill, rows separated by `gap-element` and never flush borders (`docs/pack/34-session-summary-reports.md:114`).

### 5.4 What a report never contains

Engagement metrics framed as wins (streaks, minutes, message counts); ability praise ("so smart," "gifted," "natural"); grade *predictions*; comparisons to other children; and **safety content** — a session that raised an S3/S4 gets a normal schoolwork summary and the incident travels doc 31's channel. "A parent must never discover an incident in paragraph three of a cheerful recap" (`docs/pack/34-session-summary-reports.md:37`).

Duration is context, never an achievement — minutes are not learning (`docs/pack/34-session-summary-reports.md:35`).

### 5.5 The generation boundary that makes the copy honest

The narrative model never sees the transcript; it sees the evidence table. "That single constraint delivers anti-sycophancy (can't praise what isn't evidenced), privacy (can't quote the child), and safety (can't surface S-content)" (`docs/pack/34-session-summary-reports.md:110`). Blocks 3 and 8 are deterministic, assembled from session events, not generated (`docs/pack/34-session-summary-reports.md:87-91`). Block 5 cites an event or it is omitted (`docs/pack/34-session-summary-reports.md:32`).

Human and hybrid sessions route to the tutor draft queue; `tutorApprovedBy` is required when `sessionKind != 'ai-tutor'` (`docs/pack/34-session-summary-reports.md:72`). Teacher share is a guardian-initiated, revocable, expiring tokened read-only page carrying blocks 1–6 + 8 (`docs/pack/34-session-summary-reports.md:116`).

Not measured, ever: report open streaks, notification CTR optimization, "anything that would tune reports toward flattery" (`docs/pack/34-session-summary-reports.md:120`).

---

## 6 · ENTITLEMENT STATE MACHINE

### 6.1 Where it lives

- **Spec:** `docs/38-front-door-and-flow.md:452-491` (§5B), the doc that owns the paywall *surfaces*; pricing and tiers are doc 05's (`docs/38-front-door-and-flow.md:456`).
- **Type and projection:** `packages/auth/src/entitlements.ts` — "the projection `Stack.Protected` guards and `PermissionGate` read; nothing downstream ever looks at a Stripe status directly" (`packages/auth/src/entitlements.ts:2-3`).
- **Client plumbing:** `packages/app/providers/entitlements/entitlements.client.ts`, `entitlements-sync.tsx`, `use-entitlements.ts`; server route `apps/web/app/api/entitlements`.

### 6.2 Truth direction

Server truth only: RevenueCat webhooks → Payload, Stripe webhooks → Payload. "Screens *read* `entitlement`; they never derive it from a purchase result alone" (`docs/38-front-door-and-flow.md:459`). One entitlement identifier per tier (`family`, `business_*`), mirrored across both rails (same line). Moyo's paywall screens are Moyo-designed; RevenueCat's `presentPaywall()` is the fallback only (`docs/38-front-door-and-flow.md:457`).

### 6.3 The states

Doc 38 names six (`docs/38-front-door-and-flow.md:462-469`): `none` · `trialing` · `active` · `past_due` · `canceled` · `expired`.

The shipped union names six that do not match (`packages/auth/src/entitlements.ts:21-27`):

```ts
export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
```

`expired` exists in the doc and not in the type; `incomplete` exists in the type and not in the doc. Recorded as conflict C-6 in §9.

Carrier shape: `SubscriptionState { plan, status, referenceId, periodEnd, seats }` (`packages/auth/src/entitlements.ts:29-38`), with `NO_SUBSCRIPTION` as the named zero value (`:40-46`).

### 6.4 What the UI must respect

**Per-state surface behaviour** (`docs/38-front-door-and-flow.md:462-469`):

| `entitlement.status` | Guardian sees | Learner sees |
|---|---|---|
| `none` | free-tier limits; PW-03a on limit; PW-01 from Settings and the Home card | free-tier limits; PW-03b on limit — **no prices, ever** |
| `trialing` | Home card "Free month ends {date}"; PW-02 at T−3 days | Nothing |
| `active` | PW-05 in Settings; nothing else | Nothing |
| `past_due` | non-blocking banner → PW-05; access continues through the grace window | Nothing |
| `canceled` | PW-05 shows "Ends {date} · Resume"; no nagging | Nothing |
| `expired` | PW-04 once, dismissable to free tier | free-tier state |

**Capability flags the UI gates on**, not the raw status (`packages/auth/src/entitlements.ts:48-70`): `active` · `trialing` · `canExport` · `canWrite` · `canPractise` · `limits` · `shouldOfferUpgrade`.

Three invariants the projection exists to hold:

1. **`canPractise` is true on every status there is, including `none`** — "a lapsed card must never take a child's practice away" (`packages/auth/src/entitlements.ts:60-65`, enforced at `:124`).
2. **`canExport` stays true after expiry** — doc 05 §6's "everything you've set up stays" promise (`packages/auth/src/entitlements.ts:5-8`, enforced at `:121-122`).
3. **`past_due` keeps writing.** Stripe retries a failed card for days; locking a tutoring business out of its own calendar costs more trust than the fortnight it protects. `canceled` and `incomplete` do not write: "one is a decision and the other never started" (`packages/auth/src/entitlements.ts:74-78`, `:105-116`).

`daysLeft()` floors at zero and returns `null` without a `periodEnd` — it feeds the trial chip (`packages/auth/src/entitlements.ts:131-137`).

**Paywall surface law** (`docs/38-front-door-and-flow.md:489`): prices read as full phrases; the auto-renew sentence is real text near the primary button, not a footnote; `Not now` / `Stay on free` are real buttons with full contrast; no timers, no fake scarcity, no pre-checked upsells; learner surfaces contain no purchase language at all. PW-03a's `Not now` is "never disabled, never smaller than 44dp, never grey-on-grey" (`docs/38-front-door-and-flow.md:475`). PW-07 is one screen with "no guilt loop, no multi-step retention maze" and no re-offer (`docs/38-front-door-and-flow.md:485`). Event payloads carry no PII and no prices (`docs/38-front-door-and-flow.md:491`).

The eight surfaces are PW-01 plan+trial · PW-02 trial-ending T−3 sheet · PW-03a guardian limit sheet · PW-03b learner limit stop · PW-04 lapsed, shown once · PW-05 manage plan · PW-06 restore (mobile) · PW-07 cancel · PW-08 web billing (`docs/38-front-door-and-flow.md:471-488`). Mobile management actions open RevenueCat's Customer Center because store subscriptions are managed by the store (`docs/38-front-door-and-flow.md:481`).

Plan/billing renders for learners **never**, on any paid state (`docs/decisions/adr-106-account-sheet-is-profile-you.md`, learner rules).

---

## 7 · NATALIE

### 7.1 What doc 37 decides

Onboarding's hero animation is **Natalie's baked greeting clips from doc 32 Path B** — ElevenLabs v3 voice + A2F blendshape performance, rendered once, served from Bunny. "The 'realistic animation' Mike wants is *the actual product performing*, not a Lottie approximation of it" (`docs/pack/37-onboarding-dual-pane.md:16`).

Clip contract, binding (`docs/pack/37-onboarding-dual-pane.md:16`): **≤6s · captioned always · `prefers-reduced-motion` swaps clip → still frame + text · K–2 gets the slower/warmer take** (doc 32 band modulation).

Lottie/Rive are confined to micro-transitions — progress ticks, confetti at `celebrate-small` scale (`docs/pack/37-onboarding-dual-pane.md:17`). Learner sequence order: code redeem → avatar pick (curated set) → **Natalie's baked hello, band-voiced** → guided first Snap → Today (`docs/pack/37-onboarding-dual-pane.md:20`). K–2: voice carries every screen, zero reading required to complete (same line).

Front door: FD-17 "Natalie says hi" is skippable after 2s, reduced-motion = still (`docs/38-front-door-and-flow.md:58`); FD-01 Welcome's brand pane uses the Natalie baked clip, still frame under reduced motion (`docs/38-front-door-and-flow.md:232`); captions on by default, pause button, muted until tap (`docs/38-front-door-and-flow.md:539`).

### 7.2 What the kit already owns

`packages/ui/TutorPresence.tsx` (364 lines) holds the presence rule and must be extended, not duplicated (`docs/design/reset/00-repo-baseline.md:32`). Its own statement of the rule: "Presence is not a state of the conversation, it is the conversation's other participant, so it is rendered here, once, outside the switch" (`packages/ui/TutorPresence.tsx:8-10`). It carries five Mobbin references already (`packages/ui/TutorPresence.tsx:12-25`).

### 7.3 ADR-111 — the native 3D runtime (DECIDED)

Status: **ACCEPTED (the work); the switch is governed by a go/no-go gate** (`docs/decisions/adr-111-native-3d-runtime.md:3`).

Decided (`docs/decisions/adr-111-native-3d-runtime.md:19-41`):

- Runtime is `react-native-webgpu@0.9.0`, pinned exactly, with `three` at catalog `0.185.1` so the phone bundle resolves the same copy `packages/avatar` imports (`three/webgpu`, `three/tsl`).
- **The 3D path ships behind a flag whose committed default is OFF.** 2D presence is not a fallback — "it is what runs, and 3D is an additive upgrade to it." Promote only on a real first rendered frame with the head evaluated; never mid-utterance; demotion is immediate, unconditional and permanent for the session; a download failure is "2D, and we stopped trying", never an `error` kind at a child (`:32-38`).
- **One mount site, `react-freeze` enforces it.** Three mechanisms, none removable: `<Freeze freeze={!visible}>` keeps the subtree mounted through a pane collapse; the render loop stops itself on the same visibility flag (`setAnimationLoop(null)`, `cancelAnimationFrame`, face bus off) — that is the battery fix; `disposeWebGPURenderer` runs only on genuine unmount and **must never run on a pane toggle** (`:42-54`).
- **Never conditionally render her pane.** `{visible ? <Natalie/> : null}` tears down the renderer and the glTF scene graph. Always mounted, always wrapped, toggle the `freeze` prop (`:56-59`).
- **Embedded images cannot load in React Native** — Hermes has no `new Blob([ArrayBuffer])`, so `GLTFLoader` fails on device only, "the worst possible failure mode." Assets must externalise `.bin` and images, keep 52 morph targets and 1 skin, carry no Draco, and be asserted by `assertLoadableInReactNative`, not eyeballed (`:104-125`).
- **Release builds must not use `require` + `Image.resolveAssetSource`** — release asset flattening breaks relative `.bin`/image resolution. The demo path is the `assets.ts` manifest + injected downloader + sha-256 verify + cache against `natalie-phone/` on Bunny, handing `GLTFLoader` a downloaded directory URI (`:127-132`).

Measured assets in the tree today (`ls -la packages/avatar/assets`, 2026-09-05):

| File | Size | Note |
|---|---|---|
| `packages/avatar/assets/natalie-phone/` | 13 MB total — `natalie.bin` 11.5 MB, `natalie.gltf` 219 KB, 8 external PBR maps (2 PNG, 6 JPG) | the device-loadable form ADR-111 §The asset specifies |
| `packages/avatar/assets/humano-marketing.glb` | 12.5 MB | matches ADR-111's stated 12.5 MB, 52 ARKit morph targets, 1 skin (`docs/decisions/adr-111-native-3d-runtime.md:101-102`) |
| `packages/avatar/assets/humano-marketing-source.glb` | 70 MB | the JPEG/PNG source the conversion runs from (`docs/decisions/adr-111-native-3d-runtime.md:110-111`) |

### 7.4 ADR-114 — never blank (DECIDED), and what its budget does not say

Status: **ACCEPTED** (`docs/decisions/adr-114-preload-and-loader.md:3`). Decided (`:16-49`):

1. **Frame 1 is the 2D mark, always.** The ADR moves work earlier; it does not loosen the promotion gate (`:18-21`).
2. **Preload.** Fetch, glTF parse, `.bin`, eight texture decodes and the Dawn material rebuild are one memoised promise, `preloadNatalie()`. The learner shell starts it on mount because every learner tab is one tap from the tutor screen; the stage adopts the same scene graph, never a second parse (`:22-29`).
3. **What preload cannot pay:** Dawn's pipeline creation on the first draw, which needs a live surface (`:30-36`).
4. **The loader is the mark plus a line**, in the band's register — K–2 and 3–5 *"Natalie's getting ready…"*, 6–12 *"Natalie's on her way"*. **Never a spinner, never "Loading assets"** (`:37-43`).
5. **The reveal is a dissolve** — the canvas has been drawing her behind the mark since `warming`; on swap the mark fades out over **320 ms** while she fades in. "She is never seen starting" (`:44-47`).
6. **Failure is 2D with a telemetry reason**; airplane mode at launch is the 2D path (`:48-49`).

**On the budget question: ADR-114 states no number for either start path.** Its table gives a *target* for warm start as "3D on the first frame the controller allows (after `minimumPresenceMs` = 900 ms and no utterance)" and for cold start as "2D mark on frame 1; **3D within a stated budget on hotspot**" — the budget is referred to and never stated. Both **Measured** cells read "pending — device run blocked while the peer session owns the phone" (`docs/decisions/adr-114-preload-and-loader.md:62-68`). The only hard figure is `blank frames: 0`, held "by construction: the mark renders on frame 1 whether or not the flag is on" (`:68`).

So against the 13 MB `natalie-phone/` payload and the 11.5 MB `.bin` inside it, there is no pass/fail threshold to design to. The one number the ADR does commit to is the 900 ms `minimumPresenceMs` floor before promotion, and its consequences note that the shell now holds the scene graph in memory for a learner who may never open the tutor (`:73-75`). The ADR's own text calls the parse "a 14 MB parse" (`:72-73`), which is close to but not the same as the 13 MB measured directory — treat neither as a budget.

### 7.5 ADR-112 — live Audio2Face (DECIDED, host NOT stood up)

Status: **ACCEPTED (the contract and the client). The host is NOT stood up** (`docs/decisions/adr-112-live-audio2face.md:3`). Decided:

- Face frames are computed from **the exact ElevenLabs Flash bytes the client will play**, shipped together as one `performance`; the client schedules frame `k` at `start + k / fps` on `AudioContext.currentTime`. "There is no second clock and no second audio buffer, so face and voice cannot race."
- The Safety Plane still owns the performance. The face is computed inside `@acme/voice`, the credential-holding egress that only the voice route may import (`tooling/check-voice-egress.mjs`). No feature calls A2F; structurally no learner audio can reach it.
- **Emotion is specified, never inferred from anyone but Natalie.** The tone's `a2f` field travels as the explicit emotion. Audio2Emotion may read *her* voice for telemetry; it never reads a child's, which the A2E licence also forbids.
- Wire contract: `200 application/json { audio: base64, audioContentType, face: { fps, names, frames } }`; `names` is carried, never assumed, because the SDK's `mouthClose` deviates from ARKit. `200 audio/mpeg` remains the answer when no face host is available.

### 7.6 ADR-113 — the body motion layer (B and C shipped, A blocked)

Status: **ACCEPTED (layers B and C). Layer A is blocked on assets** (`docs/decisions/adr-113-body-motion-layer.md:3`).

The finding that came first: the phone body is a Blender Rigify export whose control bones (`head`, `neck`, `chest`, `jaw_master`, `DEF-pelvis`) "are not ancestors of any bone that carries weight" — constraints do not export, so every head turn, nod, breath and jaw motion was written to nothing (`docs/decisions/adr-113-body-motion-layer.md:18-26`). Now a red test: `presence/rig-axes.test.ts` builds the hierarchy from the shipped glTF and asserts bone ancestry, control-bone inertness, and local-axis semantics (`:28-37`). **The model asset is not altered** — Mike asked that the model not be touched (`:39-40`).

Layers (`docs/decisions/adr-113-body-motion-layer.md:44-48`): **A. Base idle** (Mixamo clips retargeted to `DEF-*`) — **blocked on assets**; **B. Procedural micro-motion** (`idle/engine.ts`, seeded) — shipped, golden-testable; **C. Event / co-speech** — shipped.

Layer B's numbers are fixed and testable (`docs/decisions/adr-113-body-motion-layer.md:52-60`): weight shift every U(8,20)s, ±22 mm hip travel, 8% follow-through · torso 0.05 Hz × 1.5° with held turns of U(2,4)° · shoulders 0.12 Hz × 1.5°, wrists 0.18 Hz × 3°, independent per side · ten finger channels each at its own U(0.2,0.35) Hz and U(2,5)° · gaze away every U(3,4)s for U(0.3,1.2)s — "the firewall's stare ceiling is 4 s, so by construction it cannot be exceeded" · head follow at 35% of gaze, τ = 0.35 s.

### 7.7 What is decided vs open — Natalie

**Decided:** the runtime and its pin; flag default OFF; the mount-site and dispose rules; the 2D-first frame and the dissolve reveal; the loader copy per band; the clip contract (≤6s, captioned, reduced-motion still); the A2F wire contract and the emotion-never-inferred rule; layer B's motion numbers; that the model asset is not to be altered.

**Open:** see §8.7.

---

## 8 · THE OPEN QUESTIONS

Everything the binding documents explicitly defer, leave `[decision]`/`[verify]`, or mark blocked. A reset that guesses at any of these is inventing product. Each row names the document that defers it.

### 8.1 Pricing, limits and paywall mechanics

| Open item | What is deferred | Deferred by |
|---|---|---|
| The free-tier limit | PW-03a fires on "the doc 05 limit event (the exact limit is doc 05's `[verify]`)". PW-04's copy says "{n} sessions a week" with `n` unresolved | `docs/38-front-door-and-flow.md:475`, `:479` |
| Early-bird eligibility cap | "first N founding families or a hard date printed on the paywall" — neither N nor the date is set, and the doc requires it be "a real, stated limit … never a fake countdown" | `docs/pack/05-monetization-access-spec.md:47` |
| RevenueCat Paywall Builder | `[decision]` — templates "are not used unless design parity can be shown". Nobody has shown or refused parity | `docs/38-front-door-and-flow.md:457` |
| Kids Category / Designed for Families | `[decision]` — unrecorded; doc 33 non-goal 8 says "revisit with counsel post-launch" | `docs/38-front-door-and-flow.md:736`; `docs/pack/33-moyo-learn-prd.md:166` |
| Annual plan | "annual discount test post-launch" is a risk mitigation, not a decided surface | `docs/pack/33-moyo-learn-prd.md:204` |
| `expired` vs `incomplete` | Which name the UI reads — see conflict C-6 in §9 | unresolved between `docs/38-front-door-and-flow.md:462-469` and `packages/auth/src/entitlements.ts:21-27` |

### 8.2 Roles and shells

| Open item | What is deferred | Deferred by |
|---|---|---|
| Solo tutor = org of one | `[decision]` in the section heading itself; the tutor flow assumes an org invite otherwise | `docs/38-front-door-and-flow.md:63` |
| School-admin mobile IA | The four-tab set is pre-committed but "no additional tab ships until the role has a PRD persona and an entitlement story (E-matrix G-10/G-3 are the gate, not this ADR)" | `docs/decisions/adr-103-school-admin-ia.md` |
| A messaging surface | "A real messaging tab would need both a product decision and a surface; neither exists" | `docs/design/overhaul-v2/G-navigation-maps.md:38` |
| A notifications affordance | Named in G §4's target map, but "no contract binds it"; org Safety stays unbadged per doc 31 §5.3 | `docs/design/overhaul-v2/J-component-plan.md:218` |
| Search / ⌘K | "zero screen contracts reference a search surface; K–2 ban stands regardless" — needs a contract plus an ADR-scale decision | `docs/design/overhaul-v2/J-component-plan.md:217` |
| District, everything | IA now, build later — Phase 3, and PRD non-goal 6 removes the v1 sales motion | `docs/pack/36-role-navigation-flows.md:58`; `docs/pack/33-moyo-learn-prd.md:164` |
| Teacher onboarding polish | The teacher flow ships as-is; "its contextual polish (photography, Natalie beats) is deferred until the guardian/learner treatment has proven out" | `docs/pack/37-onboarding-dual-pane.md:24` |
| The roster of record | `prompts/ROSTER.md` was absent when the digest was written; the digest's resolution was to treat the overhaul prompt §1 table as roster of record. The file now exists (`docs/design/reset/00-repo-baseline.md:21`), so the interim resolution is spent and the two should be reconciled | `docs/design/overhaul-v2/00-binding-decisions.md:9` |

### 8.3 Assets — the ones that block design, not code

| Open item | What is deferred | Deferred by |
|---|---|---|
| Onboarding photography | "**externally blocked**, not skipped: onboarding **photography** waits on the doc 08-conformant shoot (no asset exists; type-on-surface stays until it does)" | `docs/pack/37-onboarding-dual-pane.md:24` |
| Natalie's baked greeting clips | "wait on doc 32 Path B renders — the baked *audio* path shipped and degrades gracefully, but the clip contract (≤6s, captioned, reduced-motion still-frame swap) has nothing to bind to yet" | `docs/pack/37-onboarding-dual-pane.md:24` |
| The learner sample worksheet | "an open asset item: until it exists the snap beat honestly offers 'try it on your own homework' rather than staging a pretend one" | `docs/pack/37-onboarding-dual-pane.md:24` |
| The mood board | PR-21 requires it "committed to `docs/design/`". No mood-board file exists in `docs/design/` (checked 2026-09-05) | `docs/pack/08-visual-hierarchy-spacing-spec.md:155` |
| Photography licence provenance | The 43 files across `apps/web-vite/public/images` and `data/photography` need their licences recorded; the registry's first job | `docs/design/reset/00-repo-baseline.md:57` |
| Mixamo base-idle clips | ADR-113 Layer A is "**Blocked** — see below"; retargeting assets do not exist | `docs/decisions/adr-113-body-motion-layer.md:46` |

### 8.4 Tokens and the design system

| Open item | What is deferred | Deferred by |
|---|---|---|
| Chart palette tokens | "charts currently have no named token set" — queued, undone | `docs/design/overhaul-v2/I-token-system.md:74` |
| Token-role mapping for doc 38's specs | Doc 38 §5 names tokens by role (`space.section`, `type.display`, `target.min`) and defers the mapping to "Phase 0"; deliverable Q is still PARTIAL | `docs/38-front-door-and-flow.md:242`; `docs/design/overhaul-v2/B-deliverable-status.md:26` |
| `TwoPaneShell` conformance | `[verify]` — whether it implements §4's width-class table and the header-band collapse; "add `variant` to `BrandPaneContent` if missing (`welcome \| photo \| accent`)" | `docs/38-front-door-and-flow.md:599` |
| `unstable-split-view` adoption | "Adopt it behind the same `AdaptivePanes` API **only when it exits alpha and its constraints fit**… Revisit when SplitView goes beta" | `docs/pack/37-onboarding-dual-pane.md:35` |
| Band-variant retrofit list | Started with `ProgressBar`/`MasteryBar`; the wider list "lives in J-component-plan §7" and is unbuilt | `docs/design/overhaul-v2/I-token-system.md:73` |
| Re.Pack re-evaluation | Metro is binding; re-eval fires only on three named Phase-3 triggers (embeddable district module, separate release trains, org/tutor becoming a second app) | `docs/pack/36-role-navigation-flows.md:94` |

### 8.5 Safety, incidents and reports

| Open item | What is deferred | Deferred by |
|---|---|---|
| S4 legal-review checkpoint | "the S4 workflow must have a legal-review checkpoint before launch" — abuse disclosures carry reporting obligations "separate from and senior to guardian notification" | `docs/pack/31-grade-voice-safety-incidents.md:76` |
| Incident collection field names | "sketch — field names settle at PR" | `docs/pack/31-grade-voice-safety-incidents.md:81` |
| S4 retention schedule | S4 and abuse-disclosure records "follow the legal-hold schedule counsel sets" — the schedule is not in any doc here | `docs/pack/31-grade-voice-safety-incidents.md:111` |
| Session→tutor incident scope | ADR-108 deliberately did not solve "my sessions"; closed later by ADR-110's `sessions.tutorAuthId` — verify before designing the tutor incidents list | `docs/decisions/adr-108-tutor-learner-edge.md` |

### 8.6 Research and audit gaps that a designer will hit

| Open item | What is deferred | Deferred by |
|---|---|---|
| 8 Mobbin flows never inspected | "Khan ×2, Duolingo ×2, Google homework, Quizlet scan, ChatGPT Voice ×2" — the plugin was down; these are the closest comparators to the learner loop | `docs/design/overhaul-v2/B-deliverable-status.md:23`, `:55` |
| Journey maps beyond the front door | Deliverable L is PARTIAL; the five `seq-*.md` files "are service sequences, not user journeys" — core learner loop, guardian weekly, tutor day, org ops absent | `docs/design/overhaul-v2/B-deliverable-status.md:21` |
| One unified screen ID scheme | FD-*/PW-* exist; product screens use provisional `role:screen` IDs that "are placeholders, not the scheme" | `docs/design/overhaul-v2/B-deliverable-status.md:13`, `:52`; `docs/design/overhaul-v2/F-journey-maps.md:11` |
| Tenant axis | Deliverable D/E PARTIAL — "Tenant axis absent from every doc (code has it: `packages/theme/tenant.ts`)"; E later adds it, B's row is stale | `docs/design/overhaul-v2/B-deliverable-status.md:15` |
| Implementation plan with phase gates | Deliverable S: **ABSENT** | `docs/design/overhaul-v2/B-deliverable-status.md:28` |
| Front-door Mobbin research | "link-level only" — the 34 FD/PW screens carry reference URLs but no adopt/refuse pass | `docs/design/overhaul-v2/B-deliverable-status.md:23` |
| Utility-bar map | Deliverable I/J PARTIAL — "no utility-bar map; DashboardShell slots are the seam" | `docs/design/overhaul-v2/B-deliverable-status.md:19` |

### 8.7 Natalie

| Open item | What is deferred | Deferred by |
|---|---|---|
| The cold-start budget number | The table says "3D within a stated budget on hotspot" and never states it; both **Measured** cells read "pending — device run blocked while the peer session owns the phone" | `docs/decisions/adr-114-preload-and-loader.md:62-68` |
| Whether the 3D flag is on | Committed default is OFF; the flip is governed by a go/no-go gate whose doors time "is not known to me at the time of writing and must be filled in by Mike" | `docs/decisions/adr-111-native-3d-runtime.md:32`, `:70-71` |
| The `compact` ↔ pane crossing | Remounts her; "either portalled or formally accepted as a demote" — recorded, not solved | `docs/decisions/adr-111-native-3d-runtime.md:141-143` |
| Pre-warmed off-screen canvas | Would remove Dawn's first-draw pipeline cost "but that needs a portal across Expo Router screens… recorded here as the next step, not done" | `docs/decisions/adr-114-preload-and-loader.md:30-36` |
| Golden images per shipping tier | Follow-up, including reduced motion (doc 22 §8) — not produced | `docs/decisions/adr-111-native-3d-runtime.md:141-142` |
| The gesture gate on the live track | Follow-up, unwired | `docs/decisions/adr-111-native-3d-runtime.md:142` |
| The A2F GPU host | "The host is **NOT** stood up"; `200 audio/mpeg` (no face) is what ships until it is | `docs/decisions/adr-112-live-audio2face.md:3` |
| Memory release on shell exit | Preload holds the scene graph for a learner who may never open the tutor; "Not released on shell exit in this pass" | `docs/decisions/adr-114-preload-and-loader.md:74-75` |
| Where Natalie appears outside S9 | Doc 37 places her in onboarding; ADR-111/114 place her in the tutor session. Placement on Today and completion is named as open work by the reset baseline, not by a binding doc | `docs/design/reset/00-repo-baseline.md:55` |

### 8.8 Copy

Doc 38's per-screen copy is "final unless marked `[alt]`" (`docs/38-front-door-and-flow.md:244`). Any screen the reset re-composes keeps that copy unless it is re-approved. Band-voiced learner copy is generated under doc 31's gate (§4.4), not authored per screen.

---

## 9 · CONFLICTS

Each row states the collision and which document wins under the precedence order in §Precedence. "Wins" means: build to that one, and if you need the other, ship an ADR that names the losing line the way `docs/decisions/adr-107-learner-pane-ban-reaffirmed.md:76` does.

### C-1 · The learner pane ban vs its own exemption

`docs/pack/37-onboarding-dual-pane.md:40` says "**Learner: never**". `docs/decisions/adr-107-learner-pane-ban-reaffirmed.md` exempts the S9 tutor session and names the contradiction itself: "doc 37 §3.3's '**Learner: never**' is now 'learner: never, except the S9 tutor session.' Doc 37 should carry that sentence; until it does, this amendment is the source of truth and doc 37 §3.3 is stale on that one word" (`:76`). Amendment 2 does the same to two more documents: "doc 23 §5's second column is back, and `docs/design/tutor-session-thread-first.md` is now correct only for `compact` and `medium`" (`:162-164`).

**Winner: ADR-107, narrowly.** A signed ADR that names the line it supersedes outranks that line. Everything the ADR does not name — every learner surface other than `TutorStage`, every width below 840dp — is still governed by doc 37 §3.3 verbatim.

### C-2 · K–2 touch target: 56 or 72

`docs/38-front-door-and-flow.md:61` says K–2 "targets 56dp"; `:247` says "learner surfaces ≥ 56dp". `docs/pack/08-visual-hierarchy-spacing-spec.md:53` says `target-young` is 72 for K–2 primary actions and adds "the Tutor tab's 64pt already sits between child and young — raise to 72 on K–2 profiles". The shipped token agrees with doc 08: `targets.young = '72px'` (`packages/theme/tokens.ts:869`).

**Winner: doc 08.** `docs/pack/*` outranks doc 38. K–2 primary actions are **72**; doc 38's 56 is the `child` band value (3–5) and reads as a learner-surface floor, not the K–2 primary-action size. A reset that specs 56 for a K–2 primary action ships a target `tooling/check-targets.mjs` should reject.

### C-3 · The teacher shell

`docs/pack/36-role-navigation-flows.md:51` says the school-teacher variant "is a tokened read-only page — no shell, no login". `docs/decisions/adr-102-teacher-shell-ia.md` says the shell exists with four tabs, "doc 37 §2's amendment and doc 38 FD-23 supersede doc 36 §3.3's 'no shell' line, which predates the S25 flow".

**Winner: ADR-102, and the two documents it cites.** `docs/pack/37-onboarding-dual-pane.md:24` (the PR-145 amendment) and `docs/38-front-door-and-flow.md:152` (FD-23) both postdate doc 36 and both outrank the digest. The tokened read-only share page survives for the *link-viewer* case only (`docs/pack/34-session-summary-reports.md:116`).

### C-4 · District mobile

`docs/pack/36-role-navigation-flows.md:58` binds district to web-only. A mobile `(district)` group shipped anyway, rendering 1 of 5 declared tabs (`docs/design/overhaul-v2/D-screen-inventory.md:152`).

**Winner: doc 36.** `docs/decisions/adr-104-district-mobile-retirement.md` retires the tab bar and states that `/schools`, `/programs`, `/calendar`, `/more` "are never built".

### C-5 · Guardian tab count

`docs/pack/36-role-navigation-flows.md:46` binds four tabs. The repo carried seven guardian tab files, with Alerts unreachable (`docs/design/overhaul-v2/B-deliverable-status.md:46`).

**Winner: doc 36.** Reconciled to four by `docs/decisions/adr-101-guardian-tab-set.md`; calendar demoted to a stack route, messages and account retired.

### C-6 · Entitlement status names

`docs/38-front-door-and-flow.md:462-469` drives surfaces off `expired`. `packages/auth/src/entitlements.ts:21-27` has no `expired` and has `incomplete`, which doc 38 never mentions.

**Winner: doc 38 on what the UI must show; the code on what the webhook delivers.** `incomplete` is a real Stripe status the webhook sends (`packages/auth/src/entitlements.ts:17-19`); `expired` is not a Stripe status, so PW-04's "shown once after `expired`" is a derived surface state the projection does not currently expose. Nothing renders PW-04 correctly until someone decides where `expired` is computed. Open item, logged at §8.1.

### C-7 · The accent allowlist has six slot kinds, the doc names five

`docs/pack/36-role-navigation-flows.md:85` lists five slots. `tooling/check-role-accent.mjs:41-55` allowlists seven files covering six kinds — the five, plus "login/onboarding role-choice selection" (`RoleChoiceCard.tsx`) and "plan chooser selection" (`PlanCard.tsx`).

**Winner: doc 38, which authorises the sixth.** The gate cites `docs/38-front-door-and-flow.md:559` (`icon` 32dp, role-accent) and `:562-563` (`accent` prop; "selected (accent border 3dp…)") as the source. Doc 38 outranks the digest, so the slot is legal. Two cautions: doc 38 §8's "accent border 3dp" is a **border**, which `BANNED_PREFIX` refuses in every file including allowlisted ones (`tooling/check-role-accent.mjs:62`) — the shipped implementation must express selection as a ring or underlay fill, not `border-role-*`; and doc 36 §5's five-slot list should gain the sixth in writing, or the next reader will treat `PlanCard` as drift.

### C-8 · Typefaces and palette hexes: doc 02 vs doc 08 vs the code

`docs/pack/02-adaptive-screens-design-spec.md:178-180` specifies Bricolage Grotesque (display), Schibsted Grotesk (UI), Spline Sans Mono (data). `docs/pack/08-visual-hierarchy-spacing-spec.md:80` keeps Spline Sans Mono. Shipped: Archivo Black, Space Grotesk, Chivo Mono (`packages/theme/tokens.ts:624-633`). The code records the supersession for the mono face — "Doc 08 §3.1 names Spline Sans Mono here — superseded by Chivo Mono, chosen and shipped in PR-0; the ramp is what the doc is specifying, not the face" (`packages/theme/tokens.ts:789-790`) — and does not record one for the other two.

Same shape for color: `docs/pack/02-adaptive-screens-design-spec.md:167-173` gives literal hexes (`paper #FBFAF7`, `ink #17150F`, `ballpoint #2547E8`, `highlighter #FFE94A`, `redpen #D93A25`, `grade-green #1E7F4F`, `graphite #5F5B54`). The shipped semantics resolve through `palette` families whose names are "documented lies kept for class-name stability" (`docs/design/overhaul-v2/I-token-system.md:16`), and `light-dark()` pairs — not those flat values.

**Winner in practice: the code, and this needs writing down.** Under precedence doc 02 outranks everything else here, so a strict reading says the app should be in Bricolage Grotesque on `#FBFAF7`. It is not, three faces and a whole palette have moved, and only one of those moves is documented. A reset that quotes doc 02 §5.2 will specify fonts and hexes that do not exist in the repo. **Action: an ADR that supersedes doc 02 §5.2 by name**, or doc 02 gains the amendment. Until then treat `packages/theme/tokens.ts` as operative and cite it, never doc 02's table.

### C-9 · The design-language name

`docs/pack/02-adaptive-screens-design-spec.md:158` names the app's language **"Neubrutalism × Swiss ('Schoolhouse')"**. `docs/site/tokens.md:37` sets the *marketing site's* ratio at "60% Editorial Neubrutalism · 25% Tactile Learning · 15% Spatial Magic". The reset brief's "Neubrutalism × Tactile Learning Modernism" matches neither, and imports a marketing-site register into the app.

**Winner: doc 02 for app surfaces.** The site ratio is web-vite-scoped and explicitly out of app scope (`docs/design/overhaul-v2/I-token-system.md:67`). The reset either keeps doc 02's name for the app and reserves the Tactile Learning register for `apps/web-vite`, or ships an ADR superseding doc 02 §5 by name. Renaming the language in a brief does not do it.

### C-10 · New primitives with no screen contract

`docs/design/overhaul-v2/J-component-plan.md:10` makes contract demand the build trigger — "the trigger is duplication (actual or scheduled), never headcount or speculation" — and `:213` disposes of `LearningPath` specifically: "No contract references a path/map surface; learner.home is resume-first (ADR-107's Duolingo evidence is about singularity, not a path component)… **new contract first**."

`MissionPath` is `LearningPath` renamed, so that disposition already covers it. `EvidenceStrip` and `StatusHero` are named by no contract either. `design/screens/**/contract.md` is rank 4 of the precedence order; a primitive with no contract has no rank-4 support at all.

**Winner: the contract rule.** Each new primitive gets a screen contract naming it before it is designed, or it does not ship. The reset's own §6 primitive list is not a substitute for a contract.

### C-11 · Four proposed primitives already exist

`docs/design/reset/00-repo-baseline.md:32-35` records the overlaps: `NatalieDock` → `packages/ui/TutorPresence.tsx` (364 lines, **extend**); `Manipulative` → `packages/ui/LearningCanvas.tsx` (21 lines, **build inside** — it is the mount point, the new work is the renderer); `OutcomeDots` → `packages/ui/MasteryBar.tsx` (109 lines, **extend**); `StatusHero` → `packages/ui/Banner.tsx` + `StatCard.tsx` (**decide before building**).

Two binding rules make this non-optional: "Check for an existing component before creating one. Extend or compose; never duplicate a near-identical component" (`CLAUDE.md:33`), and the alias table's "A PR introducing any left-column name as a new component is a defect" (`docs/design/overhaul-v2/J-component-plan.md:16`).

`StatusHero` is the sharpest case. `Banner` owns the tone set `info | warning | incident | offline` (`packages/ui/Banner.tsx:15`, mapped at `:51-58`), and doc 31 forbids a second severity language — severity is a `border-left` and a pill, never a flooded frame (`docs/pack/31-grade-voice-safety-incidents.md:133`). A status hero with its own tones creates the second system.

**Winner: the existing components.** `StatusHero` either composes `Banner` or it needs an ADR saying why not (`docs/design/reset/00-repo-baseline.md:35`).

### C-12 · MissionPath vs resume-first and the Hot canvas rule

`docs/pack/36-role-navigation-flows.md:42` makes learner Home resume-first — "the top card is always 'continue where you left off'". `design/screens/learner/learner.home/contract.md:19` makes the primary action "Resume where you left off". `docs/decisions/adr-107-learner-pane-ban-reaffirmed.md:27` cites Duolingo's path as evidence for *singularity*: "exactly one 'next' node; zero resume friction because there is no navigation decision", and "K–2 Today should be Duolingo-degree singular — one 'next' tile, not a feed". Doc 08 requires ≥40% empty canvas on Hot screens and one primary action per screen (`docs/pack/08-visual-hierarchy-spacing-spec.md:43-44`).

A multi-node MissionPath on learner Home collides with all three.

**Winner: doc 36 and the contract.** If MissionPath exists it renders one next node on Home; a full journey view is a different screen and needs its own contract and its own D-inventory row.

### C-13 · Cut-paper art on child learning surfaces

`docs/pack/08-visual-hierarchy-spacing-spec.md:138` bans photography on child learning surfaces and constrains what replaces it: "illustration there is ink-line + flat token fills only". The reset's `scene` / `object` / `figure` classes are a cut-paper register, which is neither photography nor, read literally, ink-line-plus-flat-fills.

**Winner: doc 08.** The photography ban does not bite — cut paper is not stock photography — but the positive constraint does. Either the art direction stays inside ink-line plus flat token fills, or `docs/design/art-direction.md` supersedes doc 08 §6 by name. The ink-frame treatment for any in-product photograph (`border-2 border-strong`, `radius-card`, `shadow-card`, mandatory alt) is unaffected and still binding (`docs/pack/08-visual-hierarchy-spacing-spec.md:139`).

### C-14 · Artwork vs the one-accent-moment budget

Not a contradiction, a budget the art has to be designed inside. One display moment and one highlighter accent per screen (`docs/pack/08-visual-hierarchy-spacing-spec.md:84`; `CLAUDE.md:35`), Hot screens ≥40% empty canvas (`docs/pack/08-visual-hierarchy-spacing-spec.md:43`), and the role accent's own budget on top (`docs/pack/36-role-navigation-flows.md:85`). A saturated Scene spends the screen's attention budget before any UI does.

Gap to close: `tooling/check-contrast.mjs` has no text-over-artwork pairs yet (`docs/design/reset/00-repo-baseline.md:46`). Text on art is currently ungated.

### C-15 · The art-registry gating order — no conflict

`packages/art/registry.ts` keeps `scene`, `object` and `figure` deliberately empty, so their narrowed name types resolve to `never` and "every call site fails until real art exists. That is the intended state before `docs/design/art-direction.md` is approved" (`packages/art/registry.ts:24-26`, empties at `:128-129`). `tooling/check-art-registry.mjs` is in the root `lint` chain and `pnpm check:art` (`package.json:14`, `:36`).

**No binding document conflicts with this order, and two support it.** `docs/pack/37-onboarding-dual-pane.md:24` already treats missing art as "externally blocked, not skipped" and keeps type-on-surface until the shoot exists — the same posture, enforced by the compiler instead of by discipline. `docs/38-front-door-and-flow.md:22` applies the identical rule to data ("Every screen reachable from cold launch ships wired to the live provider, in the same PR train as the screen"). The registry's alt-carried-beside-the-file rule also discharges doc 08's "alt text mandatory" (`docs/pack/08-visual-hierarchy-spacing-spec.md:139`) structurally rather than per call site.

One sequencing note: doc 08's PR-21 requires the mood board committed to `docs/design/` (`docs/pack/08-visual-hierarchy-spacing-spec.md:155`) and no such file exists. That is an input to `art-direction.md`, not a competing gate.

### C-16 · Four gates were not running

`check-role-accent`, `check-sentry-invariants`, `check-store-separation` and `check-voice-egress` crashed on a dangling Pods symlink and never actually ran. The walkers now use `withFileTypes` / `lstatSync` across all ten — the reasoning is recorded in the gate itself: "A plain `statSync` does follow one, and a dangling link then throws ENOENT and takes the whole gate down" (`tooling/check-role-accent.mjs:67-71`).

This matters to the reset because binding documents cite three of those four as the enforcement of a rule: the accent allowlist (`docs/design/overhaul-v2/I-token-system.md:12`; `packages/theme/tokens.ts:320`), the CRM/learner store separation, and the voice-egress wall that ADR-112 leans on for "structurally, no learner audio can reach it" (`docs/decisions/adr-112-live-audio2face.md`, Decision 2). **Every claim of the form "enforced by gate X" in the binding docs was true of the script and false of the pipeline until this fix.** Treat pre-fix conformance as unverified: run the gates before trusting any surface that predates it.

### C-17 · "4px 4px" is a Hot value, not the shadow

`packages/theme/tokens.ts:750` defines `shadows.card` as `4px 4px 0 0 var(--color-border-strong)`, and that is the root default and `--shadow-hot`. On `.dial-cool`, `packages/theme/theme.css:563` remaps `--shadow-card` to `--shadow-cool` = `2px 2px 0 0 var(--color-border-faint)` (`packages/theme/theme.css:199`), and `--radius-card`/`--radius-sheet` to `--radius-cool` 0.5rem (`:561-562`, `:198`).

**Winner: the dial.** A blanket "4px 4px ink slab" spec is correct for Hot surfaces and wrong for every Cool one. Specify shadows as `shadow-card` under a stated dial, never as a literal offset.

### C-18 · `moyoRadius.card` 0.25rem vs the single control radius — a conflict after all

`docs/site/tokens.md:102` sets `moyoRadius.card` to `0.25rem`, "the ONE soft step, for tactile cards". The app enforces one control radius, `radius.control` `0.375rem` (`packages/theme/tokens.ts:738`), gated by `tooling/check-controls.mjs`.

**Corrected 2026-09-05.** This section previously ruled "not a collision" on the premise that `--radius-control` is not in the `.moyo-site` re-point list. It is. `packages/theme/theme.css:719` sits inside the `.moyo-site` block opened at `:687` and re-points `--radius-control` to `--radius-moyo-card`; the generator emits it at `packages/theme/build-css.mjs:317`. So a kit *control* rendered on the marketing site does not keep `0.375rem` — it takes `0.25rem`, and `check-controls.mjs` does not catch it because the gate walks `packages/ui` while the override lives in the emitted stylesheet.

Under precedence the pack's single-radius law governs the app and the site layer governs `apps/web-vite`, which is defensible. What is not recorded anywhere is the decision that a kit control may change radius when it crosses into the site — it happens as a side effect of `--radius-card` and `--radius-sheet` being re-pointed on the same lines. Either the re-point is deliberate and belongs in `docs/site/tokens.md` next to the `moyoRadius` law, or `--radius-control` should be excluded from it.

Found by cross-check while writing `docs/design/art-direction.md` §2 C1, which records the four values `--radius-card` resolves to across root, `.dial-hot`, `.dial-cool` and `.moyo-site`.
---

## 10 · State of `docs/design/overhaul-v2/`

Eleven files. There are no numbered "phases" in that directory — it is organised as lettered **deliverables** (A–J, mapping to the overhaul prompt's §17.1 deliverables A–S), and phase language appears only as a *destination* for the work each deliverable produces (Phase-2 contract wiring, Phase-3 component builds).

| File | Deliverable | Status as written | Citation |
|---|---|---|---|
| `00-binding-decisions.md` | digest of pack 36/37/38/31/33/34/12 | no status line; defers to the pack | `docs/design/overhaul-v2/00-binding-decisions.md:4` |
| `A-repo-audit.md` | A · Repository Audit | **IN PROGRESS** — "sections land as audited" | `docs/design/overhaul-v2/A-repo-audit.md:8` |
| `B-deliverable-status.md` | §17.1 status + reconciliation | no status line; it *is* the status ledger | — |
| `C-orphans-dead-ends.md` | C · Orphan/dead-end report | **DONE (fresh)** per B | `docs/design/overhaul-v2/B-deliverable-status.md:14` |
| `D-screen-inventory.md` | D · Unified screen inventory | no status line; B lists deliverable B as PARTIAL | `docs/design/overhaul-v2/B-deliverable-status.md:13` |
| `E-tenant-role-band-matrix.md` | D/E · Tenant × role × band | **DONE (2026-09-01)** | `docs/design/overhaul-v2/E-tenant-role-band-matrix.md:8` |
| `F-journey-maps.md` | L · Journey maps | no status line; B lists L as PARTIAL | `docs/design/overhaul-v2/B-deliverable-status.md:21` |
| `G-navigation-maps.md` | G/H/I/J/K · Navigation maps | **Phase-1 deliverable** | `docs/design/overhaul-v2/G-navigation-maps.md:8` |
| `H-competitor-mobile-vs-web.md` | O · Competitor structural summary | no status line; **B still lists O as ABSENT — B is stale here, the file exists** | `docs/design/overhaul-v2/B-deliverable-status.md:24` |
| `I-token-system.md` | Q · Token system | no status line; B lists Q as PARTIAL, and the file itself is stale in two places (see below) | `docs/design/overhaul-v2/B-deliverable-status.md:26` |
| `J-component-plan.md` | R · Component plan | **Phase-1/2 deliverable, binding for Phase 3** | `docs/design/overhaul-v2/J-component-plan.md:8` |

All are on branch `overhaul/phase1-audit` per their own status lines. Nothing in the directory is marked COMPLETE; the two that carry an explicit completion word are E (**DONE**) and C (**DONE (fresh)**, asserted by B rather than by itself).

Deliverables `docs/design/overhaul-v2/B-deliverable-status.md` records as still missing: **O** (superseded — H exists) and **S · Implementation plan with phase gates: ABSENT** (`:28`). PARTIAL: B, D/E, F, I/J, N, Q, R.

Staleness inside the directory, worth knowing before citing it:

- `docs/design/overhaul-v2/I-token-system.md:10` calls `packages/theme/tokens.ts` "939 lines"; it is 1346 (`docs/design/reset/00-repo-baseline.md:16`).
- `docs/design/overhaul-v2/I-token-system.md:40` cites `accentRoles` at "tokens.ts:276"; the export is at `packages/theme/tokens.ts:537`.
- `docs/design/overhaul-v2/B-deliverable-status.md:22` counts 63 screen contracts; there are 64 (`find design/screens -name contract.md`, 2026-09-05).
- `docs/design/overhaul-v2/B-deliverable-status.md:46` says guardian has seven tab files; ADR-101 reconciled that to four.
- Two defects the directory treats as open are closed: the band-population defect (`docs/design/overhaul-v2/B-deliverable-status.md:56`) and the schedule-accent WCAG failure (`:51`). `docs/decisions/adr-107-learner-pane-ban-reaffirmed.md:38` still conditions any pane-ban lift on the band fix, so that condition is now satisfiable — the ban itself is unaffected.
