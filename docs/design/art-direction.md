# Art direction — "Made at the kitchen table"

<!--
The app's art direction. It extends the marketing site's design language
(docs/site/tokens.md) into the product; it does not open a third visual system.
Every value it names is a token that already exists in packages/theme/tokens.ts,
or is recorded here as an open question. Working name from
docs/design/moyo-design-reset-v2-brief.md:60 — an art direction, not a rename.

SOT: packages/theme/tokens.ts · docs/site/tokens.md ·
     packages/art/registry.ts · packages/art/registry.provenance.ts ·
     docs/design/moyo-design-reset-v2-brief.md §3 and §9 ·
     docs/pack/08-visual-hierarchy-spacing-spec.md §6 ·
     docs/pack/37-onboarding-dual-pane.md §2 · prompts/ROSTER.md
SOT-KEYWORDS: art direction plates cut-paper scene subject object figure natalie
              photography casting band grain stroke light palette do-dont register
-->

Status: draft, unapproved · Date: 2026-09-05 · Branch: `design/reset-v2`

## §1 What this document gates

No asset is produced, commissioned, generated, or added to
`packages/art/registry.ts` before the plate that governs its class is approved
here. That order comes from `docs/design/moyo-design-reset-v2-brief.md:169`
("Approved before asset #1") and from rule 4 at `:74`, which puts the one
illustration system in this file "with do/don't plates before any asset is
produced".

**The compiler holds the line, not review attention.**
`packages/art/registry.assert.ts:45-47` asserts that `SceneArtName`,
`ObjectArtName` and `FigureArtName` all resolve to `never`. While those
assertions stand, `Scene`, `SubjectArt` and any Natalie still fail to compile at
every call site — a missing asset is a type error, never a fallback emoji or a
grey box (`packages/art/registry.ts:20-26`). Editing that file is the act that
records a plate as approved, so it may not be edited before the approval exists.

The six photographs already in the register (`packages/art/registry.ts:133-176`)
are not exempt from this document. They entered under the site's casting law and
are cleared for `adult` only; mounting any of them on an app surface is a new
decision that §6 and §9 govern.

### Who approves

Two seats, both from `prompts/ROSTER.md`:

| Seat | Line | What it blocks a plate on |
| --- | --- | --- |
| Design system & brand | `prompts/ROSTER.md:13` | A second control radius, a blurred shadow, a fourth typeface, art that does no pedagogical job. It also owns this file and `packages/art/registry.ts` outright. |
| Accessibility | `prompts/ROSTER.md:17` | Any AA failure including text over artwork, a missing contrast pair, a missing reduced-motion path. |

`prompts/ROSTER.md:28` makes both mandatory: the design-system and accessibility
seats review every visual deliverable, and every plate here is one. Other seats
review what they own — children's UX research (`:14`) on the per-band register in
§7, learning science (`:15`) wherever a plate claims a pedagogical job, native
rendering (`:19`) on Natalie's 3D-off still.

An approval is recorded the way `prompts/ROSTER.md:26` requires: in the PR, citing
the rule. A seat that has not written down which plate it read has not approved
it, and `:25` reverts work that skipped its seat rather than patching it.

### What a plate is

A plate is one numbered rule in §4, §5, §6, §7 or §8 that a reviewer can fail a
specific file against. It names the art class it governs, the observable property
it constrains, and the failure condition. A rule that cannot be failed is
guidance, and guidance does not gate assets.

### Scope

App surfaces only — learner, guardian, tutor, teacher, school. Marketing
chapters in `apps/web-vite` keep `docs/site/tokens.md` as their authority; where
the two documents disagree about a shared token, §2 records the disagreement
rather than resolving it locally.

### DEFER · Two pack clauses outrank this document

`docs/design/reset/02-binding-constraints.md` §9 records two conflicts that sit
above this file in the precedence order at `prompts/ROSTER.md:27`
(`docs/pack/*` first, the reset brief fourth). Neither is settled here, and
neither may be settled by writing a plate that assumes its own conclusion.

**C-13 · The ink-line clause bars a cut-paper register on learner surfaces.**
`docs/pack/08-visual-hierarchy-spacing-spec.md:138` bans photography on child
learning surfaces and constrains what replaces it: "illustration there is
ink-line + flat token fills only". The `scene`, `object` and `figure` classes
are a cut-paper register, which is neither photography nor, read literally,
ink-line plus flat fills. `docs/design/reset/02-binding-constraints.md:687-691`
gives it to doc 08 — the photography ban does not bite, the positive constraint
does.

**C-9 · The style name has no pack support for the app.**
`docs/pack/02-adaptive-screens-design-spec.md:158` names the app's language
"Neubrutalism × Swiss ('Schoolhouse')". The 60/25/15 Tactile Learning ratio is
`docs/site/tokens.md:37`, and `docs/design/overhaul-v2/I-token-system.md:67`
scopes the site layer to `apps/web-vite` and out of app scope. The brief's
"Neubrutalism × Tactile Learning Modernism" matches neither and imports a
marketing register into the product
(`docs/design/reset/02-binding-constraints.md:655-659`).

**C-19 · Addendum A's "Never means" column bars both the material and the motion.**
`docs/pack/02-adaptive-screens-design-spec.md` Addendum A (opens at `:248`)
carries a two-column table at `:263`, and two of its "Never means" rows land
directly on this direction:

| Sleek means | Never means | Line |
| --- | --- | --- |
| tabular-mono data everywhere numbers live | decorative 3D, clay, **skeuomorph textures** | `:267` |
| motion ≤200ms, state-communicating (press physics, settle) | **ambient/parallax motion on child surfaces** | `:268` |

Paper grain and cut paper are skeuomorph textures — the whole point of the
material is that it imitates a physical one. And the brief's scene-depth
parallax on learner hero art
(`docs/design/moyo-design-reset-v2-brief.md:68`), along with `Scene`'s parallax
behaviour (`:128`), is ambient parallax motion on a child surface. Doc 02 is
rank 1 of the precedence order, so both clauses win today.

**Status: deferred, not struck and not resolved.** All four are decisions about
which document governs app art direction, and that decision belongs in an ADR,
not in a design file that would be the beneficiary of its own ruling.

**adr-115 — the art direction's binding authority** is the ADR that unblocks
this, extending the `adr-101` … `adr-114` series
(`docs/design/reset/00-repo-baseline.md:20`). To unblock, it must supersede
**by name**:

1. `docs/pack/08-visual-hierarchy-spacing-spec.md` §6's clause "illustration
   there is ink-line + flat token fills only", stating what replaces it for
   child learning surfaces. The rest of §6 stays binding, including the ink
   frame and mandatory alt at `:139`.
2. `docs/pack/02-adaptive-screens-design-spec.md` §5's style name for app
   surfaces, stating which name governs the app and which stays web-vite-scoped.
3. `docs/pack/02-adaptive-screens-design-spec.md:267`'s "skeuomorph textures"
   entry, stating whether paper grain and cut paper are exempt from it or
   whether the direction drops both.
4. `docs/pack/02-adaptive-screens-design-spec.md:268`'s "ambient/parallax motion
   on child surfaces" entry, if scene-depth parallax is to exist on any learner
   surface at all.

Items 3 and 4 are separable from items 1 and 2: an ADR could supersede the
ink-line clause and still leave grain and parallax banned. Until each is named,
that clause holds.

Anything less leaves doc 08 and doc 02 winning on precedence. Renaming the
language in a brief does not supersede a pack clause, and neither does a plate
in this file.

**No asset can land while this is open, and that is the correct state.**
`packages/art/registry.assert.ts:45-47` holds `SceneArtName`, `ObjectArtName`
and `FigureArtName` at `never`, so `Scene`, `SubjectArt` and any Natalie still
fail to compile at every call site. The compiler is already enforcing the defer.
`docs/design/reset/02-binding-constraints.md:699-703` (C-15) confirms no binding
document conflicts with that gating order, and two support it.

The sections below are written to survive either resolution. §8 marks each plate
that depends on C-13 going the cut-paper way; the rest hold under both.

## §2 Inheritance from the site

The site layer is the parent system. `docs/design/moyo-design-reset-v2-brief.md:27`
sets the relationship: the app inherits the site's language rather than inventing
a third one, and `docs/site/tokens.md:19-21` already refuses to be a second
design system itself.

