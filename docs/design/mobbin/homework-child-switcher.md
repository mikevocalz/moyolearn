<!-- Mobbin pass: homework-child-switcher — the guardian's child chip row, fed by real wards -->
<!-- SOT: packages/app/features/family/child-switcher.tsx · packages/app/features/family/family.store.ts · packages/app/features/homework/use-guardian-wards.ts -->
<!-- SOT-KEYWORDS: mobbin child switcher chips guardian wards radio group scope -->

## Mobbin pass: homework child switcher

Archetype: **Scope selector**. One row of chips at the top of the guardian's home. The selected chip scopes everything beneath it: the upload entry, the homework timeline, the newest report. One account, never per-child logins.

### Purpose

A parent with two or three children opens Home and has to answer "which child am I looking at" before anything else on the screen means anything. The chip row answers it in the first line, and the answer is written to one store (`family.store`) so every per-child surface reads the same selection.

- **Who** — the ward's display name from GET /api/guardian/wards (active guardianships only), never a fixture.
- **One of N** — a radio group, so a screen reader says "Maya, 1 of 2, radio button, checked".
- **Hidden when there is nothing to choose** — one child or none renders nothing; a picker with no alternative is noise.

### References

| App | Title | URL | Relevance |
| --- | --- | --- | --- |
| Acorns | Home (You / Kid) | https://mobbin.com/screens/96c15ebb-251f-4261-b474-b4cf3c74d36a | A `You · Kid` switcher pinned at the top of home; the selection re-scopes every section below. One login. |
| Kit | Notifications (All kids) | https://mobbin.com/screens/ade862dc-3a68-429f-80be-595e4215442c | One `All kids (1)` scope control above the list, the list obeying it. Shows the scope-above-content order. |
| Duolingo ABC | Who's Learning? | https://mobbin.com/screens/9d952a8b-7e1e-43a5-b034-041e84f78c49 | Picker of children with the selected child ringed and an `Add a child` affordance beside them. Avatar plus name as the unit. |
| Hulu | Switch profile | https://mobbin.com/screens/33a4fc6b-d667-417a-b155-f1f0a1f2e2a8 | A full-screen list with a check on the current profile and a `KIDS` badge. Cited for the refusal: a page-level switcher, not a row. |
| YouTube | Family Center | https://mobbin.com/screens/d00bcfad-e9c8-4b21-a2f5-06b9210e495c | Family list with a pending-invite row. Cited for the refusal: account administration mixed into the selector. |
| Amazon Shopping | Your Amazon Family | https://mobbin.com/screens/6df42a51-5a16-46a3-8e77-763b3835fc9f | Member cards with role captions (`Account Holder · Adult`, `Profile · Child`). Cited for the refusal. |

### Take

- **Pin the scope above the content.** Acorns puts `You · Kid` at the very top (https://mobbin.com/screens/96c15ebb-251f-4261-b474-b4cf3c74d36a) and Kit puts `All kids` above the list (https://mobbin.com/screens/ade862dc-3a68-429f-80be-595e4215442c). Moyo's chip row is the first element under the one-time "what happens next" card, above the upload entry and the timeline.
- **Avatar plus name as the unit.** Duolingo ABC's picker (https://mobbin.com/screens/9d952a8b-7e1e-43a5-b034-041e84f78c49) makes the child legible from across the room. Moyo keeps `Avatar size="sm"` beside the name inside a 44pt chip; the active chip takes the ink fill, the rest stay on `surface-raised`.
- **Ring the selected one and say so.** Duolingo rings the active child; Hulu puts a check beside it. Moyo does both in semantics rather than decoration: `role="radio"`, `aria-checked`, `accessibilityState.checked`, so the selection is announced, not only drawn.
- **One row, scrolls, never wraps.** Six children stay one visual line (the `Overflow` story) so the row stays a header and never becomes a grid.

### Refuse

| Reference | Pattern | Rule it breaks |
| --- | --- | --- |
| Hulu (https://mobbin.com/screens/33a4fc6b-d667-417a-b155-f1f0a1f2e2a8) | A full page to switch profile, with an `Edit` action | Switching the child must not leave Home; it is a row on the feed, one tap, in place. |
| YouTube Family Center (https://mobbin.com/screens/d00bcfad-e9c8-4b21-a2f5-06b9210e495c) | Pending invites, `Add a profile`, notifications settings in the same list as the children | The switcher scopes; it does not administer. Adding or inviting a child lives on guardian.family (`/children`), never as a chip. |
| Amazon Family (https://mobbin.com/screens/6df42a51-5a16-46a3-8e77-763b3835fc9f) | `Account Holder · Adult` / `Child` role captions under each card | A chip carries the name only. Grade band is read by surfaces that need it (capture labels, targets), never printed as a label on the child. |
| Duolingo ABC (same screen) | `Add a child` as a peer of the real children | A chip row that mixes a command with the choices reads the command as a child. The add path stays on `/children`. |
| Hulu (same screen) | `KIDS` badge on a profile | No status or category badge on a child chip; the parent-home fixture's `status: 'On track'` is gone for the same reason. |

### Mapping to Moyo tokens

| Slot | Token / class |
| --- | --- |
| Chip height | `min-h-11` (44pt floor; the adult band's `min-h-target-adult`) |
| Chip radius | `rounded-card` |
| Chip border | `border-2 border-border` |
| Active fill / ink | `bg-primary` / `text-on-primary`, `shadow-card` |
| Resting fill / ink | `bg-surface-raised` / `text-text` |
| Gap between chips | `gap-element` |
| Avatar | `Avatar size="sm"` (32pt square, `rounded-md`, `border-2 border-border`) |

No role accent on the chips: `tooling/check-role-accent.mjs` confines the accent to the five shell slots, and a selection fill is not one of them. Distinction is ink fill versus paper.

### Open questions for the design critique

1. **Where the selection persists.** `family.store` is in-memory; a relaunch opens on the first ward. Should the last-selected child persist per device (MMKV) the way `last-shell` does, or is "first child" the right cold-start default for a parent?
2. **Arrow-key movement.** A WAI-ARIA radio group moves selection with arrow keys on web. The chips are focusable buttons today; wiring arrow keys needs a `roving tabindex` in `ChildSwitcher`. Owed, see the b3 log.
