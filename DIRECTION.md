# DIRECTION: Moyo (marketing site and product apps)

<!--
The web-designer-pro direction brief for Moyo as a whole: apps/web-vite and the product apps that
share packages/theme. It codifies the direction the repo already has; every claim cites its file.
SOT: packages/theme/tokens.ts · docs/site/tokens.md · docs/design/art-direction.md
     docs/design/moyo-design-reset-v2-brief.md · docs/site/research.md · docs/site/copy-deck.md
SOT-KEYWORDS: direction brief web-designer-pro rut tokens layering voice signatures
-->

**Brief: self-authored from repo sources (2026-11-04).** No client brief was supplied. Tokens are
cited by name; line numbers elsewhere are as of 2026-11-04 and drift as files change.

## 1. Brief

**What Moyo is.** An AI tutoring platform for K-12. Learners work with one tutor, Natalie, who
speaks at their grade level and coaches instead of solving; guardians see what was learned;
tutoring businesses get an operations cloud. *Moyo* is Swahili for heart: "Learn it by heart"
(`docs/pack/33-moyo-learn-prd.md:12-14`).

**Who it is for.**
- Site: the parent or guardian first, then tutoring businesses and schools or districts
  (`docs/site/research.md` §2.1-§2.3). The parent's real decision is "is handing my child to AI a
  good parenting decision?" (§2.1).
- Product: seven role doors (learner, guardian, tutor, teacher, org, school, district) and an
  admin back office (`accentRoles`, `packages/theme/tokens.ts`). Learners sit in age bands with
  their own touch targets (`targets`, `tokens.ts`).

**The one job of the site.** Land one message in the first screen: Moyo is a tutor with a heart,
and it teaches instead of answering (`docs/site/research.md` §4.1; `site.hero.body` in
`docs/site/copy-deck.md` §2). The visitor's job: "In four seconds, tell me what this is and whether
it's for my kid." The action is `Start learning` (`DOOR_PRIMARY`,
`apps/web-vite/src/components/chapters/hero.tsx:72`).

**The one job of the app.** Get a child unstuck on the work in front of them through a guided
session, and show the guardian what was learned (`docs/site/research.md` §2.1 jobs P1-P3). The
first release runs from cold launch to the learner's Today (`docs/38-front-door-and-flow.md` §0).

## 2. Category default refused

| Category default | Who, per the repo | What Moyo does | Source |
| --- | --- | --- | --- |
| Flat vector cartoon art; "a child cannot tell them apart in a screenshot" | Duolingo/ABC, Khan, ClassDojo, Kit, GoHenry, Finch | Real photography on the site; a cut-paper and real-material register for the app, gated by ADR-115 | `docs/design/moyo-design-reset-v2-brief.md:63`; `apps/web-vite/src/components/photography.ts`; `docs/design/art-direction.md` §1 |
| Gems and streak-style rewards | Khan Academy | No engagement-pressure mechanics aimed at minors; competence-based reveals | `moyo-design-reset-v2-brief.md:38`, `:47`; `CONTRIBUTING.md:54` |
| Answer-vendor positioning ("camera-solvers") | doc 33 §4's answer-vendor camp | The tutor declines and teaches the next step; the refusal is in the hero body | `docs/site/research.md:133`, `:177` |
| Price near the child | Not attributed | No paywall, price or upgrade prompt on a learner surface | `CONTRIBUTING.md:53` |
| Adult-dashboard look on child surfaces | IXL, ALEKS, DreamBox, Carnegie MATHia, as a group | Hot dial for learner and family surfaces | `docs/design/tutor-session-research.md:57-60`; `dial`, `tokens.ts` |
| Blur, glass, gradient, neon | Not attributed | No token exists for any of them | `docs/site/tokens.md:46` |

- **Khan Academy.** Supported traits: flat vector cartoon art (`moyo-design-reset-v2-brief.md:63`);
  gems and classroom rewards, a Learner Queue, a Path/List view (`:38`). Moyo keeps the path idea
  as `MissionPath` with art nodes (`:133`) and refuses the rewards. Khanmigo's $4 price is answered
  in copy (`docs/site/research.md:136`).