### What carries over

| Inherited | Defined at | What it binds in artwork |
| --- | --- | --- |
| 60% Editorial Neubrutalism · 25% Tactile Learning · 15% Spatial Magic | `docs/site/tokens.md:37` | Art is the 25%. It never takes over the structure or the spatial layer. |
| Paper ground, never white | `moyoPaper` `#F7F1E3`, `packages/theme/tokens.ts:1035` | An asset is drawn as printed matter. See conflict C5 for which paper. |
| Ink is warm near-black, never `#000` inside the drawing | `moyoInk` `#171310`, `packages/theme/tokens.ts:1041`; `docs/site/tokens.md:60` | Every stroke, outline and cast shadow in an asset uses this value, not pure black. |
| Zero blur, always | `moyoShadowOffset`, `packages/theme/tokens.ts:1111-1116`; `shadows`, `:749-753`; `docs/site/tokens.md:105` | A drawn shadow inside an asset is a hard offset shape. No token exists for a blurred one, and §8 fails an asset that paints one. |
| Border-width ladder 2 / 3 / 4 | `moyoBorderW`, `packages/theme/tokens.ts:1126-1130` | The stroke ladder §4 draws from. 2px is the floor below which a frame stops reading as drawn. |
| Grain at `0.03`, 2–4% the whole range | `moyoTexture`, `packages/theme/tokens.ts:1145-1147`; `docs/site/tokens.md:103` | Grain belongs to the surface under the art, never baked into the asset. |
| Fill-only discipline | `SITE_FILL_ONLY`, `tooling/check-contrast.mjs:253`, enforced at `:415-421` | A colour that cannot carry type inside chrome cannot carry type inside artwork either. |
| African influence is structural, never a motif | `docs/site/tokens.md:41-44` | Rhythm lives in the repetition of rules, bands and offsets. A reviewer who can point at a decoration and name it "the African part" fails the asset. |
| Highlighter marks a surface, ballpoint marks the paper | `docs/site/tokens.md:69`; `highlighter` `packages/theme/tokens.ts:289`, `ballpoint` `:300` | The same split governs artwork: a colour is either a shape a child reads through or a line a child reads along. |

### What the app adds

| Addition | Defined at | Why the site has no equivalent |
| --- | --- | --- |
| Four art classes behind one typed register | `ArtClass`, `packages/art/registry.ts:42` | The site ships one class, photography. |
| Band clearance per asset | `Band`, `packages/art/registry.ts:49`; `PhotoArtEntry.bands`, `:76-85` | No learner surface renders on the site (`docs/site/tokens.md:271-274`). |
| The Hot / Cool dial | `dial`, `packages/theme/tokens.ts:973-988`; emitted at `packages/theme/theme.css:520` and `:561` | The site has one temperature. The app renders a child's screen and an operations table from one palette. |
| Dark mode | `surface`/`text`/`border`, `packages/theme/tokens.ts:196-254` | Site colours are flat hex with one ground, deliberately (`packages/theme/tokens.ts:1007-1012`). App art has to sit on `#FFFDF7` and on `ink[900]` `#171614`. |
| Native output | `theme-native.css`, `packages/theme/build-css.mjs:569` | The site layer is web-only by design (`packages/theme/build-css.mjs:153-159`), so no `moyo*` variable resolves on device. See C6. |
| Age-band touch targets | `targets`, `packages/theme/tokens.ts:864-870` | Governs how large an interactive object drawn inside a scene has to be — 72px on K–2, 44px on adult. |
| The 7:1 learner bar | `docs/site/tokens.md:271-274` records it as out of scope there | Every learner surface in the app is in scope, including text set over artwork. |
| Art must do a pedagogical job | `docs/design/moyo-design-reset-v2-brief.md:71` | Marketing art argues; product art teaches. |

### Conflicts found

Each of these is a real disagreement between two installed sources. This document
records them and picks neither. Resolution follows `prompts/ROSTER.md:27` — the
precedence order first, an ADR if that does not settle it.

**C1 · `--radius-card` carries four values and `--radius-control` carries two.**
The app declares one control radius, `radius.control` `0.375rem`
(`packages/theme/tokens.ts:738`), and `tooling/check-controls.mjs` gates it —
the comment at `:734-737` states the rule and the gate exists to enforce it.
`docs/site/tokens.md:101-102` declares a different law for the same concern:
`moyoRadius.square` `0rem` is the default, `moyoRadius.card` `0.25rem` is the one
soft step, and "a third entry would turn a law into a scale"
(`packages/theme/tokens.ts:1136-1139`). Both hold in their own scope, and the
emitted stylesheet shows the scopes disagreeing:

| Scope | `--radius-control` | `--radius-card` |
| --- | --- | --- |
| root | `0.375rem` (`theme.css:175`) | `0.625rem` (`theme.css:180`) |
| `.dial-hot` | unchanged | `0.875rem` via `--radius-hot` (`theme.css:520`, `:194`) |
| `.dial-cool` | unchanged | `0.5rem` via `--radius-cool` (`theme.css:561`, `:198`) |
| `.moyo-site` | `0.25rem` via `--radius-moyo-card` (`theme.css:719`) | `0.25rem` (`theme.css:717`) |

So the answer to whether this is a real cross-product conflict is yes, and it is
sharper than a name collision: `.moyo-site` re-points `--radius-control` itself
(`theme.css:719`), which means the single control radius is single only outside
that scope, and `prompts/ROSTER.md:13` names "a second control radius" as a
merge blocker for the seat that owns this file.

`docs/design/reset/02-binding-constraints.md:719-725` (C-18) reaches the opposite
verdict — "not a collision" — on the premise that "`--radius-control` is not in
that re-point list". The emitted stylesheet contradicts that premise:
`packages/theme/theme.css:719` sits inside the `.moyo-site` block opened at
`:687` and re-points `--radius-control`, and the generator emits it at
`packages/theme/build-css.mjs:317` inside the scope opened at `:285`. C-18's
wider point stands — one radius for *controls* was always the rule, not one
radius for everything — but the specific claim about the re-point list needs
correcting in that digest.

The consequence for art is the same whichever way it resolves. **No corner radius
is ever baked into an asset.** Every asset ships with square corners and a
transparent bleed; the mount applies the radius its scope resolves to. Doc 08
§6's frame spec — "every in-product photo sits in an ink frame — `border-2
border-strong`, `radius-card`, `shadow-card`"
(`docs/pack/08-visual-hierarchy-spacing-spec.md:139`) — describes the frame the
component draws, never a shape drawn into the file.

**C2 · The site palette in `docs/site/tokens.md` no longer matches `siteColors`.**

| Token | `docs/site/tokens.md` | `packages/theme/tokens.ts` |
| --- | --- | --- |
| `moyoPrimary` | `#1C3FBF` cobalt (`:68`) | `#3C2357` logo plum (`:1055`) |
| `moyoSecondary` | `#6E4A00`, "the sun hue at mark strength" (`:69`) | `#3C2357` — the same value as `moyoPrimary` (`:1057`) |
| `moyoHeart` | `#C7350F` (`:70`) | `#E55545` (`:1059`) |
| `moyoSun` | `#F2B01E` (`:71`) | `#F4A629` (`:1061`) |
| `moyoEarth` | `#9A4526` clay (`:72`) | `#E55545` (`:1063`) |
| `moyoLeaf` | `#286641` (`:73`) | `#0A9299` teal (`:1065`) |
| `moyoOnHeart` / `moyoOnEarth` / `moyoOnLeaf` | `#F7F1E3` paper (`:84`, `:86`, `:87`) | `#171310` ink (`:1094`, `:1096`, `:1097`) |

The rule this document was asked to inherit — `moyoSecondary` as the distinct
mark-strength colour for eyebrows and annotation rules, split from `moyoSun` the
block — has no distinct token behind it in code. `moyoSecondary`, `moyoPrimary`
and `moyoMarkDeep` (`:1088`) are all `#3C2357`. §5 names art colour against the
installed values and flags the gap.

