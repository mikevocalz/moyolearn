# CRITIQUE: Moyo (marketing site and product apps)

<!--
The scored critique record for Moyo, kept per web-designer-pro's critique process. One critic for the
whole job, continued every round; scores are never edited after the round that produced them.
SOT: tooling/web-designer-pro/references/critique.md · DIRECTION.md
SOT-KEYWORDS: critique rubric rounds scores design-evidence shoot web-designer-pro
-->

Rubric, scale and stop rule are copied from `tooling/web-designer-pro/references/critique.md`
(§The rubric, §When to stop). If the two disagree,
that file wins.

## Scale

Each line is scored 1 to 5 with one sentence of evidence pointing at something visible. Clean and
correct is a 3; flat is a 3 at best. A 4 means it would ship at a top studio; a 5 means it goes in a
portfolio. Every line below 5 names the single change that would make it a 5.

## Rubric

| # | Line | 5 looks like | 2 looks like |
| --- | --- | --- | --- |
| 1 | Concept on the page | Cover the logo and you could still name the concept from any screen | A competent site of the category; the concept lives only in the doc |
| 2 | Not the category average | Nothing like the top three competitors, and better for it | Shares the category's structure, palette or type |
| 3 | Not a slop face, not this skill's rut | At most one feature of the four faces (slop.md) and at most two rut items (finish.md §7), each with a reason | A slop face; or dark + condensed + red + tool-first + a split hero again |
| 4 | First screen | Evidence, what it is and the action in the first viewport on desktop and phone; three planes, something crossing something | A slogan and a button beside a picture; nothing touches; the phone is a stack |
| 5 | Typography | Faces with a voice, scale contrast near 20:1 between display and labels, tuned tracking, comfortable measure, tabular figures | Default faces, sizes a step apart, loose display type |
| 6 | Colour | A palette you could name: one hot colour at full strength or an owned palette, concentrated in objects; dark mode designed (or declined on purpose) | Timid, arbitrary or confetti; colour spread thin over everything |
| 7 | Imagery | Directed images with one grade (photos, cut-outs, renders, a real product, or drawing at product quality) that belong to this product | Code-drawn stand-ins (dots, simple shapes) where images were needed; stock; placeholders |
| 8 | Depth and finish | Looks expensive next to the bar: layering, light inside objects, crafted gradients, concentric radii, grain where it belongs | Flat surfaces; or glows and gradients with no owner |
| 9 | Below the first screen | Every section has its own move or image; you want to keep scrolling | Rich hero, then type and hairlines for thousands of pixels |
| 10 | Craft | Nothing clipped or colliding, aligned to few verticals, real content, consistent icons, every state designed, nothing a stranger can't read | Misalignments, placeholder smell, broken states, gimmick props |
| 11 | Responsive | The phone is recomposed with the layering intact; tablet and wide screens hold | Desktop stacked into a column; awkward 768; a lonely column at 1920 |
| 12 | Everyone's computer | The matrix is clean: Windows scaling, Linux fonts, High Contrast, Firefox/Safari, l10n, reduced motion, keyboard focus | Sideways scroll on Windows, vanishing controls in High Contrast, wraps in German |
| 13 | Signature | One interaction or moment you would describe to a friend, born from the concept | None, or a generic animation |
| 14 | Copy and conversion | Every string specific and in the voice; the visitor knows what it is, why to believe it and what to do; the action says what happens | Brochure words, three-beat lists, "Get started", proof missing or invented |
| 15 | The screenshot test | A designer would save it to a mood board next to the bar | Nobody would remember it tomorrow |

A redesign also scores line 16, **Fidelity**: 5 = every kept item present and easier to find; 2 = items
missing.

**Done** when no line is below 3, at least 12 of 15 lines are at 4 or above, lines 4, 7, 8, 9, 10 and
14 are at 4 or above, and the scan and matrix show no FAIL. Budget: at least two rounds, at most four
(six when going for 5). A truthful 3 beats an inflated 4.

## Rounds

| Round | Date | Surface | Shots path | Scores (1-15) | The change that would make it a 5 |
| --- | --- | --- | --- | --- | --- |

## Declined asks

Each declined ask gets one line with its reason: it brings back a refused default (DIRECTION.md §2), undoes
an earlier ask from the same critic, breaks a hard rule, or creates a scan or matrix FAIL.

## How a round is run

1. Build and serve the surface, then shoot it into a numbered round folder:

   ```bash
   node tooling/web-designer-pro/scripts/shoot.mjs http://127.0.0.1:4173/ --out shots/r1 --wait 2500
   node tooling/web-designer-pro/scripts/matrix.mjs http://127.0.0.1:4173/ --out shots/r1/matrix
   ```

   Add `--app` for product screens and `--dark --widths 390,1440` for their dark pass. `shoot.mjs` exits 1
   on any scan FAIL; fix those before the critic sees the round.
2. Send the renders and `DIRECTION.md` to the same critic every round (`critique.md` §One critic). Wait for
   its reply before any design edit.
3. Record the row above: scores, the five changes, the change per line that would make it a 5, and next
   round, which asks landed.

CI's `design-evidence` job (`.github/workflows/ci.yml`) re-runs `shoot.mjs` and `matrix.mjs` against the
built web-vite site and the web app's `/login` on every PR and uploads the results as the `design-evidence`
artifact. A scan FAIL fails the build. CI evidence does not replace a critic round.
