<!-- Mobbin pass: tutor-room — focused problem-solving surface, all age bands -->
<!-- SOT-KEYWORDS: mobbin tutor room focus archetype canvas manipulative action bar completion -->

## Mobbin pass: tutor-room

Archetype: **Focus**. Progress rail, canvas ≥60% carrying the problem/manipulative, AI tutor docked to the side (never over the canvas), single action bar, completion reveal.

### Purpose

Where the actual work happens. Every band uses this screen; only the manipulative and the reading level change.

- **Where am I** — the progress rail. Not a percentage, a position: which step of how many, and an exit.
- **What matters now** — the canvas. One problem, one manipulative, nothing else competing for the eye.
- **What can I do** — manipulate the thing on the canvas, or use the single action in the bar. The tutor offers help; it does not become the task.
- **What changed after I acted** — the canvas itself changes state (tile snaps, block moves, number line marks) before any verbal feedback. The completion reveal names the skill practiced, not the points earned.

### References

| App | Screen | URL | Why it is relevant |
| --- | --- | --- | --- |
| Duolingo | Ratio-of-parts manipulative grid | https://mobbin.com/screens/7595a0d2-e20f-4098-98ad-8c70c39f451a | The closest indexed match to a real manipulative: a table of squares and triangles the learner reads to infer the missing ratio, with a `???` cell marking the target. Thin progress rail top-left with `×` exit, disabled `CHECK` bottom. Canvas carries the entire problem. |
| Brilliant | Bar chart question | https://mobbin.com/screens/e647b927-1cca-400a-971f-71ae2c0f206c | Question as one plain sentence, then a chart that *is* the problem, then a lot of deliberate empty space, then `Check`. A `Start over` affordance sits under the chart rather than in the action bar. |
| Google | Step-by-step math solution | https://mobbin.com/screens/8d10ee12-c96f-4289-9c80-0544e00c2d08 | The best reference for tutor content structure: `What you're solving for` / `What's given in the problem` / `Helpful information` / `Step 1`, with steps collapsed behind disclosures. This is what the docked tutor should say instead of a chat bubble. |
| Nibble | Match-pairs exercise | https://mobbin.com/screens/515b8f73-df48-4bfb-83b1-0529f8009c22 | Drag-to-match interaction where the answer slots stay visible as ghosted rows below the working area. Shows how to keep the target state and the working state on one canvas. |
| Coursera | Multiple-select quiz question | https://mobbin.com/screens/bb8a8717-781e-4484-8c05-0f909ecdbaf2 | `QUESTION 3/4` stated as text plus a segmented rail. Position named in words, which is more legible than a filled bar. |
| Apple News | Crossword grid with clue bar | https://mobbin.com/screens/57fcc0a4-5f6e-4253-ae06-fb09f14c11c6 | The grid owns the canvas; the current clue lives in a single-line strip docked directly above the keyboard, with `‹ ›` to move between clues. Direct precedent for docking the tutor as a strip that never overlaps the work. |
| Deepstash | Completion reveal listing what was covered | https://mobbin.com/screens/4ca7cfa2-d2d2-447d-b535-f8778e117130 | `Nice work` + "You've learned and practiced something new", then the named ideas covered, then one forward action. Completion framed as content, not score. |
| CapWords | Completion split into "Got it" and "Needs review" | https://mobbin.com/screens/b5fb0f43-642e-49fa-86ba-7d546cbbf4ed | Sorts the session's items into two named groups. Honest about what did not land without turning it into a failure count. |
| Uxcel Go | Lesson complete with metric rows | https://mobbin.com/screens/b133afa4-f09c-4997-8dee-4cb2114f9b58 | Included as the structural shape (mark, title, list, one primary action) whose *content* Moyo rejects. |

**Gaps.** Two searches did not produce usable results and no URLs have been substituted from memory:

- A dedicated **AI tutor with a docked companion character** screen. The nearest indexed thing is Google's math solver (https://mobbin.com/screens/8d10ee12-c96f-4289-9c80-0544e00c2d08), which is a step-by-step answer sheet with no character and no canvas, and Tolan (https://mobbin.com/screens/90722ad9-55fe-4a5d-8df2-de63dae1a2ff), which is a character with no work surface. Nothing on Mobbin appears to combine a 3D companion with a problem canvas — the side-docked Natalie is unreferenced and needs prototyping rather than borrowing.
- **Handwriting or ink-based math entry.** No result matched. The handwriting input surface has no Mobbin precedent in this pass.

### Take

- **Progress rail is a thin line plus an exit, nothing else** (Duolingo, Nibble). Left `×`, then the rail. No timer, no lives, no gem.
- **Name the position in words** (Coursera `QUESTION 3/4`). Legible at every band; a filled bar is not.
- **The canvas is the problem, not a picture of the problem** (Duolingo ratio grid, Brilliant chart). If a manipulative can carry the question, the question sentence gets shorter.
- **Keep the target state visible while working** (Nibble ghosted answer rows). The learner can always see the shape of a finished answer.
- **Dock help as a single strip that never covers the work** (Apple News clue bar). Natalie's utterance is one line in a docked strip with a disclosure to expand — not a bubble floating over the canvas, and not a transcript.
- **Structure tutor help as labelled sections, not conversation** (Google). `What you're solving for` / `What's given` / `Helpful information` / `Step 1`, steps collapsed by default. This is how Moyo avoids a chat transcript as the primary surface while still being a tutor.
- **`Start over` belongs near the canvas, not in the action bar** (Brilliant). The action bar holds exactly one thing.
- **Completion names what was covered** (Deepstash) **and splits it honestly** (CapWords). "Got it" and "Worth another look" — both neutral, both named.

### Refuse