- **IXL.** Researched for information architecture only: web-parity app, dashboard landing, a report
  drill-down ladder (`docs/design/overhaul-v2/H-competitor-mobile-vs-web.md:24-30`, `:148`). Visual
  design not researched in-repo beyond the group row above.
- **Outschool.** Researched for app tabs and the parent/learner profile split only
  (`H-competitor-mobile-vs-web.md:85-87`). Visual design not researched in-repo.

## 3. Rut items used

Checked against `tooling/web-designer-pro/references/finish.md:297-312` and the slop faces
(`references/slop.md:17-58`, `:321`).

**3.1 Coral accent** (finish.md §7 "red or red-orange accent", `:302`). Tokens: `siteColors.moyoHeart`
and its alias `moyoEarth` on the site; `palette['moyo-coral']`, `surface-accent` ("the coral hairline
strip") and `tenant-accent` in the product (`tokens.ts`). Reason: coral is one of
the four inks in the Moyo mark (`packages/ui/logo-fill.ts`, recorded at `tokens.ts`), and it
carries the name: "Moyo means heart. The one colour allowed to shout" (`docs/site/tokens.md:70`).
Limit: one heart moment per page (`docs/site/tokens.md:299`); the hero spends it on the learner door
alone (`hero.tsx:20-24`, `DOOR_LEARNER` at `:80`). In the product the action colour is `moyo-mango`
(`action-primary`) and selection is lagoon teal (`highlighter`) (`tokens.ts`).

**3.2 Neubrutalism: hard offset shadows, thick ink borders** (family E's "hard offset shadows",
`references/directions.md:114-122`). Tokens: `shadows.card` / `raised` / `overlay`,
`dial.hot.shadow`, `dial.cool.shadow`; on the site `moyoShadowOffset[1-4]` and `moyoBorderW.hair` /
`rule` / `slab`. Zero blur everywhere (`docs/site/tokens.md:105`). Reasons from the repo:
- The pack names the app's language "Neubrutalism × Swiss ('Schoolhouse')": raw neubrutalism is
  "perfect for the learner's world and fatal at ops density", hence the Cool dial
  (`docs/pack/02-adaptive-screens-design-spec.md:158-161`). Mozilla is the cited precedent for one
  system that speaks to adults and children (`:254`).
- Cut-paper shapes with hard shadows are neubrutalist objects, so the planned art register and the
  structure agree (`moyo-design-reset-v2-brief.md:63`).
- The rule that keeps it from turning into noise: borders are structure, never emphasis; hierarchy
  comes from size, weight and space (`CONTRIBUTING.md:35`; `docs/pack/08-visual-hierarchy-spacing-spec.md:17`).

**3.3 Split hero, open for round 1** (finish.md §7 `:305`; the scan warns on it, `:194`). From `lg`
up the headline takes `lg:w-8/12` and the photo plate `lg:w-4/12` in one row (`hero.tsx:103-121`).
The repo's reason is the MasterClass notch: the plate sits in the gap the short last line leaves
(`:96-102`). The annotation straddles the plate's bottom edge (`:241`), but nothing crosses between
headline and photo, and below `lg` the two stack (`:100-101`), which finish.md §2 "Layering on a
phone" asks against. Round 1 rules on whether this counts.

**3.4 Overlap with slop face 1, "The Paper Edition"** (`slop.md:24`). Shared: warm paper ground
(`moyoPaper`), near-black ink (`moyoInk`), a red-orange accent, and numbered cell labels in the Desk
(`CellLabel` index "01" to "07", `desk.tsx:131-258`). Not shared: pills (`moyoRadius` has `square` and a 4px `card` only),
soft long shadows (zero blur), a photograph-free page. Rubric line 3 allows one face feature
(`references/critique.md` §The rubric); this is the line most at risk.

## 4. Tokens

All values live in `packages/theme/tokens.ts`; `docs/site/tokens.md` documents the site layer.
Raw values are banned (`CONTRIBUTING.md:32`).

**Colour roles, site (light only, by decision).** One ground; `.moyo-site` pins `color-scheme:
light` so a dark-mode machine cannot invert it (`tokens.ts`).

| Role | Token |
| --- | --- |
| Ground / raised card / recessed band | `moyoPaper` / `moyoPaperRaised` / `moyoPaperSunken` |
| Type / secondary type / rules and offset shadows | `moyoInk` / `moyoInkMuted` / `moyoOutline` |
| Links, primary action, annotation (logo plum) | `moyoPrimary`, `moyoSecondary`, `moyoMarkDeep` |
| The one shout (logo coral) | `moyoHeart`, ink on it via `moyoOnHeart` |
| Block fill, never type (logo orange) | `moyoSun` |
| The mark's teal, fill or large type only | `moyoMark`, `moyoLeaf` |

**Colour roles, product.** Dark is "the brand at night": same hue, another step; neutral reading
ground, plum chrome (`tokens.ts`).

| Role | Token | Light | Dark |
| --- | --- | --- | --- |
| Reading ground | `surface` | `ink[50]` | `ink[900]` |
| Type / muted | `text` / `text-muted` | `ink[950]` / `ink[600]` | `ink[100]` / `ink[300]` |
| Structural line | `border` | `ink[950]` | `ink[300]` |
| Primary fill | `primary` | `sun[300]` | `sun[300]` |
| Signature action (Snap) | `action-primary` | `moyo-mango` | `moyo-mango` |
| Selection marker | `highlighter` | `lagoon[400]` | `lagoon[500]` |
| Chrome | `surface-header` / `surface-footer` | `plum[100]` / `plum[200]` | `plum[200]` / `plum[300]` |
| Accent | `accent` | `ember[500]` | `ember[400]` |
| Marks on paper | `ballpoint`, `redpen`, `grade` | 600 steps | lighter steps |
| Door identity | `role-accent`, `role-accent-underlay` | same in both | same in both |

**Type families.**
- `siteFontFamilies.moyoDisplay`, Clash Display: hero and chapter titles only (`docs/site/tokens.md` §5.2).
- `siteFontFamilies.moyoText`, General Sans: everything read or operated. `apps/web-vite/src/fonts.css:26`
  loads only these two, "one display voice and one reading voice".
- `fontFamilies.display`, Archivo Black: "shouts the headlines" (`tokens.ts`).
- `fontFamilies.sans`, Space Grotesk: "does the work" (`tokens.ts`). It is on the skill's
  default-face list (`finish.md:334`); the repo gives no further reason.
- `fontFamilies.mono`, Chivo Mono: Archivo Black's foundry, so it reads as family; tabular data and
  the `moyo · n. heart` device (`tokens.ts`).

**Type scale.** Site: `siteTypeScale`, `site-hero` to `site-note`, all `clamp()`, one `site-hero` per
page. At the widest clamp `site-hero` (7rem) over `site-label` (0.875rem) is 8:1; rubric line 5 asks
for near 20:1. Product: `typeScale` (`display-sm` to `display-2xl`) and `uiRamp` per dial.

**Spacing.** `spacingTiers` (`inset-hair`, `inset-field`, `inset-tight`, `inset`, `inset-roomy`,
`element`, `stack`, `group`, `section`, `brand-clear`), each with cool and hot values (`tokens.ts`;
`CONTRIBUTING.md:34`). Widths: `contentWidths` (`content-prose` is the measure). Targets: `targets`.

**Radius family.** Site: `moyoRadius.square` (default) and `moyoRadius.card`, two entries because "a
third would turn a law into a scale" (`tokens.ts`). Product: one control radius,
`radius.control`, gated by `tooling/check-controls.mjs` (`tokens.ts`), plus `dial.hot.radius`
and `dial.cool.radius`. `docs/design/art-direction.md` §2 conflict C1: `--radius-card` resolves to four
values across scopes; unresolved.

**Motion.**
- `motion.duration` (`fast`, `base`, `slow`, `slower`) and `motion.easing` (`standard`, `emphasized`,
  `exit`) for CSS transitions (`tokens.ts`).
- `motion.curve` (`entrance`, `travel`, `exit`), Kinetrell ease names compiled to GSAP on web and
  Reanimated on native; `motion.spring.settle` (damping, stiffness, mass, and a `css` `linear()` twin).
  Added by PR-M01 (`@acme/motion`, docs/motion/README.md).
- `dial.hot.duration` and `dial.cool.duration`.
- `siteMotion`: one personality per object (`thunk`, `settle`, `open`, `peel`, `draw`, `cross-out`,
  `snap`, `page-turn`, `compress`, `release`, `lock-in`, `pulse`) with GSAP eases, overshoot, travel,
  rotate and scale. An element with no personality does not animate (`tokens.ts`).
- Reduced motion: markup authors the end state, and `compose()` writes it (`docs/site/motion-matrix.md` §3).

**Texture.** `moyoTexture.grain`, 2-4%. No marketing surface consumes it yet (`docs/site/tokens.md`
Priority actions, #3).

**Source drift to fix before round 1.** `docs/site/tokens.md` (2026-08-28) still lists a cobalt
`moyoPrimary`, a `#C7350F` `moyoHeart`, four faces and a `site-hero` of `clamp(4rem, 12vw, 12.5rem)`;
`tokens.ts` has logo plum, logo coral, two loaded faces and `clamp(2.75rem, 7.5vw, 7rem)`.
`siteFontFamilies` still declares `moyoSerif` and `moyoHand` while its comment says "two voices only".
The app's style name is contested ("Neubrutalism × Swiss" in the pack, "Neubrutalism × Tactile Learning
Modernism" in the reset brief), and ADR-115, which would settle it, is PROPOSED
(`docs/design/art-direction.md:94-97`; `docs/decisions/adr-115-art-direction-authority.md:3`).

## 5. Layering plan

**First screen, marketing hero** (`apps/web-vite/src/components/chapters/hero.tsx`):
1. **Ground and type.** `bg-moyo-paper`; eyebrow in `text-site-label text-moyo-secondary`; the headline
   "Learning has a heart." in `font-moyo-display text-site-hero`, uppercase as a treatment (`:86-120`).
2. **The framed photograph.** `hero-kitchen-table` (a child at a kitchen table, a parent looking on;
   `photography.ts:59-63`), full bleed in a `border-moyo-slab rounded-moyo-card` frame with a
   `shadow-moyo-3` hard offset, bottom-aligned into the headline's notch (`:203-214`). It is the LCP
   image and the site's only eager photograph (`:199-202`).
3. **The hand layer.** The note "fractions, Tuesday" and a drawn arrow in `moyoSecondary` straddle the
   plate's bottom edge: arrow inside over the photo, note outside on paper where it stays legible
   (`:216-274`). This is the element that crosses another.

The move: the headline splits and lands by character (`splitReveal` with `thunk`), then the arrow
draws and the three doors thunk in (`buildHeroScene`, `:296-316`). The doors are pressable slabs whose
offset shrinks on press (`.moyo-pressable`, `apps/web-vite/src/globals.css:69-74`).

**The move per section**, in the order `apps/web-vite/src/routes/index.tsx` renders:
- **Desk:** an uneven bento: one loud cell (the photographed homework), one silent cell (the mastery
  numeral, with the page's one `moyoSun` swipe under it), five quiet cells (`desk.tsx:1-9`, `:33-40`).
- **World:** the globe whole in its own reserved height, node cards in real gutters; the only depth is
  one slow `parallax-far` drift on the headline block (`world.tsx` header).
- **Tutor Room:** a flooded band with the Natalie plate straddling its lower edge (the Mural
  reference); the plate stays an outlined placeholder until a sanctioned render exists
  (`tutor-room.tsx` header).

The route's header describes nine chapters; it mounts four. `conversation.tsx`, `parents.tsx`,
`schools.tsx` and `start.tsx` exist in `components/chapters/` and are not mounted on `/`.

## 6. Voice

Warm, plain, specific: Moyo talks like a good teacher at pickup, clear about what happens next, never
salesy, never cute at the parent's expense (`docs/38-front-door-and-flow.md:496`, named as the
governing voice in `docs/site/copy-deck.md:5`).

## Signatures

The four motion signatures from PR-M03 of the desktop PR pack. Each is
storyboarded here before code (web-designer-pro `references/motion.md` §3).
Timings name `@acme/motion` presets, never milliseconds; the numbers in
brackets are what the presets resolve to today (`docs/motion/README.md`).
Disposition per `product-decisions`: BUILD when the surface and its data exist,
STRIKE when the surface's precondition is missing, DEFER when a decision blocks it.

### S1. Session-report movement bar (BUILD)

- **Concept.** Doc 34 keeps movement and position as two separate axes
  (`docs/pack/34-session-summary-reports.md`, "Movement vs Position"). The bar
  shows movement: how far this session took the skill. Position (where that sits
  against grade expectations) is a sentence, and it arrives only after the
  movement has been shown, so the two are never read as one claim.
- **Where.** Block 4 of the session report, `ReportBody` in
  `packages/app/features/summary/report-blocks.tsx`: guardian report, teacher
  share link (`apps/web` `/share/report/[token]`) and, later, the desktop report
  window. Data: `MasteryMovement.beforeP`, `.afterP`, `.positionCopy`.
- **Who and how often.** A guardian reads a report once, after a session; a
  teacher opens a share link a few times a week. Seen rarely, so it may take a
  cinematic beat, once per mount. It never loops.
- **Trigger.** The block mounts with data.
- **Frames.**
  1. `start`: the track shows the `before` fill solid; the gain segment
     (`before` to `after`) is present at zero width; the position line is
     invisible and 6 px low.
  2. `filled` (after `cinematic` [500 ms], ease `cubic.out`): the gain
     segment has grown from the before edge to the after edge, the way a dial
     needle comes to rest. Nothing else has moved.
  3. `settled` (after `entrance` [300 ms] more, ease `cubic.out`): the position
     line has faded in and risen 6 px into place.
- **Reduced motion.** Frame 3 on first paint: full bar, position line in place.
  `reducedMotionDestination` 'finish'.
- **Accessibility.** The meter is a `progressbar` with the after value from the
  first render, so a screen reader announces the end state; the motion is
  `aria-hidden` decoration on the gain segment. Focus is never inside it.
- **Not.** No count-up number, no colour flash, no confetti: movement is shown,
  not celebrated with pressure (CONTRIBUTING §Children's surfaces).

### S2. Front-door reveal (DEFER)

- **Concept.** The open-book M of the mark (`packages/ui/MoyoMark.tsx`; path
  data in `apps/mobile/components/splash/moyo-paths.ts`) folds open into the
  welcome's two panes.
- **Blocker.** The welcome has no two panes. `PublicEntryContent`
  (`packages/app/features/onboarding/public-entry-content.tsx`) is one column
  with the wordmark, and the web-vite hero renders no mark at all. The two-pane
  welcome is a front-door layout decision governed by doc 38, and the pack
  requires three explorations and a scored critique for this piece. Until that
  layout exists there is nothing for the M to open into.
- **Storyboard to build against.** Trigger: first paint of the welcome after the
  splash. Frames: the mark centred (`start`); the two page paths rotate apart on
  the spine (`open`, `cinematic`); the panes slide out from the page edges
  (`panes`, `transition`, overlapping the open by a third). Reduced motion: the
  two panes, mark small in the left pane.

### S3. Plan dial on the paywall (STRIKE, 2026-11-04)

- **Concept.** Plan cards fan from a stack as the learner count changes (doc 38
  PW-01/PW-05).
- **Precondition missing.** There is no learner count and no per-child price.
  `PaywallContent` maps two flat family plans (`paywall.data.ts`); no web
  billing route exists. A fan that reacts to a control that does not exist is a
  dead control.
- **Returns when** per-child pricing ships with its count control.

### S4. Lesson-card tilt (STRIKE, 2026-11-04)

- **Concept.** The homework photo card tilts toward the pointer or finger with
  a lit edge and settles on release (Tactile Learning).
- **Precondition missing.** No homework photo card exists on learner home
  (`learner-hub-content.tsx` has an icon tile) or in the tutor queue
  (`draft-queue-content.tsx` is a table without photos).
- **Returns when** a photo card ships on either surface. The tutor sees the queue
  many times a day, so when it returns the tilt is clamped small and pauses
  off-screen.
