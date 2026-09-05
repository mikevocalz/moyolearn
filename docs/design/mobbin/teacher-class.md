<!-- Mobbin pass: teacher-class — class workspace, list-detail, editorial-neubrutalist adult surface -->
<!-- SOT: packages/app/features/classes/classes-content.tsx · class-detail-content.tsx · student-detail-content.tsx -->
<!-- SOT-KEYWORDS: mobbin teacher class roster list detail headline pill outcome dots intervention -->

## Mobbin pass: teacher-class

Archetype: **List-detail**. Student rows carry a headline pill plus per-objective outcome dots. The detail pane holds the evidence strip and a suggested intervention that cites its own source.

### Purpose

A teacher scans this between activities with 20-30 rows on screen. It has to answer four questions:

- **Where am I** — which class, which objectives, which session or week. The objective set is named at the top because the dots below are meaningless without it.
- **What matters now** — the rows sort so the students needing a teacher come first, and each row's headline pill says in one or two words what kind of stuck they are. The dots say which objective.
- **What can I do** — selecting a row opens a detail pane with one suggested intervention, and that intervention shows the work it was derived from.
- **What changed after I acted** — the row's pill and dots update in place, the pane records that the intervention was taken, and the class-level counts move. The teacher stays in the list.

Every claim in the detail pane is a movement claim about that one student against the objective. No row ever displays the student's standing relative to the class.

### References

| App | Title | URL | Relevance |
| --- | --- | --- | --- |
| SchoolAI | Mission Control — live class roster | https://mobbin.com/screens/14950322-bbc7-4cea-90ed-66e9909b8468 | The archetype almost exactly: `Student / Headline / Outcomes` columns, headline pills (`Frustrated`, `Needs guidance`, `Enthusiastic`, `Curious`, `Highly engaged`), a plain-language sentence per row, coloured outcome dots, and a right-hand `Student insights` rail. |
| SchoolAI | Ended session summary | https://mobbin.com/screens/fcb8ba0f-a935-4abf-8d0c-25a5a466bb28 | Same table with a `Class mastery` header block: each outcome gets its own stacked bar with counts per band, and the insights rail is sectioned into `MISCONCEPTIONS` and `READY FOR MORE`. |
| SchoolAI | Smart Groups | https://mobbin.com/screens/7e71261b-469e-4bb4-bf36-68ff9d4aa7a9 | The same rows re-bucketed under named bands — `Beginning · Early understanding, more support needed`, `Developing`, `Proficient`, `Excelling`, `Not started` — each with an `n/3 students` count. Bands are described, not numbered. |
| SchoolAI | Student slide-over | https://mobbin.com/screens/914e5a09-007d-40b0-92ec-9da27470f891 | Detail pane over the list: student name, headline pill, the one-line summary, their dot row, then `Chat / Alerts / Insights` tabs. The list stays visible and selectable behind it. |
| SchoolAI | Preview & customize (outcome authoring) | https://mobbin.com/screens/3e4334f7-1136-44b7-96e9-4ac506c087a0 | Where the dots come from — outcomes are authored as full sentences (`Student articulates at least one personal reason connected to their topic.`). The dot column is a rendering of this list. |
| SchoolAI | Sign-in marketing panel | https://mobbin.com/screens/158172b0-b90e-4be1-b37f-d560db5d0286 | Six children's photographs stacked with coloured score blocks beside each, under `Know when they're struggling.` Cited for the refusal. |
| Kajabi | Customer Progress: Prototyping 101 | https://mobbin.com/screens/1227af09-4d68-457a-a7ea-a5596e2c3e4f | Per-person detail as a two-column split: identity and module progress on the left, the itemised artefact list with completion dates and thumbnails on the right. |
| Airwallex | Role details panel | https://mobbin.com/screens/20f6cf65-6657-48c5-8ab9-448a58540679 | Detail pane rendering per-capability outcomes as ✓/✗ marks grouped under section headings, with a per-section summary chip (`Partial access`, `No access`). Legible without colour. |
| Twenty | Companies list with record panel | https://mobbin.com/screens/86a114d8-1a8e-4795-a639-c8dda8ee916a | Dense list-detail on a flat, near-borderless table: the panel is a full-height column, not a floating card, and the selected row stays readable. |
| Circle | Course dashboard | https://mobbin.com/screens/8d64bd7b-02f4-4d61-9e20-7d1174de8433 | `PROGRESS 100% / 50%` bars plus a `LAST ACTIVE 5 minutes ago` column. Cited for the refusal. |
| Uxcel | Org dashboard | https://mobbin.com/screens/d273fc61-9308-48f1-939b-342ca762450d | `Top Performers` panel and a `Leaderboard` nav item alongside skill-graph radar. Cited for the refusal. |

### Take

