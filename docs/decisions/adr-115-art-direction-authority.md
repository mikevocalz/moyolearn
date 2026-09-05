# ADR-115 — Which document governs art direction on app surfaces

Status: **PROPOSED.** This file is a draft for the design-system and platform-HIG
seats to rule on (`prompts/ROSTER.md:13`, `:16`); the accessibility seat reviews
it too because rule 4 makes that mandatory for every visual deliverable
(`prompts/ROSTER.md:28`). Nothing here is in force. No plate may cite it, and
`packages/art/registry.assert.ts` may not be edited on the strength of it.
Date: 2026-09-05 · Branch: `design/reset-v2` · Author: art-direction pass

<!--
What it is: the decision record for the four rank-1 pack clauses that block the
reset brief's art register, and for which document is the authority on app
art direction when they disagree.
Why it exists: docs/design/art-direction.md:76 defers four conflicts to an ADR
by this name and refuses to settle them in a design file that would be the
beneficiary of its own ruling. Until this lands, packages/art holds three name
types at `never` and no asset can compile.
SOT: docs/design/art-direction.md §1 §8 · docs/design/reset/02-binding-constraints.md §9 C-9 C-13
     docs/pack/08-visual-hierarchy-spacing-spec.md §6 · docs/pack/02-adaptive-screens-design-spec.md §5 Addendum A
     docs/design/moyo-design-reset-v2-brief.md §3 §7 · packages/art/registry.assert.ts · prompts/ROSTER.md
SOT-KEYWORDS: adr art direction authority cut-paper ink-line skeuomorph grain parallax
              schoolhouse tactile-learning supersede scene object figure never
-->

## Context

**Four clauses block the register, and all four are rank 1.** The precedence
order is `docs/pack/*` → `docs/38-front-door-and-flow.md` →
`docs/design/overhaul-v2/00-binding-decisions.md` → the reset brief →
`design/screens/**/contract.md` (`prompts/ROSTER.md:27`). Every blocking clause
sits in `docs/pack/`; the direction that wants past them sits in the brief, rank
4. Renaming a language in a rank-4 document does not move a rank-1 clause.

1. **The ink-line clause.** `docs/pack/08-visual-hierarchy-spacing-spec.md:138`
   bans photography on child learning surfaces and then constrains what replaces
   it: "illustration there is ink-line + flat token fills only". Its stated
   reason, on the same line, is that "decorative stock competes with the
   one-task rule and the tutor-presence signature".
2. **The style name.** `docs/pack/02-adaptive-screens-design-spec.md:158` names
   the app's design language "Neubrutalism × Swiss ('Schoolhouse')".
3. **Skeuomorph textures.** `docs/pack/02-adaptive-screens-design-spec.md:267`,
   Addendum A's do/never table: sleek "never means … decorative 3D, clay,
   skeuomorph textures".
4. **Ambient motion on child surfaces.**
   `docs/pack/02-adaptive-screens-design-spec.md:268`: sleek "never means …
   ambient/parallax motion on child surfaces".

**What the brief proposes against them.**
`docs/design/moyo-design-reset-v2-brief.md:58` names the direction "Neubrutalism
× Tactile Learning Modernism"; `:67` gives K–5 "cut-paper and cardboard scenes"
and "paper grain overlay at 2–4% on hero surfaces only"; `:68` puts
"scene-depth parallax on hero art (reduced-motion: static)" in the spatial 15%,
and `:128` builds that parallax into the `Scene` primitive itself. The name is
borrowed from the marketing ratio at `docs/site/tokens.md:37` — "60% Editorial
Neubrutalism · 25% Tactile Learning · 15% Spatial Magic".

**The reset audit already ruled against the brief on two of the four, and said
what would change that.** `docs/design/reset/02-binding-constraints.md:687-691`
(C-13) gives the ink-line clause to doc 08 — the photography ban does not bite,
because cut paper is not stock photography, but the positive constraint does —
and names the only remedy: "Either the art direction stays inside ink-line plus
flat token fills, or `docs/design/art-direction.md` supersedes doc 08 §6 by
name." `:655-659` (C-9) gives the name to doc 02 for app surfaces, because the
site ratio is web-vite-scoped and out of app scope
(`docs/design/overhaul-v2/I-token-system.md:67`), and calls for "an ADR
superseding doc 02 §5 by name" if the brief's name is to govern.