**C3 · The doc's contrast table is measured against C2's superseded values.**
`docs/site/tokens.md:242` records `moyoHeart` on `moyoPaper` at 4.73:1 and marks
it PASS at the 4.5 body bar. `#E55545` on `#F7F1E3` measures **3.26:1**. The
build stays green because `tooling/check-contrast.mjs:204-205` declares the pair
at 3:1 as a large-or-display mark, so the gate and the documentation now say
different things about the same pair. `docs/site/tokens.md:265` records
`moyoSun` at 1.69:1 on paper; `#F4A629` measures **1.80:1**, far under any bar,
so the fill-only rule is unaffected. Ratios computed as WCAG 2.1 relative
luminance in sRGB from the installed hex values.

Checked before treating this as an AA defect: it is not one. Every use of
`moyoHeart` in `apps/web-vite/src` is a fill paired with its own foreground —
`bg-moyo-heart text-moyo-on-heart` at `components/chapters/hero.tsx:80` and
`chapters/schools.tsx:145`, an SVG `fill` at `globe/node-layer.tsx:191`, a rule
at `routes/motion-lab.tsx:217`. None sets it as body or caption text, which is
what `check-contrast.mjs:202-203` says in the comment above the pair. The gate
is right and the documentation is stale. Fix the table in
`docs/site/tokens.md`, not the gate.

**C4 · The five hues are four values.** `moyoEarth` equals `moyoHeart`
(`#E55545`) and `moyoLeaf` equals `moyoMark` (`#0A9299`), so the site's
six-row hue table resolves to four distinct chromatic values: `#3C2357`,
`#E55545`, `#F4A629`, `#0A9299`. An asset palette built from the doc's row names
would ship two pairs of duplicates.

**C5 · Two papers.** The site ground is `moyoPaper` `#F7F1E3`
(`packages/theme/tokens.ts:1035`); the app ground is `surface`, `ink[50]`
`#FFFDF7` light and `ink[900]` `#171614` dark (`:196`). The two light grounds sit
1.11:1 apart and differ in warmth, and the dark one inverts. An asset with a
baked-in paper ground shows a seam on whichever surface it was not drawn for, and
shows a bright rectangle in dark mode. **Assets ship on a transparent ground; the
surface supplies the paper.**

**C6 · Grain does not exist on device.** `--moyo-grain-opacity` is emitted only
into `theme.css` (`packages/theme/build-css.mjs:223`, inside the web-only site
block documented at `:153-159`), and `docs/site/tokens.md:343` records that the
surface consuming it has not been built even on the web. The app's hero surfaces
are native. §5 carries this as an open question rather than inventing a value.

## §3 The four art classes

`ArtClass` is `'photo' | 'scene' | 'object' | 'figure'`
(`packages/art/registry.ts:42`). The class drives which component may mount an
asset, and the narrowed name types at `:186-193` make a wrong mount a compile
error rather than a wrong picture. The four names below are those four names;
this document adds no fifth class and renames none of them.

### `photo` — a photograph of adults at work

**For:** guardian, tutor, teacher and school surfaces, and onboarding. The
Status-hero archetype names real photography as its art class
(`docs/design/moyo-design-reset-v2-brief.md:115`).

**Bands:** `['adult']`, and the tuple does not widen
(`packages/art/registry.ts:76-85`). `packages/art/registry.assert.ts:51-53`
turns a widened tuple into a typecheck failure, so the casting law is held by
the compiler.

**Banned from:** child learning surfaces outright
(`docs/pack/08-visual-hierarchy-spacing-spec.md:138`). Decorative stock competes
with the one-task rule and with Natalie's presence, and illustration on those
surfaces is ink-line plus flat token fills.

**Production:** Pexels, licence recorded per asset
(`docs/design/moyo-design-reset-v2-brief.md:171`). The six entries already in the
register (`packages/art/registry.ts:133-176`) are the existing licensed set;
their provenance carries origin, licence, source, what the frame depicts and why
it was cast (`packages/art/registry.provenance.ts:38-58`).

**Fails its class when:** it shows a category rather than a moment; a child's
face is the subject; anyone performs for the camera; a screen faces the lens; the
casting notes in `packages/art/registry.provenance.ts:21-27` are not met. §6
quotes the casting law in full.

### `scene` — a cut-paper world

**For:** K–2 Today and K–2 completion, where the Scene archetype gives the art
at least half the viewport (`docs/design/moyo-design-reset-v2-brief.md:111`).
The home is a place the child recognises, holding the object they are working on.

**Shape:** layered, and the layers are declared.
`SceneArtEntry.slots` is `readonly ['background', ...('objects' | 'figure')[]]`
(`packages/art/registry.ts:92-95`), so `Scene` can refuse to promise a figure
layer the file does not ship. `background` is mandatory because a scene with no
ground is a sticker.

**Bands:** cleared per asset. A K–2 scene mounted on a 9–12 surface is a review
failure and `bands` is where it is caught (`packages/art/registry.ts:64-68`).

**Production:** layered SVG or PNG sets, generated only where a real photograph
cannot exist, every generated asset reviewed against the plates in this file
(`docs/design/moyo-design-reset-v2-brief.md:171`). The review is recorded in
`plateReview` (`packages/art/registry.provenance.ts:49-53`); a generated asset
with no recorded review is not a licensed asset (`:14-19`).

**Fails its class when:** it sets a mood instead of doing a job. A reading
scene shows the passage's setting; a fraction scene shows fifths; an empty
state's scene shows what will appear there
(`docs/design/moyo-design-reset-v2-brief.md:71`).

### `object` — the thing being learned

**For:** the Invitation archetype's hero art on 3–12 Today, and `MissionPath`
nodes (`docs/design/moyo-design-reset-v2-brief.md:112`,
`docs/design/reset/00-asset-inventory.md:50`). A paper fraction pizza, a
base-ten block set, a beaker, a globe — the subject rendered as an object a
child could pick up.

**Keying:** `ObjectArtEntry` carries `subject` and `skill`
(`packages/art/registry.ts:102-106`), the pair `SubjectArt` resolves against, so
one skill cannot silently borrow another skill's picture.

**Where the manipulative fallback lands.** `Manipulative` draws fraction bars,
number lines, base-ten blocks and area models at runtime in Skia or WebGPU and
exports a static PNG fallback from Storybook
(`docs/design/moyo-design-reset-v2-brief.md:130`, `:171`;
`docs/design/reset/00-repo-baseline.md:33` puts the renderer inside
`packages/ui/LearningCanvas.tsx`). That fallback enters the register as `object`,
keyed by the same `subject` and `skill` the renderer resolves against. The
register has four classes and gains no fifth for a fallback of something the app
normally draws itself.

**Fails its class when:** the object is generic where the skill is specific — a
picture of "maths" instead of the thing this skill is about — or when it is
decorative enough that removing it costs the screen nothing.

### `figure` — Natalie, still

**For:** the frames Natalie occupies when the 3D runtime is off or still loading
(`packages/art/registry.ts:108-111`). Her live presence is the WebGPU renderer
behind `NatalieDock`, which extends `packages/ui/TutorPresence.tsx` rather than
becoming a second presence component
(`docs/design/reset/00-repo-baseline.md:32`). The class exists so the 3D-off path
is a complete experience rather than a blank rail
(`docs/design/moyo-design-reset-v2-brief.md:75`).

**One word, two registers — do not conflate them.** The `figure` **class** is
Natalie. The `figure` **slot** inside `SceneArtEntry.slots`
(`packages/art/registry.ts:94`) is any figure drawn into that scene's layers,
including children. A child in a K–2 scene is a layer of a `scene` asset and is
governed by §6's silhouette rule; it never becomes a `figure` entry of its own.

**Fails its class when:** she reads as a sticker rather than a person
(`docs/design/moyo-design-reset-v2-brief.md:75`), when the still does not match
the rendered character closely enough that the 3D-off path looks like a
different product, or when she covers the work surface.

### Nothing is in three of the four classes yet

`scene`, `object` and `figure` are empty on purpose
(`packages/art/registry.ts:126-131`), and
`packages/art/registry.assert.ts:45-47` holds them at `never`. The asset
inventory records the same gap from the other direction: no cut-paper scene, no
subject object, no empty-state art, and no verified Natalie still exist today
(`docs/design/reset/00-asset-inventory.md:47-54`). §9 is the checklist an asset
passes to become the first entry in its class.

