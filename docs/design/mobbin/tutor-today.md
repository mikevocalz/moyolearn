<!-- Mobbin pass: tutor-today — tutor day plan + school ops funnel, invitation into list-detail -->
<!-- SOT: packages/app/features/home/tutor-today-content.tsx · tutor-today.data.ts · features/session-prep · features/home/school-home-screen.tsx -->
<!-- SOT-KEYWORDS: mobbin tutor today day plan next session hero prepare session summary school ops funnel queue -->

## Mobbin pass: tutor-today + school ops

Archetype: **Invitation into List-detail**. Today's sessions read as a day plan. A next-session hero carries the learner context. Below it the prepare → session → summary queue. The school variant swaps the hero for a state funnel (Invited → Provisioned → Active → Needs attention) above a queue with scoped detail.

### Purpose

The tutor opens this on a phone, minutes before teaching. The school admin opens it on a desktop, once a week, to clear a backlog. Both need the same four answers:

- **Where am I** — today's date and the tutor's own day, or the school's current onboarding state. Not a generic home.
- **What matters now** — the next session, named, with the learner's context attached. For school ops, the funnel stage that has items stuck in it.
- **What can I do** — one action on the hero (`Prepare`, then `Start`, then `Write summary`), and one scoped action per queue row.
- **What changed after I acted** — the hero advances to the next session and the completed one drops into the done segment; the funnel counts move and the row leaves its stage. The tutor sees their day shrink.

The hero is an invitation, not a countdown. It says what is next and offers the one thing to do about it.

### References

| App | Title | URL | Relevance |
| --- | --- | --- | --- |
| Zocdoc | Appointments — `Up next` | https://mobbin.com/screens/14e7f095-1b94-4e03-96e3-1b3fec5c9aa5 | The next-session hero in its cleanest form: `Up next` label, full date and time in display type, who and what (`Dr. Anjelica Peacock · Dermatologist – Acne`), context in the card, one text link into detail, one bordered secondary action below. |
| Jobber | Today's appointments | https://mobbin.com/screens/3fe4fcd0-f1c7-4655-9c27-621ec11d5a3d | The whole day as one list under a `Completed / Active / To Go` segmented control, each row carrying its own state chip and time range. The prepare → session → summary queue, already built. |
| Future Pro | Scheduling a call with coach (flow) | https://mobbin.com/flows/87803b30-1b48-4835-a239-7684250cb196 | Home built around a single named upcoming session (`Kickoff Call with Aurelia · Fri, Oct 4 at 3:45 AM`) with a checklist above it and one action on the card. Also the countdown, cited for the refusal. |
| Peloton | Workout notes (flow) | https://mobbin.com/flows/59c5f7f9-e672-4d85-9e17-b14cf1a4570c | The coach's own notes surfaced as a labelled chip inside the running session and opened as a sheet without leaving it. The model for learner context during a session. |
| Equinox+ | Add a note (flow) | https://mobbin.com/flows/3b88f4d6-c12d-4348-964b-64f196611b51 | Post-session summary as a sheet with a free-text field and an explicit `Share with coach` checkbox, so writing and disclosing are separate decisions. |
| Amie | Day timeline | https://mobbin.com/screens/7314f0f2-23dd-47d0-938f-ead2b2505b1b | Time-ruled day with a now-line across it, blocks sized to duration, and a list of scoped groups underneath the fold. |
| Slack | Invitations | https://mobbin.com/screens/2fe9271e-36ed-4333-b809-6078dc790098 | State funnel as tabs (`Requests / Pending / Accepted / Invite Links`) over one queue, and per-row exception state carried inline (`— email address bounced`) with its two scoped actions (`Invitation resent`, `Revoke`). |
| Fiverr | Account members | https://mobbin.com/screens/c7f70e26-e07b-405e-a148-c7cb5c9abc0a | The same funnel as stacked labelled sections with counts (`Pending (1)`, `Joined (1)`), each its own table with its own columns. No tab state to lose. |
| 15Five | People / invitations | https://mobbin.com/screens/c2d103be-a9aa-4755-a0bc-8e269678ede5 | Three stacked queues — `Created people`, `Pending invitations`, `Expired invitations` — each with `Actions` and `Filter by`, plus a seat-capacity band scoped to the pending table. |
| Copilot | Team | https://mobbin.com/screens/6cd14492-9ff4-4564-80ee-d848043aba7b | The compact alternative: one table, a `Status` column with `Invited` / `Active` pills, and the funnel implied by the column rather than by structure. |
| Pipedrive | Deals pipeline | https://mobbin.com/screens/2ff3c977-7902-48b5-8361-0c89710e5c2e | Stage columns each headed by a count and a total, with a per-card warning glyph marking the stalled ones. Cited for both take and refusal. |
| Rox | Opportunities board | https://mobbin.com/screens/1afa393c-87c4-4ce4-a4c5-654a3fe3a3c4 | The same board with almost every stage at zero — four columns of `No opportunities`. The empty-funnel case a school will hit in week one. |

