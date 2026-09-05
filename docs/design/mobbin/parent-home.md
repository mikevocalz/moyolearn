<!-- Mobbin pass: parent-home — guardian home + child detail, editorial-neubrutalist adult surface -->
<!-- SOT: packages/app/features/home/parent-home-content.tsx · packages/app/features/home/parent-home.data.ts -->
<!-- SOT-KEYWORDS: mobbin parent home guardian child detail status hero evidence strip -->

## Mobbin pass: parent-home + child detail

Archetype: **Status hero**. A status band states what happened, why, and who acts next. Below it an evidence strip of the child's actual work. Then exactly one action. Details last.

### Purpose

The parent opens this screen between other things and gives it under a minute. It has to answer four questions in reading order:

- **Where am I** — whose week is this, which child, which dates. The child's name and the date range are the first two facts, not a chip buried under a greeting.
- **What matters now** — one status band, one sentence, in plain language: what happened, why we think so, who acts next. If nothing needs the parent, the band says so and stays quiet.
- **What can I do** — one action, ink-filled. Everything else on the screen is a link or a row, never a second filled button.
- **What changed after I acted** — the band rewrites itself to the new state and names the change. It never resets to a generic greeting.

Child detail is the same spine at higher resolution: the same band scoped to one child, then the evidence strip at full size, then the per-objective trajectory, then history.

### References

| App | Title | URL | Relevance |
| --- | --- | --- | --- |
| Greenlight | Family home | https://mobbin.com/screens/7e97e03a-4c8e-47f3-8aab-2798ba5514ab | Family home where the top third is a setup checklist and a `17% complete` bar; the child is below the fold. Shows exactly the failure mode we are avoiding. |
| GoHenry | Parent home | https://mobbin.com/screens/b40b68b8-c923-4155-8a8f-12983e659ad8 | Parent balance hero, then a per-child row carrying its own inline exception state (`Activate card`) — the exception rides the child, not a global banner. |
| GoHenry | Child earning detail | https://mobbin.com/screens/8c96f881-62da-4f5f-842d-0325a3e06555 | Child detail done as headline sentence (`— is earning £10.50`), a segmented bar with a named legend (Allowance / Tasks done / To do), then the itemised rows that produced the number. |
| Garmin Connect | Child Account (in `Authorized viewers` flow) | https://mobbin.com/flows/090f7530-e796-41ec-88cc-4be4c61dd25d | Child account screen leads with an `Attention required` band that states the consequence (`Some Garmin features may not work for your child until you provide permission`) and links to the one action that clears it. |
| Life Reset | Your Improvements | https://mobbin.com/screens/80acaaf1-2909-4841-ba90-52a8ccb7f1ff | Every delta chip is followed by its own source line — `+15% Focus … because you reduced screen time for 3 days, made progress in deep-breathe (3% / 1 days), woke up early for 4 days`. A claim and its evidence in the same block. |
| Locket | Photo with filmstrip | https://mobbin.com/screens/242fb46e-4d78-4fb9-b332-54406e86d80e | One real artefact large with its timestamp, a filmstrip of the neighbouring artefacts underneath, current position marked. An evidence strip that stays browsable without becoming a gallery. |
| 7shifts | Here's what's happening | https://mobbin.com/screens/e55e19c6-9d9a-463a-9279-b0070ab0fd25 | Adult ops home whose title is a sentence, with each outstanding item as its own row carrying its own scoped button. |
| Docusign | Home | https://mobbin.com/screens/355a55bc-0456-40d4-8df8-ee4bdf865538 | Three stacked promo bars above the fold and four co-equal CTAs in the hero. Cited for the refusal. |
| Ahead | Emotion management skills | https://mobbin.com/screens/26e848ed-2272-470d-8a78-8444b98e79eb | XP bars per skill, `Daily streak`, and a `Compare how you see yourself with how your friends see you` card. Cited for the refusal. |

### Take

