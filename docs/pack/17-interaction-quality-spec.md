# Interaction Quality Spec — optimistic coordination & layout transitions
**Doc 17 · Moyo platform pack · Date:** Aug 21, 2026
**Sources read (linked, per standing rule):** [Coordinating Optimistic Updates in Next.js](https://aurorascharff.no/posts/coordinating-optimistic-updates-in-nextjs/) (Aurora Scharff, Aug 13 2026) with her live apps [Flow](https://next16-calendar.vercel.app/) (calendar) and [Huddle](https://next16-team-chat.vercel.app/) (team chat) and source ([calendar-events-provider.tsx](https://github.com/aurorascharff/next16-calendar/blob/main/providers/calendar-events-provider.tsx), [channel-nav.tsx](https://github.com/aurorascharff/next16-team-chat/blob/main/features/channel/components/channel-nav.tsx)) · [React useActionState](https://react.dev/reference/react/useActionState) · [React useOptimistic](https://react.dev/reference/react/useOptimistic) · [Next.js 15.2 viewTransition flag](https://nextjs.org/blog/next-15-2) · ViewTransition status field notes ([Nerd Level Tech, Jun 2026](https://nerdleveltech.com/react-viewtransition-not-working), [Devya field notes](https://www.devya.dev/blogs/view-transitions-nextjs-app-router-field-notes), [rebeccamdeprey.com](https://rebeccamdeprey.com/blog/view-transition-api)) · [Reanimated](https://github.com/software-mansion/react-native-reanimated) ([docs](https://docs.swmansion.com/react-native-reanimated/)).
**Why this doc exists:** Aurora's Flow demo is *our ops schedule* — a calendar board where drag-move and resize update optimistically while writes save in order. Her pattern is the missing coordination layer for every interactive surface in Moyo; the transitions half makes those state changes *move* correctly.

---

## Part A — Optimistic coordination (the Scharff patterns, made cross-platform)

### A1. The core pattern (adopted)
The failure she names is exactly the one our schedule board would hit: a second change computed from the pre-save base silently drops the first change even though writes land in order. The fix, adopted as Moyo's standard:
- **A pure change-reducer per feature** — `(state, Change) => state` discriminated-union style (doc 10's state discipline). It lives in `packages/app/features/<domain>/` and is **shared by both renderers and, where the write needs it, the server**.
- **`useActionState` as the ordered queue** — the action callback receives the *previous confirmed result*, so each save builds on the last; wrap the call in try/catch, on failure toast and return the previous state.
- **`useOptimistic` with the same reducer** — `startTransition(() => { addOptimistic(change); dispatch(change) })`; the UI moves instantly, confirmed state catches up, and **rollback is free**: when the action settles after an error, React discards the optimistic layer and the surface snaps back to the last confirmed state — no reverse-change bookkeeping.
- **Cross-tree scaling via a pending-changes provider** — where Server Components sit between surfaces (her Flow calendar; our schedule header + week/month boards), the provider holds `EventChange[]` + the queue, and boards replay `pendingChanges.reduce(reducer, serverEvents)` over whatever range they fetched. Split state/dispatch contexts so dispatch-only components don't re-render.

### A2. Block integration (ours, binding)
Her Server Function is our seam: on **web**, the action is a server function that wraps the Block operation (`protectedOperation` — all ten gates, audit, typed errors); on **native**, `useActionState`/`useOptimistic` are core React 19 hooks that work in React Native — the action is simply the **typed client** call to the same operation. Same hooks, same reducer, same Change types, two transports. Failure copy comes from the doc-13 error registry (one source for toast text), and the Block's `CONFLICT`/`PERMISSION_DENIED` map to snapback + honest copy. **Learner-surface rollback UX rule:** children never see red error toasts — a failed send/interaction gets gentle retry copy ("Hmm, that didn't stick — try again") in band voice, while the parent/ops surfaces get the registry's precise message.

### A3. When to use a client data library (her boundary, adopted verbatim)
State that only changes on user action (schedule layout, roster edits, settings) → the hooks pattern above; **data that changes on its own** (messages, notifications, live session presence) → TanStack Query/SWR seeded from the server render, accepting the two-cache coordination cost. This line goes in CLAUDE.md so agents stop reaching for a query library where two hooks suffice.

### A4. Surface map (build order)
1. **S6 / ops schedule** — Flow-shaped exactly: `ScheduleChange` union (`move`, `resize`, `create`, `cancel`, `assignTutor`), provider around header+views, the starter's existing drag-reschedule upgraded from local state to the queue. The acceptance test is hers: *move a session, then move it again before the first save lands — both changes survive.*
2. **Natalie chat send** — optimistic user bubble (doc 15's LegendList anchor fires immediately), queued send through the gateway; Safety-Plane rejection = snapback + band-voiced retry.
3. **Roster/invoice quick actions, settings toggles** — the simple single-surface form of the pattern.

## Part B — Layout transitions

### B1. Web: View Transitions (eyes open)
Status, verified: **React's `<ViewTransition>` is canary/experimental only — not in stable React 19.2** (announced React Labs Apr 2025, still canary-gated mid-2026). Next.js App Router ships React canary, so it works behind `experimental.viewTransition: true` (since 15.2) — but Vercel's own docs mark the flag not recommended for production. Browser support for same-document transitions is Baseline (Chrome 111+, Safari 18+, Firefox 144+).
**Moyo posture:** adopt as **progressive enhancement on ops-cloud surfaces first** (adult, desktop-heavy), behind the flag with a per-route kill switch; unsupported browsers simply don't animate. The stable-channel fallback pattern — wrapping navigation in `document.startViewTransition` — is the documented alternative if the flag bites. **The synthesis that makes this cheap:** ViewTransition only animates updates inside `startTransition`/Suspense — and Part A already wraps every optimistic mutation in `startTransition`. The same seam that orders our writes drives our motion: a schedule move animates to its new slot *because* the optimistic dispatch is a transition.
**Craft rules (from the field notes):** every `view-transition-name` unique per snapshot (a duplicate silently skips the transition); animate transform/opacity (snapshots are images); shared-element name-pairing for card→detail morphs (skill gallery later); reduced-motion disables the lot.

### B2. Native: Reanimated layout animations
The RN half of "proper layout transitions" is [Reanimated](https://docs.swmansion.com/react-native-reanimated/)'s layout-animation system: `entering`/`exiting` presets (doc 15 already uses them for chat bubbles) plus **layout transitions** on position/size change — list reorders, schedule-board drag settle, pane changes animate instead of teleporting. Reanimated 4's CSS-style API requires the New Architecture — the starter satisfies it. **Shared-element transitions remain experimental in Reanimated — evaluate-only**, same discipline as MLC in doc 15; screen-level transitions ride Expo Router's native stack. Exact APIs verified against installed versions at the PR, per the standing no-invented-APIs rule.

### B3. One motion system
Durations/easings are **tokens** (doc 08), shared by both renderers: the web transition CSS and the Reanimated configs read the same scale, so a schedule move feels identical on desktop and iPad. Reduced-motion is a single global switch honored by ViewTransition CSS, Reanimated configs, and the doc-15 shimmer alike.

## PRs
- **PR-45 · Optimistic foundation (Wave 3-adjacent):** change-reducers + provider on the schedule vertical, chat-send optimistic path, error-registry toast wiring, the overlapping-moves test + failure-snapback test in CI.
- **PR-46 · Web transitions (flagged):** `experimental.viewTransition` on ops routes, transition names on schedule/list surfaces, kill switch, reduced-motion audit.
- **PR-47 · Native layout-animation pass:** Reanimated layout transitions on schedule board + lists, token-driven configs, SET evaluation note recorded.

## Sources
All inline above; primary: [aurorascharff.no post](https://aurorascharff.no/posts/coordinating-optimistic-updates-in-nextjs/) · [react.dev useActionState](https://react.dev/reference/react/useActionState) · [react.dev useOptimistic](https://react.dev/reference/react/useOptimistic) · [Next 15.2 announcement](https://nextjs.org/blog/next-15-2) · [ViewTransition status guide](https://nerdleveltech.com/react-viewtransition-not-working) · [Reanimated docs](https://docs.swmansion.com/react-native-reanimated/). Patterns hers/React's; wiring ours; nothing pasted.