- **`CLAIM XP` as the completion action, with XP / accuracy % / time tiles** — Duolingo (https://mobbin.com/screens/31fdc425-1a41-4b78-b4e6-762bff0b9306). Three engagement counters and a reward-collection verb. Engagement-pressure ban.
- **`Exercises 8 / XP earned 120 / Accuracy 100%` tile row** — Mimo (https://mobbin.com/screens/b96677c5-4f73-40ff-8dee-2bda19aed27e). Same rule; accuracy percentage on a child's completion screen is a grade delivered as a scoreboard.
- **`Pixels 305 / Accuracy 75% / Time 01:47` plus `Share lesson`** — Uxcel Go (https://mobbin.com/screens/b133afa4-f09c-4997-8dee-4cb2114f9b58). Timing a child and then inviting them to broadcast the result. Refused twice over.
- **Confetti burst and a large `75%` in a congratulations wreath** — CapWords (https://mobbin.com/screens/b5fb0f43-642e-49fa-86ba-7d546cbbf4ed). The two-group sort is adopted; the percentage and the confetti are not.
- **Glow, bloom, and sparkle particles around the completion badge** — Brilliant (https://mobbin.com/screens/3c3cb198-8f28-4ed3-84e0-d9607f4da700). No blur anywhere in the system.
- **Crying/pleading character art at completion** — Duolingo (https://mobbin.com/screens/31fdc425-1a41-4b78-b4e6-762bff0b9306). Emotional leverage from the mascot is exactly the shame-adjacent pressure the rules ban.
- **"You're one step closer to reaching your goals!"** — Mimo (https://mobbin.com/screens/b96677c5-4f73-40ff-8dee-2bda19aed27e). Generic goal-progress copy that says nothing about what the child actually did.
- **`Previous` / `Next` as twin equal-weight text buttons** — Coursera (https://mobbin.com/screens/bb8a8717-781e-4484-8c05-0f909ecdbaf2). Two actions of equal weight in the bar. The archetype allows one.
- **"Generative AI is experimental. Info quality may vary." disclaimer above the answer, and a `Are these results useful? Yes / No` bar over the content** — Google (https://mobbin.com/screens/8d10ee12-c96f-4289-9c80-0544e00c2d08). Structure adopted, framing refused: a child should not be asked to grade the tutor mid-problem, and a hedge banner above a math step teaches distrust of the explanation without giving them any way to check it.

### Mapping to Moyo tokens

| Slot | Token / treatment |
| --- | --- |
| Progress rail | 4px ink line on paper, filled portion in solid ink. Position label (`Step 2 of 5`) in Chivo Mono beside it. `×` exit at leading edge, ≥ 48px hit box. No shadow. |
| Canvas | ≥60% of viewport. Paper fill, 2px ink border, radius 0.375rem, hard offset shadow 4px 4px. Paper grain 2-4% — the canvas is the hero surface on this screen, so the grain lives here and nowhere else. |
| Problem statement | Space Grotesk, one or two lines, above the manipulative inside the canvas. Numerals and expressions in Chivo Mono. |
| Manipulative | The 25% tactile-materials budget lands here: fraction tiles, base-ten blocks, number line, cut-paper counters. Flat, ink-outlined, movable. This is the art class for this screen — no decorative scene. |
| Natalie (docked) | Side rail on wide viewports, bottom strip on narrow. Never overlaps the canvas; the canvas shrinks to make room rather than being covered. Small 3D bust with parallax on the rail only. |
| Tutor content | Google's section labels in Chivo Mono uppercase (`WHAT YOU'RE SOLVING FOR`, `WHAT'S GIVEN`, `STEP 1`), body in Space Grotesk, steps collapsed behind ink-bordered disclosures. No chat bubbles, no avatars-per-turn, no scrollback. |
| Action bar | One ink-filled button, Space Grotesk semibold, 2px ink border, hard offset shadow 4px 4px, radius 0.375rem. `Check` → `Next`. Disabled state is paper fill with ink border at 40%, shadow removed. |
| Secondary affordances | `Start over` and `Hint` as ink text buttons docked under the canvas, not in the action bar. |
| The single accent moment | The active cell or target slot on the manipulative — the `???` position, the tile being dragged, the mark on the number line. Accent follows the learner's attention. The action bar stays ink; the tutor rail stays neutral. |
| Completion reveal | Canvas stays in place and the reveal slides up as an ink-bordered panel over the action bar. Archivo Black headline naming the skill (`You solved equivalent fractions`), then two named groups — `Got it` / `Worth another look` — as ink-hairline rows. One ink-filled forward action. No numerals, no percentage, no confetti, no share. |
| Hard-offset shadow | Canvas, action bar button, completion panel. Not on the rail, not on tutor rows, not on the manipulative pieces (they read as flat paper on the canvas surface). |
| Touch targets | Manipulative pieces ≥ 64 x 64px at K-2, ≥ 48 x 48px at 6-12, with ≥ 12px separation. Action bar ≥ 56px tall. Disclosure rows ≥ 48px. Exit `×` ≥ 48px. |

### Open questions for critique

1. The docked-tutor pattern has no Mobbin precedent in this pass — nothing indexed combines a 3D companion with a problem canvas. Does Natalie need to be visible during the work at all, or should she appear only on request and on the completion reveal?
2. Apple News docks the clue strip above the keyboard. When Moyo needs handwriting or numeric input, does the tutor strip get pushed off-screen, and if so what replaces it?
3. Google's collapsed-steps structure is designed for a learner who already gave up. Does exposing `Step 1` on demand undercut the tutoring, and should the first disclosure be a question rather than a step?
4. `Got it` / `Worth another look` names the misses honestly. At ages 5-7, does naming a miss at all read as failure, or does omitting it make the reveal meaningless?
5. Brilliant leaves a large empty region between canvas and action bar. Is that emptiness doing work — a rest for the eye — or should the canvas expand to fill it?
6. The accent follows the active cell, which means the accent moves during the exercise. Does a moving accent still count as "exactly one accent moment per screen", or does that rule need a temporal clause?
7. Where does the exit go when a child abandons a problem mid-way? None of the references show what happens after `×` — Duolingo and Nibble both offer it and none of the indexed screens show the confirmation.
