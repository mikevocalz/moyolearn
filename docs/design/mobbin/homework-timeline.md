<!-- Mobbin pass: homework-timeline — one child's worksheets as a dated list, outcomes as words -->
<!-- SOT: packages/app/features/homework/guardian-homework-timeline.tsx · packages/app/features/homework/timeline-groups.ts · packages/app/features/homework/homework.types.ts -->
<!-- SOT-KEYWORDS: mobbin homework timeline dated list outcomes words guardian question count -->

## Mobbin pass: homework timeline

Archetype: **Dated ledger**. A date header, then one card per worksheet: subject, title, question count, and the six outcome counts written as words. Newest first, grouped by the child's local calendar date. No bar, no percentage, no grade.

### Purpose

The parent asks "what did Maya work on, and where did she get stuck". The list answers per day and per sheet, with counts a parent can read as facts: `4 solved on their own · 2 solved with hints · 1 still working on it · 3 not started`. The words are the six outcomes the acceptance contract distinguishes (`QuestionOutcome`), and nothing on the row collapses them into one number.

### References

| App | Title | URL | Relevance |
| --- | --- | --- | --- |
| Careem | Activities | https://mobbin.com/screens/0f44880e-aa99-4055-89e2-056c52867c8f | `Today · Tuesday, 2 Sep · Saturday, 30 Aug` date headers over rows that lead with a title and carry one detail line. A row of scope tabs (All, Rides, Food, Shops) sits above the list. |
| Headspace | My Activity History | https://mobbin.com/screens/e779c6a0-bcdf-47e5-ad1b-77d69d21efa0 | Year, then `August 20 / August 19` groups on a rail; each row a title plus a typed descriptor (`Meditation · 1-3 min`). |
| Nike Run Club | All Activity | https://mobbin.com/screens/c20a7fbc-a50f-4f54-8d4f-4fec4bf84ca1 | Month headers with a one-line roll-up, cards with labelled numbers (`Miles · Avg. Pace · Time`) rather than a bar. |
| Fi | Timeline | https://mobbin.com/screens/5fdd2ed7-756a-484b-87f1-4e55c496208c | `TODAY, FEB 22 / YESTERDAY, FEB 21` headers; a segmented scope control above the timeline. |
| Notion | History | https://mobbin.com/screens/dab6009c-4b30-48c0-8048-1b526ce872c3 | `Today · 11:05 AM` rows with the person beneath. Cited for the relative-day vocabulary. |
| Runna | Activities | https://mobbin.com/screens/e52cd6c6-6db9-412e-8391-5172d3274048 | Colour-banded cards with distance badges. Cited for the refusal. |
| pliability | Past Incidents | https://mobbin.com/screens/c8dbd698-6434-48d1-9b54-576d97de9b69 | A row for every date, most saying `No incidents reported`. Cited for the refusal. |

### Take

- **Date headers, relative for two days then absolute.** Careem and Fi write `Today` and `Yesterday`, then the full weekday and date (https://mobbin.com/screens/0f44880e-aa99-4055-89e2-056c52867c8f, https://mobbin.com/screens/5fdd2ed7-756a-484b-87f1-4e55c496208c). `dateHeading` does exactly that, with the year only once it differs from today's.
- **Title first, descriptor second.** Headspace's rows (https://mobbin.com/screens/e779c6a0-bcdf-47e5-ad1b-77d69d21efa0) lead with the title and trail a typed line. Moyo's card leads with subject as a small label, the sheet title in semibold, and the question count in Chivo Mono on the trailing edge.
- **Labelled numbers, not a bar.** Nike Run Club writes `7.46 Miles · 8'02" Avg. Pace` (https://mobbin.com/screens/c20a7fbc-a50f-4f54-8d4f-4fec4bf84ca1). The outcome line follows: a mono count, then the words. parent-home.md already refused the segmented bar for reading as a proportion.
- **Scope control above the list.** Careem's filter row and Fi's segmented control sit above the timeline. On `/homework` the child switcher takes that slot.
- **Group order is server order.** `groupByLocalDate` inserts boundaries only; a row never moves relative to its neighbours between the list and the server's answer.

### Refuse

| Reference | Pattern | Rule it breaks |
| --- | --- | --- |
| Runna (https://mobbin.com/screens/e52cd6c6-6db9-412e-8391-5172d3274048) | Colour-coded card edges and achievement badges (`1K · 1MI · 5K`) | No badges, no colour-as-grade. Outcomes are words. |
| pliability (https://mobbin.com/screens/c8dbd698-6434-48d1-9b54-576d97de9b69) | A header for every calendar day, most saying nothing happened | Days without a worksheet are not listed. A row that says "no work" about a child is a nag. |
| Nike Run Club (same screen) | Month roll-up `10 runs · 42.53mi` | No totals across sheets. A total invites comparison between weeks and between children. |
| Any | A percentage, a score, "correct", a grade | `timeline-groups.ts` tests assert the outcome words contain none of these. |

### Mapping to Moyo tokens

| Slot | Token / class |
| --- | --- |
| Date header | `text-label uppercase tracking-wide text-text-muted`, `role="heading" aria-level=3` |
| Group gap | `gap-group`; rows inside a group `gap-stack` |
| Card | `Card` (`rounded-card bg-surface-raised`, `shadow-card`) |
| Subject | `Text variant="label" tone="muted"` |
| Title | `text-base font-semibold text-text`, `numberOfLines={2}` |
| Question count | `Text variant="data" tone="muted"` (Chivo Mono) |
| Outcome count | `font-mono text-data text-text` inline, words in `text-sm text-text` |
| Empty | `EmptyState` with an outline `Upload work for <child>` action |
| Failure | `ReadFailure` with `readFailureCopy` (sign-in exit on 401) |

### Open questions for the design critique

1. **Tap target on a row.** Rows are not pressable yet: there is no guardian submission-detail route in this PR (B4's report print covers per-question evidence). Should a row open the linked session report when `tutorSessionId` is set?
2. **Status word.** `SubmissionStatus` (`reviewing · ready · in-progress · complete · abandoned`) is not shown. "in-progress" could read as a nudge; "complete" as praise. Draft copy needed before it appears.
3. **How far back.** The route lists everything the server returns. If the list grows past a school year, the month roll-up header (without totals) is the candidate.