### Take

- **Label the hero with its role, then the facts.** Zocdoc's `Up next` sits above the date, and the date is the largest thing on the card (https://mobbin.com/screens/14e7f095-1b94-4e03-96e3-1b3fec5c9aa5). Moyo's hero: `Next session` / `Today, 4:35pm` in display type / learner name and objective / one action.
- **Put the learner context inside the hero, not one tap away.** Zocdoc puts a map in the card because location is the context that matters for a clinic visit. For Moyo the equivalent is what the learner is working on and what happened last time — two lines, in the hero, before the tutor taps anything.
- **One segmented control owns the whole day.** Jobber's `Completed / Active / To Go` (https://mobbin.com/screens/3fe4fcd0-f1c7-4655-9c27-621ec11d5a3d) is exactly prepare → session → summary with the tenses swapped. One list, three filters, state chips on rows. It also means the day visibly shrinks, which is the "what changed after I acted" answer.
- **Coach context as a labelled chip inside the session.** Peloton surfaces `TUNDE'S NOTES` as a chip that opens a sheet without ending the workout (https://mobbin.com/flows/59c5f7f9-e672-4d85-9e17-b14cf1a4570c). The tutor's in-session view gets the same for the learner's prior-session summary.
- **Separate writing the summary from sharing it.** Equinox+ puts `Share with coach` as an explicit unchecked box beside the note (https://mobbin.com/flows/3b88f4d6-c12d-4348-964b-64f196611b51). A tutor's raw observations and what the guardian sees are different artefacts; the checkbox makes that a deliberate act rather than a default.
- **Funnel as stacked labelled sections with counts.** Fiverr (https://mobbin.com/screens/c7f70e26-e07b-405e-a148-c7cb5c9abc0a) and 15Five (https://mobbin.com/screens/c2d103be-a9aa-4755-a0bc-8e269678ede5) both stack the stages vertically rather than hiding three behind tabs. The admin sees all four counts in one scroll, and there is no tab state to restore.
- **Exception state rides the row.** Slack's bounced invite carries its reason and both its remedies inline (https://mobbin.com/screens/2fe9271e-36ed-4333-b809-6078dc790098). `Needs attention` is not a separate stage to visit — it is a row in whichever stage it stalled in, marked and actionable there. Pipedrive does the same with its per-card warning glyph (https://mobbin.com/screens/2ff3c977-7902-48b5-8361-0c89710e5c2e).
- **Scope a capacity or policy band to the table it constrains.** 15Five's `3 of 2000 remaining seats available` sits inside the pending-invitations section, not at page top. Moyo's licence and consent bands do the same.
- **Design the empty funnel first.** Rox shows four stages reading `No opportunities` (https://mobbin.com/screens/1afa393c-87c4-4ce4-a4c5-654a3fe3a3c4). A new school sees this on day one. The stacked-sections layout degrades better here than columns do — an empty section collapses to a one-line count.

### Refuse

| Reference | Pattern | Rule it breaks |
| --- | --- | --- |
| Future Pro (https://mobbin.com/flows/87803b30-1b48-4835-a239-7684250cb196) | Live countdown on the hero — `01D 10H 46M 40S` | Engagement-pressure mechanic. The hero states when the session is; it does not tick at the tutor. |
| Future Pro (same flow) | Full-bleed photography behind the hero copy with a gradient scrim | Adult surfaces are ink on paper. Photography lives inside a bordered frame; text never sits on an image. |
| Future Pro (same flow) | A `Messages` tab in the bottom bar | No messaging surface may be designed. Tutor ↔ guardian communication has no backend and gets no navigation slot. |
| Equinox+ (https://mobbin.com/flows/3b88f4d6-c12d-4348-964b-64f196611b51) | The summary sheet dimmed over a full-bleed portrait, `Week 1 of 4 · 0 of 3 sessions complete, 8d left` | The countdown-to-deadline framing is engagement pressure, and a program-completion quota measures attendance, not whether the learner can do the thing. |
| Peloton (https://mobbin.com/flows/59c5f7f9-e672-4d85-9e17-b14cf1a4570c) | `0/7 Blocks` progress pips and `SWIPE TO COMPLETE` | Completion quotas on a session. A tutor session ends when the work is done or the time is up, not when a block counter fills. |
| Slack (https://mobbin.com/screens/2fe9271e-36ed-4333-b809-6078dc790098) | Four stages behind tabs | Hiding three of four funnel counts behind tab state means the admin cannot see where the backlog is without clicking. Stack the sections instead. |
| Pipedrive (https://mobbin.com/screens/2ff3c977-7902-48b5-8361-0c89710e5c2e) | Monetary totals per stage as the column header (`$30,000 · 1 deal`) | A school funnel headed by revenue turns children into pipeline value on the screen a school admin uses daily. Headers carry counts only. |
| Pipedrive (same screen) | Drag-between-columns as the primary state change | Onboarding state is a consequence of consent, provisioning, and licensing, not something an admin drags. State changes come from a scoped row action that names what it does. |
| Amie (https://mobbin.com/screens/7314f0f2-23dd-47d0-938f-ead2b2505b1b) | Pastel-tinted blocks on a time ruler as the day's primary view | Colour-coded blocks spend the accent budget across the whole screen and read as categories rather than as one next thing. Moyo's day is a list with a hero, and the time ruler is at most a secondary view. |
| Jobber (https://mobbin.com/screens/3fe4fcd0-f1c7-4655-9c27-621ec11d5a3d) | An unlabelled sparkle/AI glyph in the header | An unexplained AI affordance on a tutor's pre-session screen. Any AI-derived suggestion names its source, or it does not ship. |

### Mapping to Moyo tokens

**Typefaces**

| Slot | Family | Token |
| --- | --- | --- |
| Hero session line (`Today, 4:35pm`), stage section headings | Archivo Black | `fonts.display` |
| `Next session` label, learner context lines, row titles, intervention copy | Space Grotesk | `fonts.sans` |
| Times, durations, stage counts, licence seats, dates in the queue | Chivo Mono | `fonts.mono` via `--text-data` / `--text-data-lg` |

The hero's time is the one place display and mono compete. Set it in Archivo Black as part of the sentence; the row-level times in the queue below are mono and column-aligned.

**The single accent moment**

Tutor: `bg-role-accent` / `on-role-accent` (tutor door) lands once, on the hero's `Next session` marker — the label pill or the hero's left edge rule. Queue rows are ink-on-paper with state words, not coloured chips. The three segmented-control options are ink with an ink-filled selected state, no accent.

School: the accent lands once, on the stage section that has items needing attention. If no stage needs attention the accent is absent from the page, which is a legitimate and desirable state. It never lands on all four stage headings at once — that turns the funnel into a colour key and spends the budget four times.

`role-accent-underlay` (`rgba(255, 219, 51, 0.24)`) is the fallback fill when the marker alone is too quiet on a long queue.

**Hard-offset shadow**

Tutor: one slab, the hero. Queue rows are flat with `--color-border` hairlines. Sheets (summary composer, learner-context sheet) take `--shadow-overlay` (`9px 9px 0 0`), which is the only place the deeper offset is earned.

School: one slab per stage section frame is too many. The stage sections are flat with hairline rules and their counts in mono; the scoped detail pane is the single shadowed surface.

Token caveat as in the sibling docs: `--shadow-card` is `4px 4px 0 0 var(--color-border-strong)` at the root, and `.dial-cool` remaps it to `2px 2px 0 0 var(--color-border-faint)` (`packages/theme/theme.css:199,563`).

**Cool dial specifics**

- Both surfaces ship inside `.dial-cool`. `--radius-card` → `0.5rem` on the hero and the detail pane; `--radius-control` stays `0.375rem` for the segmented control, row actions, and the summary composer's field.
- `--color-border` → `--color-border-soft` for queue hairlines; the hero and the detail pane use `--color-border-strong` on their outer edge.
- `--dial-row` → `--spacing-row-cool` for queue rows. The school queue and the tutor queue share this token so the two surfaces feel like one product.
- `--text-title-lg-cool` (`1.25rem/1.25/600`) for the hero sentence; `--text-body-cool` for learner context; `--text-caption-cool` for stage descriptions and dates.
- `--spacing-section-cool` between funnel stages, `--spacing-group-cool` between the hero and the queue.
- `--dial-duration` → `--duration-cool` on the hero's advance after a session completes. The advance is the confirmation, so it should be visible without being a performance.

**Numerics in Chivo Mono**

Session start and end times, session duration, stage counts (`Invited 12`), seats remaining, days since a row entered its stage. Column-aligned in the queue so the admin can compare down the column. No monetary values anywhere in the school funnel.

**Art class**

- Tutor hero: no photography. Learner identity as initials in an ink-bordered square. Zocdoc's map and Future Pro's portrait both go.
- In-session learner context: the learner's own work thumbnails from the prior session, inside a bordered frame. The only imagery on the tutor surface.
- Summary composer: type only.
- School ops: no imagery at all. Type, hairlines, and counts.
- Marketing and recruitment surfaces for tutors and schools use real photography, inside frames. Those are separate documents.

### Open questions for the design critique

1. **Whether the hero survives an empty day.** A tutor with no sessions today. Does the hero become the next session on any day, a bordered empty frame, or does the screen open on the queue with no hero at all?
2. **Where `Needs attention` actually lives.** Slack and Pipedrive both keep the exception on the row inside its stage. The brief names it as a fourth funnel stage. If it is a stage, an item is in two states at once; if it is a row mark, the admin loses a single place to see everything stuck. Pick one before build.
3. **Segmented control vs. sections for the tutor day.** Jobber uses a segmented control, Fiverr and 15Five use stacked sections for the same shape. The tutor's day is short enough for stacked sections, which would remove the tab state and match the school funnel. Worth testing against the phone-width scroll cost.
4. **Whether the tutor's summary is one artefact or two.** Equinox+ splits writing from sharing with a checkbox. Moyo may need a genuinely separate private note and shared summary, which changes the composer from one field to two.
5. **What the school funnel does at zero.** Rox's four empty columns are bleak. Does an empty stage collapse to a one-line count, hide entirely, or show a bordered sentence explaining what fills it?
6. **How the summary reaches the guardian without a messaging surface.** The summary is written by a tutor and read by a guardian, and there is no messaging backend. Whether that is a record on the child's timeline, a section of the guardian's status band, or nothing yet, is a product decision this screen depends on.
7. **Accent behaviour when two stages need attention.** The rule allows one accent moment. Two stalled stages means either promoting a page-level attention marker, or accenting only the worst and marking the other in ink.
8. **Time-ruler view for tutors with back-to-back sessions.** Amie's ruler is refused as the primary view, but a tutor with six sessions may need to see gaps. Secondary view, or not at all?