## §4 Light, stroke, geometry

Eight plates. Each names its failure condition, so a reviewer can fail a file
against it rather than discussing it.

### P4.1 · Light comes from the top-left, in every asset

Every hard-offset shadow in the system is positive on both axes — `4px 4px`,
`2px 2px`, and the site ladder emitted as `<offset> <offset> 0 0`
(`packages/theme/build-css.mjs:215`). A positive x/y offset puts the source at
the top-left and drops the shadow down and to the right. Artwork uses the same
source, without exception, so an object drawn inside a scene and the slab the
scene sits on never disagree about where the light is.

**Fails when:** any internal shadow falls up, left, or in a second direction
elsewhere in the same asset; any asset lights a subject from the right.

### P4.2 · Two shadow weights, and the dial picks which

The brief's blanket "4px 4px" (`docs/design/moyo-design-reset-v2-brief.md:74`)
is the Hot value only. The emitted stylesheet carries two:

| Dial | Token | Value | Where |
| --- | --- | --- | --- |
| Hot — learner and family surfaces | `--shadow-hot` | `4px 4px 0 0 var(--color-border-strong)` | `packages/theme/theme.css:195`; `dial.hot.shadow`, `packages/theme/tokens.ts:976`; applied by `.dial-hot` remapping `--shadow-card` at `theme.css:522` |
| Cool — ops, educator and institution surfaces | `--shadow-cool` | `2px 2px 0 0 var(--color-border-faint)` | `packages/theme/theme.css:199`; `dial.cool.shadow`, `packages/theme/tokens.ts:982`; applied at `theme.css:563` |

The root default matches the Hot value (`theme.css:183`). The two differ in ink
as well as in distance: `--color-border-strong` is `#000000` in light
(`packages/theme/tokens.ts:254`) while `--color-border-faint` is ink at 10%
(`:262`), which is never a text or border colour by design. Adult surfaces
therefore carry a shadow that is both shorter and far lower in contrast than a
learner surface's.

**No asset paints its own outer drop shadow.** The mount draws it, from whichever
dial it is in. Shadows *inside* an asset — one paper layer falling onto the layer
beneath — belong to the asset and follow P4.1 and P4.5.

**Fails when:** an asset ships with a baked outer shadow; that file is wrong on
every Cool surface and doubles up on every Hot one.

### P4.3 · One stroke weight per asset, and it never out-weighs its frame

The chrome ladder is `moyoBorderW` — `hair` 2px, `rule` 3px, `slab` 4px
(`packages/theme/tokens.ts:1126-1130`) — with 2px the floor below which a frame
stops reading as drawn (`docs/site/tokens.md:98`). In-product art is mounted in
a `border-2` ink frame (`docs/pack/08-visual-hierarchy-spacing-spec.md:139`; the
same weight `packages/ui/Button.tsx:13` draws). An asset's own outline is drawn
at or below that weight at the size the asset actually renders, so the frame
stays the strongest line on the surface.

One weight per asset. A cut-paper edge has a single treatment, and a stroke that
thickens and thins inside one drawing reads as a brush tool in a vector editor.

**Fails when:** two stroke weights appear inside one asset; the outline reads
heavier than its frame at the smallest emitted width in `widths`
(`packages/art/registry.ts:59-63`); the stroke is pure black rather than the
warm ink named in §2.

### P4.4 · Shapes overlap and occlude

Paper stacks. At least one shape in every scene passes behind another and is
partly hidden by it. Elements arranged side by side with clear air between all of
them is the flat-vector arrangement the direction exists to avoid
(`docs/design/moyo-design-reset-v2-brief.md:63`).

**Fails when:** no shape in the asset occludes another.

### P4.5 · Depth is quantised, and layers at one depth agree

Within one asset, each layer's internal offset is a function of its depth in the
stack, and two shapes at the same depth cast identical offsets. Offsets are
expressed relative to the asset's own long edge rather than in pixels, because
each asset is emitted at several widths (`packages/art/registry.ts:59-63`) and a
px offset authored at 840 is wrong at 420.

The exact fraction per depth step is **not defined by any installed token** —
`moyoShadowOffset` (`packages/theme/tokens.ts:1111-1116`) is a page-scale ladder
for chrome, not an in-asset one. Recorded as an open question in §5 rather than
invented here.

**Fails when:** two objects sitting on the same plane cast different offsets, or
a scene's internal offsets change between its 420px and 840px renditions.

### P4.6 · Value changes by adding a shape, never by fading one

No gradient fills, no soft-edged tonal washes. A second flat shape supplies a
darker or lighter area — the same discipline that makes `moyoPaperSunken` the
only way a section changes value without changing hue
(`docs/site/tokens.md:59`).

**Fails when:** any gradient, any feathered edge, any opacity ramp appears in the
file.

### P4.7 · Nothing is blurred

There is no token for a blurred shadow, and that absence is the enforcement
(`docs/site/tokens.md:105-106`; `packages/theme/tokens.ts:1103-1110`). It applies
inside artwork as well as to chrome: no soft shadow, no glow, no depth-of-field,
no atmospheric haze behind a background layer.

**Fails when:** any blur radius is greater than zero anywhere in the file.

### P4.8 · Cut-paper geometry — what makes a shape read as paper

A shape reads as paper when a person could have cut it out:

1. **Closed and cuttable.** Simple silhouettes, no hairline tendrils, no detail
   that falls below the stroke floor at the smallest emitted width.
2. **Irregular in the silhouette, regular in the stroke.** The wobble that says
   "cut by hand" lives in the outline's path. It never lives in the stroke width
   and never comes from a noise or roughen filter applied over the whole asset.
3. **Flat-on or barely tilted.** Cut paper lies on a table. Vanishing-point
   perspective turns it back into a rendered 3D object.
4. **Ungrained.** Grain belongs to the `Paper` surface under the art
   (`docs/design/moyo-design-reset-v2-brief.md:127`), at 2–4%
   (`packages/theme/tokens.ts:1145-1147`). An asset carrying its own grain
   double-textures the moment it is mounted on one — see conflict C6 for why no
   native grain surface exists yet.

**Fails when:** any of the four is violated, or when a photographic texture is
composited into an asset of class `scene` or `object`.

## §5 Palette roles inside artwork

Colour lives in the artwork; the chrome around it keeps one accent moment
(`docs/design/moyo-design-reset-v2-brief.md:72`). That division is what lets the
product be colourful without breaking doc 36 §5, and
`tooling/check-role-accent.mjs:2-8` already enforces the chrome half — a role
accent that colours body text, a border or the primary button fails the gate
everywhere, with no allowlist entry able to legalise it.

**Conflict C6 constrains this section.** Every `moyo*` token is web output only
(`packages/theme/build-css.mjs:153-159`), so a palette role stated only as a
`moyo*` name is unusable in the native app. Each row below names the app-side
token an asset's colour actually has to match on device, and records the gap
where none exists.

### The paper palette

| Role in artwork | App token (native + web) | Site token (web only) | Value |
| --- | --- | --- | --- |
| The ground the art sits on | `surface`, `packages/theme/tokens.ts:196` | `moyoPaper`, `:1035` | `ink[50]` `#FFFDF7` light / `ink[900]` `#171614` dark · site `#F7F1E3` |
| A sheet lifted off the ground | `surface-raised`, `:197` | `moyoPaperRaised`, `:1037` | `white` / `ink[800]` · site `#FFFCF2` |
| A sheet recessed into it | `surface-sunken`, `:198` | `moyoPaperSunken`, `:1039` | `ink[100]` `#F6F3E8` / `ink[950]` · site `#EFE7D4` |
| Every line and outline in the drawing | `text` `:203` for marks, `border-strong` `:254` for frames | `moyoInk` `:1041`, `moyoOutline` `:1049` | `ink[950]` `#0D0C0B` / `ink[100]` · site `#171310` |
| A quieter line — annotation, background detail | `text-muted`, `:210` | `moyoInkMuted`, `:1043` | `ink[600]` / `ink[300]` · site `#5A5145` |

Three of those five rows differ in value between the app and the site (see
conflict C5). Assets ship on a transparent ground so the surface supplies the
paper, which is what keeps one asset usable on both.

### The four colour families the artwork draws from