- **Lead with the sentence, not the greeting.** GoHenry's child detail opens `— is earning £10.50 · To be paid on Saturday` (https://mobbin.com/screens/8c96f881-62da-4f5f-842d-0325a3e06555). Moyo's band gets the same shape: `Amara solved 4 of 6 fraction problems on her own this week. Two still need help.` Display type, one sentence, no preamble.
- **Bind the claim to its source in the same block.** Life Reset appends `because you …` directly under each delta (https://mobbin.com/screens/80acaaf1-2909-4841-ba90-52a8ccb7f1ff). Every Moyo trajectory line carries its own citation — which session, which date, which piece of work — so the parent can tap through from the claim to the artefact that produced it.
- **Give the exception to the child, not to the page.** GoHenry's `Activate card` sits inside the child's row (https://mobbin.com/screens/b40b68b8-c923-4155-8a8f-12983e659ad8) and Garmin's `Attention required` sits inside the child account (https://mobbin.com/flows/090f7530-e796-41ec-88cc-4be4c61dd25d). With two or three children on one home, a global banner cannot say who it means. Scope the band to the child.
- **State the consequence, then the action.** Garmin's band names what breaks before it offers `Review Permissions`. Moyo's band names what the child is stuck on before it offers the action that unsticks them.
- **Name the segments of any bar.** GoHenry's earning bar has a three-item legend under it. A Moyo trajectory bar is unreadable without `solved on their own` / `solved with help` / `still working on it` written out beside their swatches.
- **Show one artefact large, the rest as a strip.** Locket puts the selected photo at full width with its time and the neighbours as a filmstrip below (https://mobbin.com/screens/242fb46e-4d78-4fb9-b332-54406e86d80e). The child-detail evidence strip takes that: newest work large with its date, four to six thumbnails beneath, tap to promote.
- **One scoped button per row on the ops-style list.** 7shifts keeps `Invite employees` on the invite row rather than promoting it to the header (https://mobbin.com/screens/e55e19c6-9d9a-463a-9279-b0070ab0fd25). Parent-home's secondary rows follow the same rule so the single ink-filled button stays unambiguous.

### Refuse

| Reference | Pattern | Rule it breaks |
| --- | --- | --- |
| Greenlight (https://mobbin.com/screens/7e97e03a-4c8e-47f3-8aab-2798ba5514ab) | `Get started with these simple steps` carousel plus a `17% complete` account-setup bar occupying the top third | Setup completion is the company's progress, not the child's. The status band belongs to the child's work. Setup goes into the band's action slot only when it is genuinely blocking, and then as one row, not a carousel. |
| Greenlight (same screen) | `Invite friends, get up to $600!` above the child | Engagement-pressure and referral mechanics are banned on all adult surfaces. |
| Ahead (https://mobbin.com/screens/26e848ed-2272-470d-8a78-8444b98e79eb) | `Daily streak`, `3/33 daily activities completed`, XP-to-2500 bars | Streaks and quota bars are engagement pressure, and they encode volume rather than whether the child can now do the thing. Movement is reported as `solved on their own` / `solved with help` / `still working on it`. |
| Ahead (same screen) | `Compare how you see yourself with how your friends see you` | Position never appears on a Moyo adult surface, and a child is never compared to peers. |
| Docusign (https://mobbin.com/screens/355a55bc-0456-40d4-8df8-ee4bdf865538) | Three stacked notification/promo bars, then four equal-weight hero CTAs | One action per screen, one ink-filled button. Stacked banners also destroy the single status band — the parent can no longer tell which line is the real state. |
| GoHenry (https://mobbin.com/screens/b40b68b8-c923-4155-8a8f-12983e659ad8) | The `Get set up 10%` ring competing with the balance hero for the accent | Exactly one role-accent moment per screen. The accent goes on the child's status, never on account plumbing. |
| Life Reset (https://mobbin.com/screens/80acaaf1-2909-4841-ba90-52a8ccb7f1ff) | `+15% ▲` percentage deltas on human capacities, and an `I'm procrastinating` self-report button | A percentage delta on a child's learning is a movement claim dressed as precision, and it invites reading as rank. Keep the citation habit, drop the percentage. |
| Locket (https://mobbin.com/screens/242fb46e-4d78-4fb9-b332-54406e86d80e) | Full-bleed edge-to-edge imagery as the page's surface | Adult surfaces stay ink-on-paper with bordered slabs. Photography appears inside a bordered frame, never as the page background. |

### Mapping to Moyo tokens

**Typefaces**

| Slot | Family | Token |
| --- | --- | --- |
| Band sentence (child name + what happened) | Archivo Black | `fonts.display` → `--font-display` |
| Band reason line, row labels, body | Space Grotesk | `fonts.sans` |
| Counts, dates, session durations, `4 of 6` | Chivo Mono | `fonts.mono` via `--text-data` / `--text-data-lg` |

Never set the band sentence in mono to make it feel data-like. Numerals inside a display sentence stay in Archivo Black; standalone numerics get Chivo Mono.

**The single accent moment**

`bg-role-accent` / `text-on-role-accent` (`role-accent` = `palette.burgundy[400]`, guardian door) lands once, on the status band's state marker — the pill or the left edge rule of the band. Nothing else on parent-home takes the accent: not the action button, not the evidence strip, not the row chevrons. On child detail the accent moves to the objective the band is talking about and disappears from the page-level band, so the two never both carry it. `role-accent-underlay` (`rgba(255, 219, 51, 0.24)`) is available for the band's fill when the marker alone reads too thin; `tooling/check-role-accent.mjs` keeps the accent out of body text.

**Hard-offset shadow**

Reserve elevation for the two slabs that are meant to be picked up: the status band and the evidence-strip frame. Rows, chips, and the objective list stay flat with a `--color-border` hairline. The ink-filled action button is flat — a filled button plus an offset shadow reads as two elevation claims on one control.

Note the token reality: `--shadow-card` is `4px 4px 0 0 var(--color-border-strong)` at the root and under `.dial-hot`, but `.dial-cool` remaps it to `--shadow-cool`, which is `2px 2px 0 0 var(--color-border-faint)` (`packages/theme/theme.css:199,563`). An adult surface asking for a 4px 4px hard offset therefore needs the base `--shadow-card` value, not the Cool remap. This is an open question below, not a decision.

**Cool dial specifics**

Parent-home ships inside `.dial-cool`:

- `--radius-card` / `--radius-sheet` → `--radius-cool` (`0.5rem`); every interactive control stays on `--radius-control` (`0.375rem`), which the dial does not touch.
- `--color-border` → `--color-border-soft` (ink at 80%), so the hairline recedes and the two shadowed slabs carry the whole elevation story.
- Type steps drop to the `-cool` variants: `title` `1.0625rem/1.3/600` against Hot's `1.25rem/1.3/700`, `body` and `caption` likewise. The band sentence still sits at `title-lg` — density comes from everything under it, not from shrinking the one line the parent reads.
- `--dial-row`, `--spacing-stack`, `--spacing-group` take their `-cool` values; the evidence strip gets `--spacing-group-cool` above and below to stay a distinct band rather than a run of rows.
- `--dial-duration` → `--duration-cool` for the band's state transition after an action.

**Art class**

- Status band: none. Type and one accent marker.
- Evidence strip: the child's own work thumbnails only — photographed worksheets, captured problems, drawings. No stock, no illustration, no avatar placeholder.
- Empty evidence strip: bordered frame with a plain sentence, no spot illustration. Greenlight, Evernote, and Xero all reach for a mascot here; adult Moyo does not.
- Child identity: real photography if the family uploaded one, otherwise initials in an ink-bordered square. No cartoon avatar on an adult surface.

### Open questions for the design critique

1. **The 4px/2px shadow conflict.** The adult spec says 4px 4px hard offset; `.dial-cool` currently remaps `--shadow-card` to `2px 2px` in `--color-border-faint`. Which wins — do adult surfaces override the Cool shadow back to `--shadow-card`'s base value, or does the spec move to 2px for Cool and keep 4px for Hot?
2. **Multi-child homes.** With three children, three scoped status bands means three accent moments, which breaks the one-accent rule. Options: a single roll-up band plus flat per-child rows, a "child of the moment" band chosen by urgency, or accent only on the band that needs action. GoHenry sidesteps this by having one child.
3. **Where the single action lives when children disagree.** If child A needs a review and child B needs a session booked, which action is the ink-filled one, and does the loser degrade to a row link or vanish?
4. **How far back the evidence strip reaches.** Locket's filmstrip is unbounded. A week? The current objective? Everything since the last time the parent opened it? The answer changes whether the strip needs a date header.
5. **Trajectory bar vs. three counts.** GoHenry's segmented bar is compact but reads as a proportion, which is one hop from a score. Three Chivo Mono counts with their labels are unambiguous and take more vertical space. Which does the band use, and does child detail use the other?
6. **What the band says when nothing happened.** A child who did no work this week. The band must not imply fault, must not nag, and must not go blank. Draft copy needed before build.
7. **Whether the band's citation is tappable on parent-home** or only on child detail. Tappable citations on home make the band two controls deep, which pushes against one-action.