- **Headline pill plus outcome dots as one row unit.** SchoolAI puts a named state and a per-objective mark on the same row (https://mobbin.com/screens/14950322-bbc7-4cea-90ed-66e9909b8468), so the teacher gets kind-of-stuck and which-objective in one fixation. Moyo takes the structure and swaps the vocabulary — the pill states trajectory (`Still working on it`, `Solved with help`, `Solved on their own`), never affect.
- **A plain-language sentence between pill and dots.** SchoolAI's middle column reads `Student intends to try a practice problem during math lessons to catch gaps`. It is what makes the row a claim rather than a score, and it survives having no colour.
- **Author objectives as sentences, render them as dots.** SchoolAI's outcome authoring (https://mobbin.com/screens/3e4334f7-1136-44b7-96e9-4ac506c087a0) is why its dot column is legible — every dot has a full sentence behind it, reachable from the column header's info affordance. Moyo does the same: the dot column header lists the objectives in full.
- **Section the intervention pane by what it is for.** The ended-session rail splits into `MISCONCEPTIONS` and `READY FOR MORE` (https://mobbin.com/screens/fcb8ba0f-a935-4abf-8d0c-25a5a466bb28). Moyo's pane splits into what the student is stuck on and what unsticks them, with the second citing the first.
- **Describe the bands, never number them.** Smart Groups labels each bucket with a sentence — `Beginning · Early understanding, more support needed` (https://mobbin.com/screens/7e71261b-469e-4bb4-bf36-68ff9d4aa7a9). Moyo's grouping uses the three permitted trajectory phrases as band names, so grouping cannot be read as ranking.
- **Detail as a pane over a live list, not a route change.** SchoolAI's slide-over (https://mobbin.com/screens/914e5a09-007d-40b0-92ec-9da27470f891) and Twenty's full-height panel (https://mobbin.com/screens/86a114d8-1a8e-4795-a639-c8dda8ee916a) both keep the roster selectable. The teacher moves student to student without losing scan position.
- **Redundant encoding on every outcome mark.** Airwallex uses ✓/✗ glyphs rather than colour alone (https://mobbin.com/screens/20f6cf65-6657-48c5-8ab9-448a58540679). Moyo's dots take a shape as well as a fill — filled, half, hollow — so they read in greyscale, in bright classroom light, and to a colour-blind teacher.
- **Evidence list with dates in the detail pane.** Kajabi lists each artefact with `Completed: 2024-11-05` and a thumbnail slot (https://mobbin.com/screens/1227af09-4d68-457a-a7ea-a5596e2c3e4f). Moyo's evidence strip is that list with the child's real work in the thumbnail.

### Refuse

| Reference | Pattern | Rule it breaks |
| --- | --- | --- |
| SchoolAI (https://mobbin.com/screens/14950322-bbc7-4cea-90ed-66e9909b8468) | Affect pills — `Frustrated`, `Enthusiastic`, `Curious`, `Highly engaged` | These label the child's emotional state and, in `Highly engaged`, their engagement level. Moyo's pills state trajectory against an objective only, in the three permitted phrases. |
| SchoolAI (https://mobbin.com/screens/fcb8ba0f-a935-4abf-8d0c-25a5a466bb28) | `Average mastery score 2.8` on a gauge as the class header | A single class score conflates movement with position and hands the teacher a number that ranks classes against each other. Replace with counts per trajectory phrase in Chivo Mono. |
| SchoolAI (https://mobbin.com/screens/7e71261b-469e-4bb4-bf36-68ff9d4aa7a9) | `Excelling · Ready for deeper challenges` as the top band of an ordered ladder | Ordering bands from Beginning to Excelling is a position ladder. Moyo's three bands are unordered states of a single objective. |
| SchoolAI (https://mobbin.com/screens/914e5a09-007d-40b0-92ec-9da27470f891) | A `Chat` tab in the student pane | No messaging surface may be designed — there is no messaging backend. The pane has evidence and intervention, no thread. |
| SchoolAI (https://mobbin.com/screens/158172b0-b90e-4be1-b37f-d560db5d0286) | Children's photographs in a vertical stack with numeric score blocks beside each | Faces plus adjacent scores in a column read as a leaderboard of children whatever the caption says. Moyo's roster uses initials in ink-bordered squares. |
| Circle (https://mobbin.com/screens/8d64bd7b-02f4-4d61-9e20-7d1174de8433) | `PROGRESS 100% / 50%` as the row's primary signal | A percentage is a position dressed as movement; 50% does not say whether the student can do the thing. Rows carry a trajectory phrase, not a percentage. |
| Circle (same screen) | `LAST ACTIVE 5 minutes ago` column | Presence surveillance is engagement pressure applied to a child. Evidence is dated by when the work was done, not by when the child was last seen. |
| Uxcel (https://mobbin.com/screens/d273fc61-9308-48f1-939b-342ca762450d) | `Top Performers` panel and `Leaderboard` nav | Position, explicitly. Banned on every Moyo surface. |
| Uxcel (same screen) | Radar skill graph as the header visualisation | A radar polygon is a shape comparison — it invites overlaying two students. Objectives get individual bars or counts, never a shared polygon. |
| Twenty (https://mobbin.com/screens/86a114d8-1a8e-4795-a639-c8dda8ee916a) | Borderless grey-on-white table with no row separation | Editorial-neubrutalist rows need an ink hairline and honest row height. Take the panel geometry, not the chrome. |

### Mapping to Moyo tokens

**Typefaces**

| Slot | Family | Token |
| --- | --- | --- |
| Class name, detail-pane student name | Archivo Black | `fonts.display` |
| Headline pill, row sentence, objective sentences, intervention body | Space Grotesk | `fonts.sans` |
| Per-band counts, `4 of 6`, evidence dates, session durations | Chivo Mono | `fonts.mono` via `--text-data` |

Objective sentences in the column-header expansion stay in Space Grotesk at `--text-caption-cool`. They are prose, not data.

**The single accent moment**

`bg-role-accent` / `on-role-accent` (teacher door) lands once, on the selected row's marker — a left edge rule or the row's leading square. Headline pills are ink-on-paper with an ink border, differentiated by their word and their dot pattern, not by hue. Outcome dots use ink fills at three densities plus shape, so the dot column never spends accent. In the detail pane the accent does not appear at all; the pane inherits selection identity from the row that opened it. `role-accent-underlay` may tint the selected row's background at 24% if the edge rule alone is too weak on a 30-row list.

**Hard-offset shadow**

Two slabs only: the detail pane and the evidence-strip frame inside it. The roster is a flat table — hairline rows on `--color-border`, no per-row elevation, no card-per-student. A shadowed card per row on a 30-student list turns the page into corduroy and destroys scanning.

Same token caveat as parent-home: `--shadow-card` resolves to `4px 4px 0 0 var(--color-border-strong)` at the root, but `.dial-cool` remaps it to `2px 2px 0 0 var(--color-border-faint)` (`packages/theme/theme.css:199,563`).

**Cool dial specifics**

Teacher-class is the densest adult surface and leans hardest on `.dial-cool`:

- `--dial-row` → `--spacing-row-cool` sets roster row height; this is the token to tune when the class size target changes, not per-row padding.
- `--color-border` → `--color-border-soft` (ink at 80%) for row hairlines; the detail pane's outer edge uses `--color-border-strong` so the pane separates from the list without a shadow doing the work.
- `--text-body` → `--text-body-cool` for row sentences, `--text-caption-cool` for objective labels and dates.
- `--spacing-inset-tight-cool` for pills and dot cells; `--spacing-inset-cool` for the detail pane's sections.
- `--radius-control` (`0.375rem`) on pills, filter chips, and the intervention's action button. `--radius-card` under Cool is `0.5rem` and applies only to the pane and the evidence frame.
- `--dial-duration` → `--duration-cool` on selection and pane transitions. A dense list punishes long transitions.

**Numerics in Chivo Mono**

Band counts (`8 still working on it`), the evidence strip's dates, and any `n of m` in the intervention. Column-aligned so counts stack. The class header is counts, never an average.

**Art class**

- Roster rows: no photography, no avatars. Initials in an ink-bordered square.
- Detail pane evidence strip: the student's own work thumbnails with dates, sourced from capture. This is the only imagery on the screen.
- Intervention block: type only. No icon set, no illustration.
- Empty class: bordered frame, plain sentence, one action. No mascot.

### Open questions for the design critique

1. **Dot column width at 8+ objectives.** SchoolAI shows three to five and still truncates the sentence column. Does Moyo cap the visible dots, scroll them horizontally, or collapse to a summary mark that expands in the pane?
2. **Sort order and its honesty.** Sorting `still working on it` to the top is useful triage, and it also puts the same children at the top every day, which a teacher may read as a ranking. Do we sort by trajectory, by staleness of evidence, or leave it unsorted with a filter?
3. **What replaces the class header number.** SchoolAI's gauge is refused. Three counts in Chivo Mono is the obvious substitute, but the header also needs to answer "is this class moving" without a trend line that implies a score.
4. **Where the intervention's citation goes.** Inline under the suggestion (Life Reset's habit), or as a tappable evidence thumbnail that opens the artefact? The second is stronger and costs a second interaction layer inside the pane.
5. **Pane vs. route on mobile web.** Airwallex and SchoolAI both assume desktop width. At phone width the pane has to become a route, which breaks "the list stays visible". Does the teacher class workspace ship phone-width at all, or is it tablet-and-up?
6. **Half-filled dot semantics.** `solved with help` maps naturally to a half dot, but half dots at small size are indistinguishable from filled at arm's length in a classroom. Test a hatch or a ring instead before committing.
7. **Whether `not started` is a fourth state.** The three permitted phrases all describe attempted work. A student who has not touched the objective is a real and common case that none of the three cover.