The brief names the artwork palette as "plum / coral / amber / teal"
(`docs/design/moyo-design-reset-v2-brief.md:72`, `:169`). Those are the four
brand ramps in `packages/theme/tokens.ts:40-63`, and their fixed points come
from the brand art and may not move (`:35-38`):

| Brief's name | Ramp | Fixed points | Site equivalent |
| --- | --- | --- | --- |
| plum | `brandScales.plum`, `:41-45` | `100` moyo-lavender, `700` moyo-purple — the logo M, `#3C2357` | `moyoMarkDeep` `#3C2357`, `:1088` |
| teal | `brandScales.lagoon`, `:46-50` | `100` moyo-mint, `500` moyo-teal `#0A9FA6` | `moyoMark` `#0A9299`, `:1081` |
| coral | `brandScales.flame`, `:51-55` | `100` moyo-guava, `400` moyo-coral `#E55545` | `moyoHeart` `#E55545`, `:1059` |
| amber | `brandScales.sun`, `:56-60` | `100` moyo-mango-pastel, `400` moyo-mango `#F4A629` | `moyoSun` `#F4A629`, `:1061` |

Per conflict C4, the site's six hue names collapse onto four values, so an asset
palette taken from the site's row names would ship two pairs of duplicates. Work
from the ramp names above.

### The marks, and what they are allowed to mean

The stationery aliases are named for the instrument that makes the mark
(`packages/theme/tokens.ts:270-276`), and the split holds inside artwork:

| Token | Line | Kind | Measured on `surface` | Rule inside artwork |
| --- | --- | --- | --- | --- |
| `highlighter` | `:289` | Surface — ink goes on top, so it carries `on-highlighter` `:290` | 2.54:1 | A shape a child reads *through*. Never a line, never type. |
| `ballpoint` | `:300` | Mark | 6.25:1 | The child's own working line. Gated at 4.5 against both surfaces, `tooling/check-contrast.mjs:88-89`. |
| `redpen` | `:301` | Mark | 6.85:1 | Teacher correction only, and never a child's own progress — a correction is not an error state (`packages/theme/tokens.ts:276-278`), and struggling is drawn in highlighter, never red (`docs/pack/08-visual-hierarchy-spacing-spec.md:125`). |
| `grade` | `:302` | Mark | 7.22:1 | Demonstrated outcome. |

Ratios computed as WCAG 2.1 relative luminance in sRGB from the installed light
values against `surface` `#FFFDF7`.

### Fill-only

A colour that cannot carry type in chrome cannot carry type in artwork either.
Four are fill-only, three of them by a stated rule:

| Token | Where the rule is stated | Enforcement |
| --- | --- | --- |
| `moyoSun` `#F4A629` | `docs/site/tokens.md:265` | `SITE_FILL_ONLY`, `tooling/check-contrast.mjs:253`, failing at `:415-421` if it ever appears as a foreground |
| `highlighter-underlay` | "A fill only … never a text or border colour", `packages/theme/tokens.ts:296-299` | None beyond the comment |
| `border-faint` | "Never a text or border colour — it fails contrast by design", `:260-262` | None beyond the comment |
| `highlighter` | Carries `on-highlighter` (`:290`), which makes it a surface by construction | Not gated as a foreground — it appears in no pair in `PAIRS` (`tooling/check-contrast.mjs:78-99`) |

Inside artwork this means the amber family fills shapes and never draws the line
around them, and no text — hand-lettered or live — is ever set in it.

### Rules

**P5.1 · One accent moment stays with the chrome.** An asset may carry several
of the four families; the surface around it keeps its single accent
(`docs/design/moyo-design-reset-v2-brief.md:72`). Fails when an asset is placed
to *be* the screen's accent moment rather than to do a job.

**P5.2 · Role accents never enter artwork.** `role-learner`, `role-guardian`,
`role-tutor` and the rest are the five doors' identity
(`packages/theme/tokens.ts:319-323`) and are reachable only through `*-role-*`
utilities so placement stays greppable (`tooling/check-role-accent.mjs:10-14`).
A colour baked into a file is not greppable. Fails when an asset quotes a role
accent value.

**P5.3 · `redpen` never marks a child's own work in artwork.** Fails when the
rose family appears on anything representing the learner's attempt, output or
progress.

**P5.4 · Text over artwork is a declared contrast pair.** Every text-over-art
overlay is derived and checked (`docs/design/moyo-design-reset-v2-brief.md:201`),
at 4.5:1 for body and 3:1 for large text and non-text boundaries
(`tooling/check-contrast.mjs:70-71`). On learner surfaces the bar is 7:1 —
`docs/site/tokens.md:271-274` records the override as out of scope for the site
precisely because no learner surface renders there. Fails when a pair is not
declared, since an undeclared pair is an unmeasured one.

### Open questions

These are needs the direction has and the tokens do not meet. None is answered
here.

**OQ-1 · No native grain.** `--moyo-grain-opacity` reaches `theme.css` only
(`packages/theme/build-css.mjs:223`), and the surface that consumes it is
unbuilt even on the web (`docs/site/tokens.md:343`). The `Paper` primitive is
specified for hero surfaces at 2–4%
(`docs/design/moyo-design-reset-v2-brief.md:127`) with nothing on device to read.
Needs either a native texture token or a decision that grain is web-only, which
would remove a named ingredient from the app's direction.

**OQ-2 · No art-palette token set.** The four families are primitive ramps, and
`packages/theme/tokens.ts:5-9` forbids feature code from naming a primitive scale
directly. An asset file is not feature code, so whether an illustrator may quote
`brandScales.flame[400]` as a source value — or whether semantic art tokens must
be minted first — is undecided.

**OQ-3 · No in-asset depth ladder.** P4.5 needs a fraction of the long edge per
depth step. `moyoShadowOffset` (`packages/theme/tokens.ts:1111-1116`) is a
page-scale ladder for chrome and does not answer it.

**OQ-4 · No in-asset ink token that survives dark mode.** `shadows.card`
resolves `var(--color-border-strong)`, which is `#000000` light and `ink[100]`
light-on-dark (`packages/theme/tokens.ts:254`). A flat file resolves no variable,
so an asset's own internal shadow ink is fixed at author time and cannot invert.
Whether assets ship a dark-mode variant, or internal ink is chosen to work on
both grounds, is undecided.

**OQ-5 · `highlighter` has no fill-only gate.** The site's equivalent fails the
build if used as a foreground; the app's does not. Whether to add an app-side
`FILL_ONLY` set is a question for the accessibility seat, not for this document.

## §6 Figure policy

### Children

**P6.1 · No photoreal child face appears on a learner surface, ever.**
`prompts/ROSTER.md:37` states it as a non-negotiable every seat enforces.
`packages/art/registry.ts:76-85` enforces it structurally: a `photo` entry's
`bands` tuple is `readonly ['adult']` and does not widen, and
`packages/art/registry.assert.ts:51-53` fails the typecheck if it does — the
asset inventory records that widening it to admit `k2` produces one error at
`registry.assert.ts:52` (`docs/design/reset/00-asset-inventory.md:68`). Review
attention is not what holds this line.

**P6.2 · Three treatments are permitted for a child in artwork.**

| Treatment | What it is | Where it suits |
| --- | --- | --- |
| Silhouette | The figure as one filled shape, no interior facial detail | A scene where the child is present but the object being learned is the subject |
| Back-of-head or over-the-shoulder | The figure faces into the scene, toward the work | Any composition where the child is looking at the thing the screen is about |
| Clearly stylised | A drawn figure with a face, at the asset's own stroke weight and flat fills | K–2 scenes where the figure carries the narration beat |

"Clearly stylised" has to be failable, so: the face is built from the same
single stroke weight (P4.3) and flat fills (P4.6) as everything else in the
asset, with no photographic or near-photographic rendering of individual
features, no skin gradient, no rendered eye highlight. A figure that could be
mistaken at full zoom for a photograph of one specific real child fails this
plate regardless of how it was produced.

**Fails when:** a face is rendered at a fidelity the rest of the asset does not
use; a generated figure resolves toward photorealism at large renditions; a
child's face appears in any `photo`-class entry.