**The art-direction file cannot resolve this itself, and says so.**
`docs/design/art-direction.md:76` opens a DEFER block that records all four,
lists what an ADR would have to supersede by name (`:127-138`), and states that
"Items 3 and 4 are separable from items 1 and 2: an ADR could supersede the
ink-line clause and still leave grain and parallax banned"
(`docs/design/art-direction.md:140-142`). Its §8 plates are already written for
both outcomes: sixteen carry **[either]** and two carry **[cut-paper]** —
P8.5 (grain on hero surfaces, `:916`) and P8.14 (shapes overlap and occlude,
`:1029`) — which hold "only if adr-115 supersedes doc 08 §6's ink-line clause
and doc 02's skeuomorph entry" (`:866-867`).

**Why it matters now: the compiler is holding the gate, not review attention.**
`packages/art/registry.assert.ts:45-47` asserts `SceneArtName`,
`ObjectArtName` and `FigureArtName` all equal `never`:

```ts
type _NoScenesYet = Assert<Equals<SceneArtName, never>>;
type _NoSubjectArtYet = Assert<Equals<ObjectArtName, never>>;
type _NoFigureStillsYet = Assert<Equals<FigureArtName, never>>;
```

Those types are computed from the register's contents
(`packages/art/registry.ts:191-193`), and `scene`, `object` and `figure` are
deliberately empty (`packages/art/registry.ts:128-131`). A missing asset is a
compile error, never a fallback emoji or a grey box
(`packages/art/registry.ts:20-26`). So `Scene`, `SubjectArt` and any Natalie
still fail to typecheck at every call site, and will keep failing until someone
adds an entry — which `docs/design/art-direction.md:35-36` forbids before the
governing plate is approved, and the plates that matter are the two marked
**[cut-paper]**. No asset can be produced, commissioned, generated or registered
while this ADR is open. That is the correct state, and it is also a hard stop on
the six flagship compositions the brief wants approved first
(`docs/design/moyo-design-reset-v2-brief.md:142-153`).

**One fact that constrains every option.** The site's `moyo*` layer is web-only
by design: `packages/theme/build-css.mjs:153-159` says shipping it into
`theme-native.css` "would grow the mobile app's Uniwind registry with utilities
it can never use", and it is "the one place the two outputs deliberately diverge
in coverage rather than only in shape". Checked against the emitted files:
`--moyo-grain-opacity: 0.03` appears in `packages/theme/theme.css:449` and in no
line of `packages/theme/theme-native.css`. The grain the brief specifies has no
token on device today. "The app inherits the site's language"
(`docs/design/moyo-design-reset-v2-brief.md:27`) is therefore not literally
implementable on a phone whichever way this ADR goes.

## Options

| | What it does to the four clauses | Cost | Forecloses |
|---|---|---|---|
| **A — the pack holds** | Supersedes nothing. Doc 08:138, doc 02:158, :267 and :268 all stay as written. The reset's art register becomes ink-line drawing plus flat token fills. | The direction loses the thing the brief was built to buy. `docs/design/moyo-design-reset-v2-brief.md:63` names the problem it was answering — Duolingo, Khan, ClassDojo, Kit, GoHenry and Finch are all flat vector, and "a child cannot tell them apart in a screenshot". Ink-line plus flat fills is that register. | The `[cut-paper]` plates go: P8.5 (grain) and P8.14 (occlusion) are struck rather than deferred, and `docs/design/art-direction.md` §3's `scene` class stops being "a cut-paper world" and becomes a line-art container. Cardboard, tape and torn edge are gone for the life of the pack clause. Nothing is foreclosed on motion or on the name, because neither moves. |
| **B — supersede all four** | Doc 08:138's positive constraint, doc 02:158's name, :267's skeuomorph row and :268's ambient-motion row are all superseded by name; the brief's §3 direction is adopted as written, name included. | Four rank-1 clauses fall in one ADR, and two of them were not written about art. :268 is a motion rule that doc 08's one-task law (`docs/pack/08-visual-hierarchy-spacing-spec.md:43-44`) and the accessibility seat's reduced-motion mandate (`prompts/ROSTER.md:17`) both lean on. It also adopts a name whose token layer cannot load on the target: `--moyo-grain-opacity` exists in `packages/theme/theme.css:449` and not in `theme-native.css` (`packages/theme/build-css.mjs:153-159`), so "Tactile Learning" on device names an intent, not a token set. | Forecloses the cheap version of the parallax argument. Once :268 is superseded generally, every learner surface can claim scene-depth motion by citing this ADR, and the only remaining brake is the reduced-motion path — which is a per-asset review, not a structural rule. It also retires P8.15 (`docs/design/art-direction.md:1042`), which is currently marked **[either]** and bans learner parallax under both resolutions. |
| **C — scoped supersession** | Supersedes doc 08:138's positive constraint for the `scene`, `object` and `figure` classes only. Supersedes doc 02:267 only for grain applied to a hero *surface* through a token, never baked into a file. Keeps doc 02:158's name. Keeps doc 02:268 whole. | Two clauses survive that the brief wanted gone, so the brief's §3 ships partially: the register is cut paper, the language is still called Schoolhouse, and `Scene`'s parallax behaviour (`docs/design/moyo-design-reset-v2-brief.md:128`) is cut from the primitive on learner surfaces. Someone has to go back and edit the brief's §3 and the `Scene` spec rather than implement them. | Forecloses nothing that a later ADR could not reopen on its own evidence — each of the four is left in a stated position with a stated reason, so reopening one does not reopen the others. It does foreclose the marketing name governing the app, which means art-direction §2's inheritance table stays an inheritance of *values* (paper ground, warm ink, zero blur, the border ladder) rather than of a language. |

