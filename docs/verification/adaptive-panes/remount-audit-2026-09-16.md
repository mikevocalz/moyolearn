# AdaptivePanes: what a width change across 600 dp destroys

Date: 2026-09-16. Branch `feat/homework-intelligence`, commit `03e2ed4`.
Harness: Storybook 6006, story `Interaction/AdaptivePanes → MountAudit`, Chrome.
Geometry was injected, not physical — see Method.

## Result

Three panes, each holding a local draft. One width change each way.

| Step | Width | Size class | source | review | tutor |
|---|---|---|---|---|---|
| 1. typed | 900 dp | expanded | draft 3 | draft 4 | draft 5 |
| 2. collapsed | 500 dp | compact | **draft 0** | not rendered | not rendered |
| 3. expanded again | 900 dp | expanded | **draft 0** | **draft 0** | **draft 0** |

Mount log across step 2: `source:unmount, review:unmount, tutor:unmount, source:mount`.

Every pane is destroyed when the size class crosses 600 dp — including `source`, which
was visible before the change and visible after it. One resize wipes local state in all
three panes.

## Why

`AdaptivePanes` returns two different trees, and React keeps state by position and type.

- Collapsed: `SafeArea > MotionView key={activeColumn} > Aside > pane`
- Expanded: `SafeArea > View > CollapsiblePane > Aside > PaneContent > pane`

Nothing at the same position has the same type across that boundary, so the whole subtree
is rebuilt. `CollapsiblePane` and `Freeze` preserve mounts *within* the expanded branch —
the file's own comment is accurate about that — and neither survives the branch switch.

The `key={activeColumn}` on `MotionView` is a second, smaller remount: it is there to replay
the entrance animation, and it also resets whichever pane is showing when the active column
changes within the compact branch.

## Second finding: a pane that starts closed never mounts

Loading the same story at 731 dp (`medium`, where `resolvePaneVisibility` hides the primary)
logged `review:mount, tutor:mount` and nothing for `source`. `PaneContent` freezes a closed
pane, and `react-freeze` suspends the subtree, so a pane that has never been open has never
mounted. "Panes stay mounted" holds only for panes that were open at least once — relevant
for anything expected to warm up (a renderer, a socket, a model) before it is first shown.

## Method, and what this is not

The browser window could not be resized in this environment (fullscreen; `resize_window`
reported success while `innerWidth` stayed 1031), and resizing Storybook's preview iframe
fires no `resize` event inside it. React Native Web reads `window.visualViewport.width` and
subscribes to `visualViewport`'s resize event (`react-native-web/dist/exports/Dimensions`),
so the width was injected by redefining `visualViewport.width` and dispatching that event.

Everything downstream of the width — the hook, the size class, the branch, the reconciliation,
the mount log, the lost drafts — is the real component running in a real browser. The width
source is synthetic. This is a web run: it does not certify iOS, Android, or iPhone Duo
behaviour, and no device or simulator was used.

## Reproduce

1. `pnpm --filter storybook dev`
2. Open `Interaction/AdaptivePanes → MountAudit`.
3. Drag the window across 600 dp, or inject the width as above.
4. Read `__paneAudit` on the story's window for the ordered mount log.

---

# After the fix

Same story, same injected-geometry method, same day.

## Result

| Step | Width | source | review | tutor |
|---|---|---|---|---|
| 1. typed | 900 dp | draft 3 | draft 4 | draft 5 |
| 2. collapsed | 500 dp | draft 3 | (hidden) | (hidden) |
| 3. narrower | 360 dp | draft 3 | (hidden) | (hidden) |
| 4. expanded | 900 dp | draft 3 | draft 4 | draft 5 |

Mount log for the whole sequence: `review:mount, tutor:mount, source:mount`. Three mounts,
no unmounts, four width changes.

Re-run after the final edit, five changes (900 → 500 → 900 → 420 → 1100): drafts `[3, 4, 5]`
at every step, same three mounts, still no unmounts.

## What changed

One tree. The collapsed `return` is gone; the size class now decides which panes are open
and how wide, and every pane keeps the position it had. A collapsed host opens exactly one
pane at the row's measured width, so `CollapsiblePane` animates straight to full width
instead of opening at a 320 dp token and jumping.

`direction` left the store with the branch that used it: the panes sit in one row in
leading-to-trailing order, so a pane opening while its neighbour closes already travels the
right way. `COLUMN_RANK` went with it — the row order is the rank.

## The finding that cost the most to isolate

The first attempt fixed two panes out of three. `source` and `review` kept their drafts;
the detail pane still remounted and still came back at 0.

The cause was not the branch. It was one line above the detail pane's content:

```tsx
{paneControls && !collapsed ? <View>…toggles…</View> : null}
<PaneContent open={visible.detail}>{detailPane}</PaneContent>
```

Collapsing turned the first child into `null`, and somewhere in the landmark wrapper the
children are normalised with the nulls dropped — which moves `PaneContent` from index 1 to
index 0. A different index is a different position, and a different position is a remount.
Keeping an empty `View` in that slot fixed it.

Worth generalising: a pane host must not gain or lose siblings across a size-class change.
Hiding a sibling's *contents* is safe; removing the sibling is not.

## Also observed

While collapsed, the hidden panes still read `size class: expanded` — they are frozen, so
they do not re-render until they are shown again. That is the intended behaviour and is why
freezing is cheap, but it means a frozen pane's rendered output lags the current geometry
until it is revealed.

## Still not verified

Web only, injected width. No iOS, Android, simulator or device run. Nothing here says
anything about iPhone Duo hardware, reserved regions, or the fold.