**P6.3 · A child figure is a layer of a scene, never a `figure` entry.** The
`figure` **class** is Natalie (`packages/art/registry.ts:108-111`). The `figure`
**slot** inside `SceneArtEntry.slots` (`:94`) is any figure drawn into that
scene's layers. §3 states the same split; it is repeated here because the shared
word is where the rule gets broken.

**P6.4 · A real minor's face is a consent question before it is a design one.**
`docs/pack/08-visual-hierarchy-spacing-spec.md:139` puts it plainly: faces of
minors never appear in marketing without the doc-05/06 consent machinery. Inside
the product, P6.1 already forecloses it on learner surfaces; on adult surfaces
the machinery is the gate, not this document.

### Natalie

Her rules come from `docs/design/moyo-design-reset-v2-brief.md:75` — she is a
person, not a sticker — and are owned in code by `NatalieDock`, which extends
`packages/ui/TutorPresence.tsx` rather than becoming a second presence component
(`docs/design/reset/00-repo-baseline.md:32`). That file already holds the rule
that she is the other participant, rendered once, outside the state switch.

| Surface | Presence | Placement |
| --- | --- | --- |
| Today | Small, greeting (`brief:75`). On K–2 she stands in the scene itself at small scale (`brief:111`) | Inside the Scene archetype's art, not floating over the chrome |
| Tutor Room | Full-body, and **never over the canvas** (`brief:75`) | Docked beside the canvas on tablet and web; a collapsible rail on phone (`brief:75`, `:148`). The Focus archetype gives the canvas ≥60% (`brief:113`) |
| Completion | Present at the reveal (`brief:75`) | Beside the object that completes, not in front of it |

**P6.5 · She is absent during silent reading.** `docs/design/moyo-design-reset-v2-brief.md:75`
states it without qualification. A companion watching a child read is a presence
the child did not ask for.

**P6.6 · Every degraded path is a complete experience, not a gap.**
Text-only and voice-only degradation is complete
(`docs/design/moyo-design-reset-v2-brief.md:75`), and the voice-off and 3D-off
variants are the same screen minus the dock (`:148`) rather than the same screen
with a hole in it. The `figure`-class still is what fills the frame while the 3D
runtime is off or loading (`packages/art/registry.ts:108`); it must read as the
same character as the rendered one, or the 3D-off path looks like a different
product.

**P6.7 · Motion around her is bounded and captioned.** Baked greeting clips run
≤6s and are captioned always; `prefers-reduced-motion` swaps clip for still
frame plus text; K–2 gets the slower, warmer take
(`docs/pack/37-onboarding-dual-pane.md:16`).

**Nothing in this subsection can be built yet.** The baked clips are externally
blocked with nothing to bind to (`docs/pack/37-onboarding-dual-pane.md:24`), and
the stills are not verified present — the GLTF and GLB are, the clips are not
(`docs/design/reset/00-asset-inventory.md:53`).

### The casting law for adult photography

Quoted from `docs/pack/37-onboarding-dual-pane.md:17`:

> **Realistic photography (the On / Nike Run Club / Strava register):** real
> kitchen tables, real homework mess, real families — full-bleed with the doc 08
> ink-on-scrim type treatment. Casting law: diverse families, real desks,
> **never stock-child-smiling-at-laptop**; photography shows the *moment* (a kid
> mid-eraser-crumb), not the category.

`packages/art/registry.provenance.ts:21-27` carries the operative reading already
applied to the six licensed photographs: real kitchen tables, real homework mess,
diverse families; a moment rather than a category; window light, camera near
child eye-level, no branded clothing, no screens facing the camera; an adult may
be present but is not the subject; never a stock child smiling at a laptop.

**P6.8 · The casting rationale is recorded per asset, not asserted per shoot.**
`cast` in `ArtProvenance` (`packages/art/registry.provenance.ts:47-48`) answers
why this frame and not another from the same set. An entry whose `cast` restates
the law rather than naming what is in this frame has not been cast, it has been
filed.

**Fails when:** anyone performs for the camera; a screen faces the lens; the
adult is the subject on a family surface; the frame shows a category — "family
doing homework together" — rather than a moment.

## §7 Per-band register

Bands change composition, not just size
(`docs/design/moyo-design-reset-v2-brief.md:76`). The five are `Band` —
`'k2' | 'g35' | 'g68' | 'g912' | 'adult'` (`packages/art/registry.ts:49`), where
`adult` covers guardian, teacher, tutor and school surfaces, which share one
register (`:44-48`). Every asset declares which bands may render it, and a K–2
scene mounted on a 9–12 surface is caught there (`:64-68`).

**Two band systems exist and do not align.** `Band` is grade bands. NN/g's are
age bands — 3–5 pre-readers, 6–8 beginner readers, 9–12
(`docs/pack/08-visual-hierarchy-spacing-spec.md:11`). Doc 08's findings are
cited by age; the register keys by grade. Do not read "3–5" in one as "3–5" in
the other.

| Band | Composition | What the art does | Classes | Figure | Target | Dial |
| --- | --- | --- | --- | --- | --- | --- |
| `k2` | Scene-first. Art takes ≥50% of the viewport, one primary slab, up to two secondary tiles (`brief:111`). One action, narration carries the screen | Shows the place and the object the child is working on. The home is somewhere, not a launcher | `scene` | Natalie small, in the scene (`brief:111`); children per P6.2 | `young` 72px (`packages/theme/tokens.ts:869`) | Hot |
| `g35` | Subject world plus a short plan. Invitation archetype — hero card with subject art at 40% and Start (`brief:112`) | Names the subject as a thing, not a category. Art explains the topic | `scene`, `object` | Stylised or silhouette | `child` 56px (`:868`) | Hot |
| `g68` | Studio. Tools and projects, the canvas as workbench | Shows the instrument the work is done with — the manipulative, the diagram | `object` | Restrained; a figure is rarely the subject | `teen` 48px (`:867`) | Hot |
| `g912` | Goals, deadlines, credible diagrams, restrained celebration (`brief:76`). One hero above quiet lists (`brief:88`) | Earns trust by being accurate. A diagram that would embarrass a textbook fails the band | `object` | Rarely present | `teen` 48px (`:867`) | Hot |
| `adult` | Editorial hierarchy, status heroes, evidence strips, dense tables where warranted (`brief:76`) | Carries evidence — the child's own work — or real photography of adults at work | `photo`, and the child's own captures | Adults per the casting law in §6 | `adult` 44px (`:866`) | Cool |

`g68` and `g912` share `target-teen` at 48px; the composition difference between
them is the register, not the hit box.

### Rules that change with the band

**P7.1 · Reading load falls to zero at `k2`.** Zero reading is required to
complete a K–2 screen (`docs/pack/37-onboarding-dual-pane.md:20`); voice carries
every screen. The Sago Mini bar the brief sets is the same — no reading
required, no timer, no to-do lists
(`docs/design/moyo-design-reset-v2-brief.md:49`). Art that only works once a
caption has been read fails at this band. Hero copy at K–2 runs ≤8 words and one
question (`brief:179`).

**P7.2 · One next thing, at every learner band.** Learner Home is resume-first
(`docs/pack/36-role-navigation-flows.md:42`), and adr-107's evidence is about
singularity — exactly one "next" node, zero navigation decisions, and K–2 Today
"Duolingo-degree singular — one 'next' tile, not a feed"
(`docs/design/reset/02-binding-constraints.md:681`). Art that presents a
field of equally weighted choices fails, whatever the band.

**P7.3 · Parallax is banned outright on `k2` and `g35`, and on every learner
surface.** Not motion-budget-dependent, not reduced-motion-conditional:
`docs/pack/02-adaptive-screens-design-spec.md:268` lists "ambient/parallax
motion on child surfaces" in the Never column, and doc 02 is rank 1. The brief's
scene-depth parallax on learner hero art (`brief:68`) and `Scene`'s parallax
behaviour (`brief:128`) are both blocked until adr-115 supersedes that entry by
name (§1, item 4). A scene ships with one static composition; nothing in it
moves as the viewport does. Motion that shows a consequence of the child's own
action — press, complete, select — is a different thing and stays allowed
(`brief:181`).