### What K–2 Today looks like under each

The composition under discussion is flagship #1
(`docs/design/moyo-design-reset-v2-brief.md:146`): a scene filling the top half,
the child's current object on the table, Natalie small at the side, one slab
reading "Let's finish the pizza."

**Under A.** The top half is a line drawing: table edge, bowl and five pizza
slices as outlined shapes at one stroke weight, three of them filled with a flat
token colour and two left as paper. Depth is expressed the way the rest of the
app expresses it, with a hard offset (`shadows.card`,
`packages/theme/tokens.ts:750`). It reads as a well-drawn colouring-book page. It
satisfies P8.1's pedagogical-job test — five slices, three shaded, is fifths —
and it satisfies the one-task rule the doc 08 clause exists to protect. What it
does not do is look unlike the six competitors named at `brief:63`.

**Under B.** The same table, built as cut paper: a paper ground, the table as a
torn-edge layer, the pizza as a separate layer passing behind the table edge,
Natalie as a third, with 2–4% grain over the hero surface and the layers
translating against each other as the child scrolls. The parallax is the part
that has to survive review, not the paper: it moves a learner surface for a
reason that has nothing to do with the child's own action, which is what
`docs/design/art-direction.md` P8.15's fail test refuses ("scroll the surface.
Any layer that translates relative to another fails"). And the grain has no
native token, so on the phone the hero would be flat regardless — the parallax
would ship and the material would not.

**Under C.** The cut-paper table, layered and occluding, one ink stroke weight,
fills from the token palette, hard-offset shadows, no gradient and no blur — and
it does not move. Scrolling translates the whole composition with the page, as
one image. Grain is a property of the surface under the art if and only if a
token resolves there, which today means the web surfaces only; on device the
material reads from the geometry — the torn edge, the occlusion, the offset — not
from a texture. Natalie is small and in the scene per art-direction §7's `k2`
row, which is the composition the brief asked for.

## Decision

**Option C, scoped supersession.** The recommendation to the design-system and platform-HIG seats is to supersede two of the four clauses narrowly and keep the other two whole. The four were written for different reasons and do not deserve one ruling between them.

### Supersede: doc 08 §6's positive constraint, for the three registered art classes only

`docs/pack/08-visual-hierarchy-spacing-spec.md:138` states its own reason: photography is banned on child learning surfaces because "decorative stock competes with the one-task rule and the tutor-presence signature", and illustration there is confined to ink-line plus flat token fills. The reason is aimed at art that competes with the task. It is not aimed at art that *is* the task.

That distinction is now enforceable rather than argued. `packages/art/registry.ts` admits an asset only with its class, alt string, band clearance and recorded provenance, and `docs/design/art-direction.md` §8's plate P8.1 fails any asset whose removal costs the screen nothing. A cut-paper bowl of five slices with three shaded does not compete with the one-task rule; it states the task. Under Option A the same screen is a line drawing of the same bowl, which passes the same pedagogical test and differs only in whether it is distinguishable from the six competitors named at `docs/design/moyo-design-reset-v2-brief.md:63`.

Superseded by name: the clause "illustration there is ink-line + flat token fills only" in `docs/pack/08-visual-hierarchy-spacing-spec.md` §6, and only as it applies to assets carried in `packages/art/registry.ts` under classes `scene`, `object` and `figure`. Everything else in §6 stays binding, including the photography ban on child learning surfaces at `:138` and the treatment spec at `:139` — every in-product image sits in an ink frame, `border-2 border-strong` with `radius-card` and `shadow-card`.

