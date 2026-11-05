# Critique

The designer always grades too kindly: they see what they meant. Whenever
possible the critique is done by **fresh eyes**, a separate agent that sees
the rendered PNGs, not the reasoning.

A critic with no picture of great work grades against "no slop and no
bugs", and that passes flat pages. In testing, the first version's critic
called four flat sites "done" with Craft stuck at 3. This critic is given
the bar (finish.md §1) and told that clean and correct is a 3.

## One critic, for the whole job

Spawn the critic **once** and keep talking to the same agent every round
(continue it with SendMessage, or your harness's equivalent). A new critic
each round brings new taste, reverses the last one's asks, and the scores
never converge. **Wait for the critique before editing** (design edits;
obvious mechanical bugs are fixed before round 1). The critic's reply comes
back to you as a message; do nothing to the page until it arrives.

**In Codex without sub-agents**, the critic is a fresh `codex exec` that
sees only the PNGs and the brief, never your reasoning:

```bash
codex exec --skip-git-repo-check -s read-only -i shots/r1/1440.png -i shots/r1/390-full.png -i shots/r1/sheet.png "<first message below>"
codex exec resume <session id it printed> -i shots/r2/1440.png -i shots/r2/sheet.png "<round 2: what changed>"
```

Keep the session id and resume the same one every round.

## First message to the critic

> You are a design director at a studio known for award-winning websites and
> web apps. You will critique one <site / web app> over several rounds.
>
> The bar is the work designers save to their mood boards, described in
> <skill>/references/finish.md §1 (read it): giant type locked together
> with photos and colour blocks, cards that break the headline, cut-outs on
> a hot colour, grain; soft lit objects (cards glowing from inside, glass
> orbs, dusk grounds) on calm interfaces; depth on every screen; one owned
> colour. Clean and correct is a 3. Flat is a 3 at best, however tidy.
> The bar, as images (open them first): the kit shots in
> <skill>/assets/kits/shots/ and the user's references, if any: <paths>.
> For every score, ask: would this sit next to those and hold up?
>
> First, look at every screen as a stranger: name anything whose purpose
> you cannot tell without the concept explained. Each one is a defect.
>
> Concept: "<concept sentence>"
> Who it is for and what they come to do: <from the brief>
> Colour system (what each colour means, who owns each hue): <from DIRECTION.md>
> Refused defaults (deliberate; do not ask for them back): <the category
> default and the slop faces refused, from DIRECTION.md>
> Rut items used, with reasons: <finish.md §7 list from DIRECTION.md>
> Rubric: <skill>/references/critique.md and the four slop faces in
> <skill>/references/slop.md.
> Round 1 renders (open every one at full size):
> - first screens at 390, 768, 1280, 1440: <paths>
> - every numbered full-page slice at 390 and the widest: <paths>
> - dark, if any; the matrix sheet; the signature's filmstrip strip.png
>
> Score each rubric line 1 to 5 with one sentence of evidence pointing at
> something visible. Score **the page below the first screen** on its own
> (line 9); do not let the hero carry it. For every line below 5, name the
> single change that would make it a 5. Then list the five changes that
> would raise the lowest scores most, each specific enough to execute
> (which section, which element, what value, what words). A 4 means you
> would ship it at a top studio; a 5 means it goes in your portfolio. Judge
> pixels and words, not intentions. Quote any string a person would not say.
> End with one line: "Done / not done by the stop rule".

For a **redesign**, add: "Before: <PNG paths>. Must keep: <keep list>." and
score a 16th line, **Fidelity**: 5 = every kept item present and easier to
find; 2 = items missing.

Each later round: "Round N. What changed, and which asks I declined with
reasons: <list>. New renders: <paths>. Rescore, say which asks landed, give
the next five."

## Declining an ask

Decline, with a one-line reason in CRITIQUE.md, any ask that brings back a
refused default, undoes an earlier ask from the same critic, or breaks a
hard rule. Also decline asks that fill every quiet area with something: one
generous rest per page is a decision (layout.md), not a gap to fix. Tell
the critic, so it stops asking.

## When asks conflict

The scan's and matrix's FAILs win over any ask. A critic's ask that creates
a FAIL (labels that clip, text that collides) is declined with the reason.
When two asks from the critic conflict, tell it, and ask which it would
keep. Warns may be overridden by a critic's ask with a one-line reason.

## The rubric

| # | Line | 5 looks like | 2 looks like |
|---|---|---|---|
| 1 | **Concept on the page** | Cover the logo and you could still name the concept from any screen | A competent site of the category; the concept lives only in the doc |
| 2 | **Not the category average** | Nothing like the top three competitors, and better for it | Shares the category's structure, palette or type |
| 3 | **Not a slop face, not this skill's rut** | At most one feature of the four faces (slop.md) and at most two rut items (finish.md §7), each with a reason | A slop face; or dark + condensed + red + tool-first + a split hero again |
| 4 | **First screen** | Evidence, what it is and the action in the first viewport on desktop *and* phone; three planes, something crossing something | A slogan and a button beside a picture; nothing touches; the phone is a stack |
| 5 | **Typography** | Faces with a voice, scale contrast near 20:1 between display and labels, tuned tracking, comfortable measure, tabular figures | Default faces, sizes a step apart, loose display type |
| 6 | **Colour** | A palette you could name: one hot colour at full strength or an owned palette, concentrated in objects; dark mode designed (or declined on purpose) | Timid, arbitrary or confetti; colour spread thin over everything |
| 7 | **Imagery** | Directed images with one grade (photos, cut-outs, renders, a real product, or drawing at product quality) that belong to this product | Code-drawn stand-ins (dots, simple shapes) where images were needed; stock; placeholders |
| 8 | **Depth and finish** | Looks expensive next to the bar: layering, light inside objects, crafted gradients, concentric radii, grain where it belongs | Flat surfaces; or glows and gradients with no owner |
| 9 | **Below the first screen** | Every section has its own move or image; you want to keep scrolling | Rich hero, then type and hairlines for thousands of pixels |
| 10 | **Craft** | Nothing clipped or colliding, aligned to few verticals, real content, consistent icons, every state designed, nothing a stranger can't read | Misalignments, placeholder smell, broken states, gimmick props |
| 11 | **Responsive** | The phone is recomposed with the layering intact; tablet and wide screens hold | Desktop stacked into a column; awkward 768; a lonely column at 1920 |
| 12 | **Everyone's computer** | The matrix is clean: Windows scaling, Linux fonts, High Contrast, Firefox/Safari, l10n, reduced motion, keyboard focus | Sideways scroll on Windows, vanishing controls in High Contrast, wraps in German |
| 13 | **Signature** | One interaction or moment you would describe to a friend, born from the concept | None, or a generic animation |
| 14 | **Copy and conversion** | Every string specific and in the voice; the visitor knows what it is, why to believe it and what to do; the action says what happens | Brochure words, three-beat lists, "Get started", proof missing or invented |
| 15 | **The screenshot test** | A designer would save it to a mood board next to the bar | Nobody would remember it tomorrow |

## When to stop

- **Done:** no line below 3; at least 12 of 15 lines at 4 or above; lines
  4 (First screen), 7 (Imagery), 8 (Depth and finish), 9 (Below the first
  screen), 10 (Craft) and 14 (Copy) at 4 or above; and the scan and matrix
  have no FAILs.
- **Plateau:** two rounds with no score change: make one structural change
  (a different first screen, a different richness source, a layering move
  the page lacks) and run one more round, or stop.
- **After done:** fix the concrete defects the critic still named, once.
  Verify them with the scan, the matrix and your own eye, list them in
  CRITIQUE.md as "fixed after the last round, not rescored", and stop.
- **Going for 5:** once done, if there is time, run up to two more rounds
  on the critic's "change that would make it a 5" list, lowest lines first.
  Never call a line a 5 that the critic did not score 5.
- **Budget:** at least two rounds, at most four (six when going for 5).
  Then report the honest scores. A truthful 3 is worth more than an
  inflated 4.
- **No way to continue the critic:** start a new one with the previous
  CRITIQUE.md, and tell it to judge whether those asks landed.

## Writing CRITIQUE.md

Per round: the scores table, the five changes, the "change that would make
it a 5" per line, and after the next round, whether each landed. Keep the
history; the trend is the evidence.