**P7.4 · The attention budget is spent before the art arrives.** One display
moment and one highlighter accent per screen
(`docs/pack/08-visual-hierarchy-spacing-spec.md:84`), Hot screens ≥40% empty
canvas (`:43`), one primary action (`:44`), plus the role accent's own budget.
`docs/design/reset/02-binding-constraints.md:695` names the consequence: a
saturated scene spends the screen's attention budget before any UI does. At
`k2`, where the scene takes half the viewport, this binds hardest — the scene
has to be quiet enough that the primary slab still wins the squint test.

**P7.5 · Adult surfaces carry the quieter shadow.** Cool remaps `--shadow-card`
to `2px 2px 0 0 var(--color-border-faint)` (`packages/theme/theme.css:563`,
`:199`). Art composed against a 4px black slab reads as heavier than everything
around it on an adult screen. P4.2 already forbids baking the shadow in; this is
why it matters per band.

**P7.6 · `photo` is cleared for `adult` and nothing else.** Not adult-first —
adult only (`packages/art/registry.ts:79-84`). A photograph cleared for a parent
screen has not been cleared for a child's, and the tuple does not widen to make
one do double duty.

**P7.7 · Empty states are band-specific art, not a shared blank.** An empty
state's art shows what will appear there
(`docs/design/moyo-design-reset-v2-brief.md:71`). At K–2 the brief's own example
is a table empty except a wrapped box labelled "Start here", with no fake
history (`:146`). None of this art exists yet
(`docs/design/reset/00-asset-inventory.md:54`).

## §8 Do / don't plates

Eighteen pairs. Each carries a fail test a reviewer can apply to one file
without consulting anyone, and a dependency marker: **[either]** holds however
C-13 resolves, **[cut-paper]** holds only if adr-115 supersedes doc 08 §6's
ink-line clause and doc 02's skeuomorph entry (§1).

### P8.1 · Art does a pedagogical job **[either]**

**Do** make every asset teach something the screen is about. A fraction scene
shows fifths; a reading scene shows the passage's setting; an empty state shows
what will appear there (`docs/design/moyo-design-reset-v2-brief.md:71`).

**Don't** ship art whose removal costs the screen nothing.

**Fail test:** name the specific thing this asset teaches, in one sentence, that
the surrounding copy does not already say. No sentence, no asset. This is also a
merge blocker for the design-system seat (`prompts/ROSTER.md:13`).

### P8.2 · No mood illustration **[either]**

**Do** let the subject determine the picture.

**Don't** draw atmosphere — a cheerful abstract shape, a friendly blob, a
scattering of stars — to make a screen feel warmer.

**Fail test:** ask what changes if this asset is swapped for a different one of
the same size and tone. If the answer is nothing, it is mood.

### P8.3 · Reading and working surfaces stay quiet **[either]**

**Do** keep the canvas paper-plain: no grain, no art competing with the problem
(`docs/design/moyo-design-reset-v2-brief.md:73`). The Focus archetype gives the
canvas ≥60% (`:113`) and doc 08 asks Hot screens for ≥40% empty canvas
(`docs/pack/08-visual-hierarchy-spacing-spec.md:43`).

**Don't** place decorative art on a Tutor Room canvas, a capture review, a
reading passage, or any surface where a child is working.

**Fail test:** on the surface as shipped, is any pixel of artwork present that
is not itself the problem, the diagram, the manipulative or the document? If
yes, it fails.

### P8.4 · Never emoji as art **[either]**

**Do** resolve a missing asset as a compile error
(`packages/art/registry.ts:20-26`).

**Don't** render an emoji, an icon-as-illustration, or a coloured box where art
belongs. `prompts/ROSTER.md:37` states it as a non-negotiable.

**Fail test:** grep the surface for an emoji literal in a slot the register
should own. One hit fails.

### P8.5 · Grain on hero surfaces only, and never inside a file **[cut-paper]**

**Do** apply grain through the `Paper` primitive on hero surfaces
(`docs/design/moyo-design-reset-v2-brief.md:127`), at 2–4% — `moyoTexture.grain`
is `0.03` and the range is the whole allowance
(`packages/theme/tokens.ts:1145-1147`). At 5% it is grunge, and the language is
a clean workbook rather than a distressed poster (`docs/site/tokens.md:103`).

**Don't** bake grain into an asset, apply it to a reading or working surface, or
raise it past 4%.

**Fail test:** flatten the asset over a plain fill; visible noise means baked
grain. On the surface, measure the opacity against the token.

**Dependency:** grain is a skeuomorph texture, barred by
`docs/pack/02-adaptive-screens-design-spec.md:267`, and there is no native grain
token at all (OQ-1). This plate is unbuildable until §1 item 3 is resolved.

### P8.6 · No second radius, and none baked in **[either]**

**Do** ship every asset square-cornered with a transparent bleed and let the
mount apply the radius its scope resolves to.

**Don't** draw a rounded corner into a file. `--radius-card` resolves to four
different values across root, `.dial-hot`, `.dial-cool` and `.moyo-site`
(conflict C1), so a baked corner is wrong in at least three of them. A second
control radius is a merge blocker (`prompts/ROSTER.md:13`).

**Fail test:** inspect the asset's own corners at full opacity. Any rounding
that is not part of the depicted object fails.

### P8.7 · No blurred shadow, no glow, no blur of any kind **[either]**

**Do** draw internal depth as a hard offset shape (P4.1, P4.5).

**Don't** use a blur radius anywhere. No token exists for a blurred shadow, and
that absence is the enforcement (`docs/site/tokens.md:105-106`;
`packages/theme/tokens.ts:1103-1110`). It is also a merge blocker
(`prompts/ROSTER.md:13`).

**Fail test:** any blur radius greater than zero in the source file fails,
including on a background layer.

### P8.8 · Text over art is a declared, measured pair **[either]**

**Do** declare every text-over-artwork overlay in `tooling/check-contrast.mjs`
and measure it (`docs/design/moyo-design-reset-v2-brief.md:201`): 4.5:1 body,
3:1 large text and non-text boundaries
(`tooling/check-contrast.mjs:70-71`), 7:1 on learner surfaces.

**Don't** rely on a scrim being "dark enough" or on the art being "quiet there".

**Fail test:** the pair appears in the gate, or it fails. Text on art is
currently ungated entirely
(`docs/design/reset/02-binding-constraints.md:697`), so this plate describes
work that has to happen before the first asset carrying type lands.

### P8.9 · One light direction, everywhere **[either]**

**Do** light every asset from the top-left, matching the positive x/y offset of
every shadow token in the system (`packages/theme/build-css.mjs:215`).

**Don't** let one object in a scene disagree with the slab it sits on.

**Fail test:** trace every internal shadow. All fall down and to the right, or
it fails.

### P8.10 · One stroke weight per asset, never heavier than its frame **[either]**

**Do** draw at a single weight, at or below the `border-2` ink frame the mount
supplies (`docs/pack/08-visual-hierarchy-spacing-spec.md:139`).

**Don't** thicken and thin an outline for expression, and don't outline in pure
black — ink is warm near-black (`packages/theme/tokens.ts:203`, `:1041`).

**Fail test:** measure the outline at the narrowest width in `widths`
(`packages/art/registry.ts:59-63`). Two weights, or heavier than the frame,
fails.

### P8.11 · Value comes from another flat shape **[either]**

**Do** add a second flat shape to darken or lighten an area, the way
`moyoPaperSunken` is the only way a section changes value without changing hue
(`docs/site/tokens.md:59`).

**Don't** use a gradient, a feathered edge, or an opacity ramp.

**Fail test:** sample any two adjacent pixels inside one shape. A value change
across a shape's interior fails.

### P8.12 · No photoreal child faces on learner surfaces **[either]**

**Do** use silhouette, back-of-head, or clearly stylised figures (P6.2).

**Don't** render a child's face at a fidelity the rest of the asset does not
use. `prompts/ROSTER.md:37` makes it a non-negotiable and
`packages/art/registry.assert.ts:51-53` enforces the photography half.

**Fail test:** at full zoom, could this figure be mistaken for a photograph of
one specific real child? Yes fails.

### P8.13 · No role accent inside a file **[either]**

**Do** leave the five doors' identity to chrome, reachable only through
`*-role-*` utilities so placement stays greppable
(`tooling/check-role-accent.mjs:10-14`).