Doc 08 §6 does not mandate alt text anywhere; a search of the section returns no such requirement. Alt is carried beside each asset in `packages/art/registry.ts` because the register puts it there, not because a pack doc asks for it. That is a reset addition and should be read as one.

### Keep whole: doc 02 Addendum A's parallax ban

`docs/pack/02-adaptive-screens-design-spec.md:268` bans ambient and parallax motion on child surfaces. Its reason is motion on a child's screen, which has nothing to do with the medium of the artwork, so the argument above does not transfer. Nothing the reset needs depends on it: a scene teaches by what it depicts, not by moving when the device tilts.

`Scene`'s parallax slot is therefore unused on every learner band. `docs/design/art-direction.md` §7 P7.3 already states this as an outright ban rather than a motion-budget question, which is the correct reading and stays.

### Keep, with one narrow exception: doc 02 Addendum A's skeuomorph-texture ban

`:267` lists skeuomorph textures under Never. Paper grain baked into an asset file is exactly that, and stays banned — the register's assets ship on a transparent ground per `docs/design/art-direction.md` §2 C5, so a baked ground would also break dark mode.

The narrow exception is grain applied to a *surface* through a token, which is a different thing from a texture painted into a picture. Superseded by name for that case only: the "skeuomorph textures" entry in `docs/pack/02-adaptive-screens-design-spec.md` Addendum A §A.5, as it applies to `--moyo-grain-opacity` on a hero surface at 2–4%.

This exception buys nothing on device today and the seats should know that before ruling. The entire `moyo*` layer is web output only (`packages/theme/build-css.mjs:153-159`), so `--moyo-grain-opacity` resolves to nothing in `theme-native.css`. Granting it permits something that does not exist on the platform a learner uses. It is scoped this narrowly so that the grant does not quietly become a licence to bake texture into files, which is what would actually reach the phone.

### Keep whole: doc 02 §5's style name

`:158` names the app's language "Neubrutalism × Swiss (Schoolhouse)" and that name stays. Superseding a pack clause to change a label costs a supersession and buys nothing a reader can see. "Made at the kitchen table" is the working name of the art register in `docs/design/art-direction.md`, not a competing design language, and the reset brief's "Neubrutalism × Tactile Learning Modernism" stays what it accurately is — the site's ratio at `docs/site/tokens.md:37`, scoped to `apps/web-vite`.

## Consequences

**If the seats accept.**

1. `packages/art/registry.assert.ts:45-47` may be edited to admit entries in `scene`, `object` and `figure` — but only per class, as each class's plates are approved, and never all three at once. That edit is the record that a plate was approved, so it is made in the approving PR and nowhere else.
2. `docs/design/art-direction.md` §8: P8.14 (occlusion) unblocks. P8.5 (grain) unblocks for web hero surfaces only and stays blocked on device until a native grain token exists — OQ-1.
3. Flagship #1 (K–2 Today) can be composed with a cut-paper scene, no parallax, and no grain. Flagship #2 and #3 gain subject objects and manipulative art on the same terms.
4. `docs/design/reset/02-binding-constraints.md` C-9 and C-13 close, and their entries should be rewritten to point here rather than left open.

**What stays blocked either way, and is the real critical path.** `docs/design/art-direction.md` §5 OQ-2: there is no art-palette token set. The four hue families are primitive ramps and `packages/theme/tokens.ts:5-9` forbids feature code from naming them, so whether an asset may quote `brandScales.flame[400]` is undecided. No plate can be approved until it is, which means accepting this ADR does not by itself unblock a single asset. OQ-1, OQ-3, OQ-4 and OQ-5 sit behind it.

**If the seats reject and choose A.** The register keeps its three `never` classes for illustration and the reset ships ink-line plus flat token fills. Nothing in `packages/art`, the gate, or the six Mobbin passes is wasted; `docs/design/art-direction.md` §8's `[either]`-tagged plates all still hold, and only P8.5 and P8.14 are struck. Option A is a smaller change than the reset brief assumes, not a dead end.

## Status

**Proposed.** A draft for the design-system and platform-HIG seats to rule on (`prompts/ROSTER.md:13`, `:16`), reviewed by the accessibility seat under rule 4 (`:28`). Nothing here is in force. No plate may cite it and `packages/art/registry.assert.ts` may not be edited on the strength of it.

The Decision section was written by the reset pass, not by a seat. It is a recommendation with its reasoning exposed so that a seat can disagree with the reasoning rather than only with the outcome.