**Don't** bake a role accent value into an asset. A colour in a file is not
greppable and defeats the gate.

**Fail test:** sample the asset for `role-*` hex values
(`packages/theme/tokens.ts:332-343`). One hit fails.

### P8.14 · Shapes overlap and occlude **[cut-paper]**

**Do** stack layers so at least one shape passes behind another.

**Don't** arrange elements side by side with clear air between all of them —
that is the flat-vector arrangement the direction exists to avoid
(`docs/design/moyo-design-reset-v2-brief.md:63`).

**Fail test:** count occlusions. Zero fails.

**Dependency:** collage geometry presumes cut paper. Under an ink-line-plus-flat-fills
resolution this plate does not apply.

### P8.15 · No parallax, no ambient motion on a learner surface **[either]**

**Do** ship one static composition. Motion shows a consequence of the child's
own action and nothing else (`docs/design/moyo-design-reset-v2-brief.md:181`).

**Don't** move a scene layer against the viewport.
`docs/pack/02-adaptive-screens-design-spec.md:268` bars ambient and parallax
motion on child surfaces, and doc 02 is rank 1 of the precedence order.

**Fail test:** scroll the surface. Any layer that translates relative to another
fails, reduced-motion path notwithstanding.

### P8.16 · Every asset is in the register, or it does not exist **[either]**

**Do** add the entry and its provenance together — the halves are held by
`satisfies Record<ArtName, ArtProvenance>`
(`packages/art/registry.provenance.ts:11-12`), so art without provenance fails
the typecheck.

**Don't** write `<Image source={{uri}}>` outside the register
(`docs/design/moyo-design-reset-v2-brief.md:197`); `tooling/ui-sweep.mjs` is
extended to fail on it (`docs/design/reset/00-repo-baseline.md:50`).

**Fail test:** the sweep passes, or it fails.

### P8.17 · Natalie never covers the work **[either]**

**Do** dock her beside the canvas on tablet and web, in a collapsible rail on
phone (`docs/design/moyo-design-reset-v2-brief.md:75`, `:148`).

**Don't** place her over the canvas, or on a silent reading surface at all
(`:75`).

**Fail test:** overlay her bounding box on the canvas region. Any intersection
fails.

### P8.18 · African influence is structural, never a motif **[either]**

**Do** carry it in the rhythm the border-width and offset ladders impose on
grids, separators and section transitions (`docs/site/tokens.md:41-44`).

**Don't** apply a pattern as decoration, clip-art, or a border treatment
(`docs/design/moyo-design-reset-v2-brief.md:67`).

**Fail test:** if a reviewer can point at a decoration and say "that's the
African part", the asset fails.

## §9 The approval checklist

Seven items. An asset enters `packages/art/registry.ts` when all seven are
answered in the PR, and not before. Six are answered per asset; the seventh is
answered once, for the whole register, and is currently unanswered.

### 0 · The blocker is cleared

adr-115 exists and supersedes, by name, the clauses listed in §1 that govern the
class being added. Until it does, `packages/art/registry.assert.ts:45-47` holds
`SceneArtName`, `ObjectArtName` and `FigureArtName` at `never`, and no asset in
those classes can land. A PR that edits those assertions without citing the ADR
is the failure mode this document exists to prevent.

Adult photography is not blocked by adr-115 — `photo` entries exist already
(`packages/art/registry.ts:133-176`) — but mounting one on an app surface is a
new decision and still passes items 1–6.

### 1 · The plate it satisfies

Name the plate from §4–§8 the asset was reviewed against, and the class it
belongs to. A plate is a numbered rule with a fail test (§1); an approval citing
"the art direction" rather than a plate number is not an approval
(`prompts/ROSTER.md:26`).

For generated art this is recorded in the register itself: `plateReview` carries
who reviewed it against which plates and when
(`packages/art/registry.provenance.ts:49-53`). A generated asset with no
recorded review is not a licensed asset (`:14-19`).

### 2 · Licence recorded

`origin`, `licence` and `source` on the provenance entry
(`packages/art/registry.provenance.ts:39-46`). Photography is Pexels with
photographer and source URL recorded even though attribution is not required, so
any pick can be re-verified (`:14-16`). Illustration records the illustrator or
the generation route.

The two halves cannot drift: `satisfies Record<ArtName, ArtProvenance>` (`:119`)
makes an entry added to the runtime register without provenance a typecheck
failure.

### 3 · Alt written, and its source register named

`alt` lives on the runtime entry, not at the call site
(`packages/art/registry.ts:27-31`), so an image with no alt text is not a state
the register can be put into. `altSource` names which register the string is
quoted from — the existing entries cite
`docs/38-front-door-and-flow.md §5 FD-01 (A11y)` and
`docs/site/copy-deck.md §11 rules 1–6`
(`packages/art/registry.provenance.ts:68`, `:78`).

This discharges doc 08's "alt text mandatory"
(`docs/pack/08-visual-hierarchy-spacing-spec.md:139`) structurally rather than
per call site (`docs/design/reset/02-binding-constraints.md:703`).

### 4 · Band clearance

`bands` names every band allowed to render the asset, as a non-empty tuple
(`packages/art/registry.ts:64-68`). The composition has to be right for each
band claimed, per §7 — a K–2 scene cleared for `g912` is a review failure, and
this field is where it is caught.

`photo` entries are `readonly ['adult']` and the tuple does not widen
(`:79-84`). Widening it fails at `packages/art/registry.assert.ts:52`
(`docs/design/reset/00-asset-inventory.md:68`).

### 5 · Contrast pair checked

Every text-over-artwork overlay the asset will carry is declared in
`tooling/check-contrast.mjs` and passes: 4.5:1 body, 3:1 large text and non-text
boundaries (`tooling/check-contrast.mjs:70-71`), 7:1 on learner surfaces. A
pairing nobody declares is a pairing nobody measures — the reasoning the site
layer already applies to its restricted pairs (`:230-235`).

The pairs do not exist yet. `tooling/check-contrast.mjs` has no
text-over-artwork entries at all
(`docs/design/reset/02-binding-constraints.md:697`), so the first asset
carrying type also ships the gate extension.

### 6 · Budget in KB

State the encoded size of every rendition. `ART_FORMATS` is `['avif', 'webp']`
with `jpg` as the universal fallback `src`
(`packages/art/registry.ts:195-201`), and `widths` lists the emitted widths
ascending (`:59-63`).

| Budget | Value | Source |
| --- | --- | --- |
| First-paint art on Today | ≤ 250 KB, preloaded with the shell per adr-114 | `docs/design/moyo-design-reset-v2-brief.md:172` |
| Scenes after first interaction | Lazy | `:172` |
| Natalie | Her own budget, on the adr-114 preload path | `:172`; `docs/design/reset/00-asset-inventory.md:58` |

For calibration from the existing set: the largest single rendition is
`schools-operations-1440.jpg` at 169 KB and its AVIF is 60 KB; a hero at 840px
in AVIF costs about 49 KB. A Today scene plus one subject object fits; Natalie
does not (`docs/design/reset/00-asset-inventory.md:56-58`).

### The gates that run

| Gate | Checks | Where |
| --- | --- | --- |
| `pnpm check:art` | The register's own invariants | `tooling/check-art-registry.mjs`, `package.json:36` |
| `tsc --noEmit` | Runtime and provenance halves cover one key set; empty classes stay `never`; photo bands stay adult-only | `packages/art/registry.assert.ts` |
| `pnpm ui:sweep` | No image outside the register | `tooling/ui-sweep.mjs`, `package.json:32`; extension recorded at `docs/design/reset/00-repo-baseline.md:50` |
| `check-contrast` | Declared pairs, once item 5's entries exist | `tooling/check-contrast.mjs` |

### Two sequencing notes

`docs/pack/08-visual-hierarchy-spacing-spec.md:155` requires a mood board
committed to `docs/design/`, and no such file exists. It is an input to this
document rather than a competing gate
(`docs/design/reset/02-binding-constraints.md:705`).

`apps/web-vite/data/photography/8618018.jpg` matches no entry in the site's
`photography.ts` and ships nowhere — a rejected pick never deleted, or a dropped
entry. Resolve it before the register is treated as complete
(`docs/design/reset/00-asset-inventory.md:39`).
