# Spatial whiteboard — the code review

<!--
What it is: a review of the whole branch diff (`main..HEAD`, six commits, 59
files) for correctness, child safety, performance and maintainability, ranked
blocker / should-fix / nit with a file and line behind each finding — and an
explicit list of the load-bearing invariants that are correct, because a review
that only lists defects tells a reader nothing about what they are allowed to
trust.
Why it exists: the feature's whole promise is "one board, two presentations",
and that promise lives in ordering rules — one document per session across two
routes, one set of save timers, an origin that never enters an undo stack, a
late-joiner order, and a registry that must survive a route gap. Each of those
is invisible when it breaks and shows up as a child's homework going missing.
SOT: packages/app/features/tutor/board-session.ts · board-doc.ts ·
     packages/app/features/tutor/tutor-xr-screen.native.tsx ·
     packages/ui/whiteboard-board.native.tsx · packages/ui/xr/
SOT-KEYWORDS: xr code review blocker should-fix nit board doc origin undo echo
              late joiner cleanup route lifecycle child safety performance
-->

Status: draft · Date: 2026-09-13 · Branch: `feat/spatial-whiteboard-xr`

## §0 Scope and method

**Reviewed: `main..HEAD` = `2c06a96…6e5707b`,** six commits, 59 files changed,
+6450 / −200.

```
6e5707b fix(xr): draw from onDrag, and make the rail's keys visible
3dfd77b fix(whiteboard): dispatch pointers where the engine actually listens, in batches
bf1216c feat(xr): prove no Viro on web, and end board sessions when the lesson does
b8f5e9e build(viro): vendor the fork as a tarball so the install works off this machine
802d5e9 fix(xr): spatial colours come from the token file, not a stock palette
627c103 feat(tutor): spatial whiteboard — one board, two presentations
```

**The working tree was being edited by other work while this review ran.** Where
a finding against the committed branch has already been fixed in the tree, it is
marked *fixed in the working tree at 14:30 EDT* and kept, because the branch as
committed is what would merge. Three findings were fixed during the review; four
were not.

Checks run: `node tooling/check-references.mjs` (pass), `node tooling/check-copy-law.mjs`
(pass), `pnpm turbo typecheck --force` (19/19, 0 errors), `node --test 'xr/*.test.ts'`
in `packages/ui` (23/23), `node --test 'features/tutor/board-*.test.ts'` in
`packages/app` (14/14).

## §1 What is correct

Six invariants carry this feature, and all six hold in the committed branch. They
are listed first because the rest of the review is about four places where they
do not reach.

### One `BoardDoc` per session, across both routes

`board-session.ts` moves ownership out of `TutorWorkbench` into a module-level
registry keyed by `boardSessionKey(sessionId)`. A registry rather than a
singleton, and the reason is written down: a global one would hand the next
learner on a shared classroom device the last learner's strokes. Both routes take
the same `boardSessionKey` expression, so they cannot disagree about which board
they are on.

`acquireBoardSession` / `releaseBoardSession` are reference-counted, and **the
session survives reaching zero holders** (`:239-244`). That is the load-bearing
part: a registry that disposed at zero would throw the document away in the gap
between one tree unmounting and the other mounting, and hand the headset an empty
board. It also survives React's development double-mount for the same reason.
`board-session.test.ts` asserts it by name.

### One set of save timers

`localTimer` and `remoteTimer` live in one session's closure
(`board-session.ts:130-131`), so N presentations share one debounce pair rather
than each running its own. `flush()` **writes rather than cancels** (`:196-207`) —
dropping a pending debounce loses whatever the child drew in the last breath
before navigating away. `setSessionId` fetches the server copy once per id rather
than once per mount (`:143-155`), with the reason stated: entering and leaving the
spatial screen re-runs every effect in the 2D tree, and a fetch per mount would
re-merge the server's copy over strokes drawn since, at route-transition rate.

### Origin discipline

`new Y.UndoManager(records, { trackedOrigins: new Set(['local']) })`
(`board-doc.ts:117`). `merge(update, 'remote' | 'restore')` therefore cannot enter
the undo stack, and `board-session.ts:123-124` restores the local copy with
`'restore'` explicitly — "a document being loaded is nobody's edit."

The subtle half is right too. `board-doc.ts:170` derives the outgoing origin as
`isLocal || typeof transaction.origin !== 'string' ? 'local' : transaction.origin`.
A Yjs `UndoManager` step carries the manager object as its transaction origin, not
a string, so an undo reaches a renderer as `'local'` — which is correct: it is
this author's change and the spatial renderer must redraw for it. Getting that
wrong would make undo silently not repaint the headset.

### No echo loop

Three independent mechanisms, none of them redundant:

1. `change()` returns early unless `source === 'user'` (`board-session.ts:172`).
   A change the engine calls `remote` is one the document just gave it.
2. `attach()` subscribes `doc.onRemote`, and the observer only calls those
   listeners when `!isLocal` (`board-doc.ts:162`).
3. The direct broadcast loop skips the originating presentation id
   (`board-session.ts:183-185`).

The third is dead today — there is one Quickdraw engine — and the comment says so
and says why it exists anyway: `onRemote` is blind to local origins by design, so
without it a stroke drawn into one attached engine would never reach a second one.
Keeping a correct no-op with its reasoning beats rediscovering it later.

**`onRecords` vs `onRemote` is the right shape.** Two subscriptions rather than an
origin argument on one, "so the existing echo rule cannot be switched off by a
caller passing the wrong flag." The spatial renderer needs local strokes (it has
drawn nothing yet); the Quickdraw engine must not get them back.

### The late-joiner order

`attach()` does `presentation.board.loadSnapshot(doc.snapshot())` **and then**
subscribes (`board-session.ts:157-165`). Whole document first, diffs after,
because a diff that reaches an engine with no editor is dropped silently and with
no error on either platform. Both callers gate on the engine's own `mounted`
message rather than on a mount effect — `whiteboard-board.native.tsx:298-299`
emits `onReady` from `mounted`, which is the engine reporting an editor exists.
Asserted by name in `board-session.test.ts`.

### Cleanup across repeated route entry and exit

`disposeBoardSession` is called from exactly two places and neither is a React
cleanup: `tutor.store.ts:724-729` on the session reaching a terminal state, and
`providers/session/store.ts` on a learner change. The reason is recorded with the
symptom it cost — "a board that merged 3613 bytes, held nine records, and drew
blank paper" — because a React cleanup runs between a double-mount's two halves
and would unobserve a document the remount then keeps using.

The three learner edges in `providers/session/store.ts` are each guarded on an
actual change rather than firing on every call, and the non-case is argued:
`family.store`'s `selectedLearnerId` is which child a *guardian* is reading about,
and disposing a learner's working because an adult changed tabs would be a
different bug wearing this one's clothes.

### Also correct, briefly

- **The web fork is a gate, not a convention.** `web-condition.test.ts` walks the
  resolved module graph from `@acme/ui/xr` and fails if anything reaches
  `@reactvision` or a `.native` fork — including through a type-only re-export,
  which is erased at build but still resolved by a bundler. 23 tests, passing.
- **The pointer batch ordering argument holds.** `whiteboard-board.native.tsx:224-233`
  swaps the whole buffer out rather than draining it, so a stroke's `end` is
  always dispatched before the next stroke's `begin` even when both travel in one
  frame — which is the ordering `_pointerUp` / `_pointerDown` needs.
- **The unmount flush is right.** `:243-249` cancels the scheduled frame and then
  flushes, so an unmount mid-stroke still gives the page its terminal sample while
  the page is alive, and does not do it twice.
- **`?? null`, not `|| null`, for pressure** (`:354-356`). A reported pressure of
  0 is a reading, not a missing value.
- **`toSurfaceLocal` refuses pitch and roll rather than guessing them**
  (`XrPanel.native.tsx:52-69`). ViroCore's Euler composition order is not stated
  in the installed types, and a wrong order does not fail — it puts ink somewhere
  plausible and slightly wrong.
- **`surface-drag.ts` is a pure file with a test**, for arithmetic that is
  invisible when wrong and merely plausible when slightly wrong. The `maxDistance`
  derivation even argues why the clamp cannot take the root of a negative number.
- **`strokeOf` checks every field and skips rather than guesses**
  (`stroke-of.ts:47-69`), against a `Record<string, any>` the vendor does not
  document.

## §2 Blockers

### B1 · `active.engine` is nulled by an effect that re-runs on every route render

`tutor-xr-screen.native.tsx:344-354` (as committed):

```ts
useEffect(() => {
  active.session = session;
  active.onExit = onExit;
  active.onAsk = onAsk;
  return () => {
    active.session = null;
    active.engine = null;      // ← set by a DIFFERENT effect
    active.onExit = () => undefined;
    active.onAsk = () => undefined;
  };
}, [onAsk, onExit, session]);
```

`active.engine` is assigned by the attach effect at `:375-382`, whose deps are
`[ready, session, setXrState]` — all stable after the first ready. This effect's
deps include `onExit`, which arrives as `onExit={() => router.back()}` created
inline in `apps/mobile/app/(learner)/tutor-xr.tsx:38` and therefore has a new
identity on every render of the route component.

So **any re-render of `TutorXrRoute` nulls `active.engine` permanently.** After
that, `handleSurfaceInput` calls `active.engine?.injectPointer(…)` and the
optional chain swallows it: the child draws on the paper and no ink appears, with
no error anywhere. `onTool`, `onInk`, `onAsk` and `onClear` all die with it.

The React Compiler would memoize the arrow and hide this, and it is **not
enabled** for `apps/mobile`: `babel.config.js` lists only `unplugin-typegpu/babel`
and `react-native-worklets/plugin`, and `app.config.ts` sets no
`experiments.reactCompiler`. `babel-plugin-react-compiler` is a declared
dependency of the app and is never loaded.

**Fix.** Whoever sets a slot clears it. Remove `active.engine = null` from this
cleanup and let the attach effect own the whole lifetime of that slot.

*Fixed in the working tree at 14:30 EDT, with the rule stated in a comment.*

### B2 · The spatial screen reads `sessionId` once and holds the draft board forever

`tutor-xr-screen.native.tsx:335-341` (as committed):

```ts
const key = boardSessionKey(sessionId);
const [session] = useState<BoardSession>(() => acquireBoardSession(key, boardPersistence));

useEffect(() => {
  session.setSessionId(sessionId);
  return () => releaseBoardSession(key);
}, [key, session, sessionId]);
```

`sessionId` goes from `null` to a real id the moment a turn is sent — and a child
can send one from inside the headset, because the Ask key exports a PNG and
`tutor-screen`'s `handleAskBoard` stages and sends it. Two things break at that
moment:

1. **`key` changes and nothing re-acquires.** `TutorWorkbench` handles this
   (`tutor-workbench.tsx:100-105`, the `heldKey` dance). This screen does not, so
   the 2D tree moves to the session-keyed document while the headset keeps drawing
   into `DRAFT_BOARD_KEY`. That is two boards for one piece of homework — the
   exact failure `board-session.ts` was written to prevent, reintroduced by the
   route that motivated it. The child comes back to a board missing everything
   they wrote in space.
2. **The hold count falls on a change that is not a departure.** The effect
   depends on `sessionId`, so its cleanup releases on every id change while the
   setup never re-acquires. One acquire, two releases. `releaseBoardSession`
   clamps at zero, so nothing throws — it just decrements a hold the 2D screen
   still owns, and reaching zero writes.

**Fix.** Copy the workbench's `heldKey` pattern verbatim. Two boards must not
disagree about which document they are on, and "verbatim" is the point: a second
way of doing it is a second thing to get wrong.

*Fixed in the working tree at 14:30 EDT, with the Ask-in-the-headset path named in
the comment.*

### B3 · Ending the lesson destroys the document under a mounted spatial screen

`tutor.store.ts:724-729` disposes the board when the stage reaches `ended` or
`crisis`. `disposeBoardSession` → `session.doc.destroy()` →
`records.unobserve(observer)`, `recordListeners.clear()`, `undoManager.destroy()`,
`doc.destroy()` (`board-doc.ts:227-234`).

`TutorXrScreen` holds its `BoardSession` in `useState` and **nothing pops the
route**. The screen's own code expects to be mounted at that moment — it passes
`inputLocked={stageKind === 'ended' || stageKind === 'crisis'}` to the chat panel,
and `statusLabel` has a branch for `'ended'`. So a child can be wearing the
headset when the lesson ends, and from that instant:

- `session.doc.onRecords` has been unsubscribed, so `bumpRevision` never fires
  again and `XrBoardInk` never redraws. **The child keeps drawing and nothing
  appears on the paper.** Silently, with no error.
- `session.change(…)` still runs `doc.applyDiff` on a destroyed `Y.Doc` and still
  schedules `store.writeLocal(doc)` against it.
- `session.doc.undo()` calls a destroyed `UndoManager`; `canUndo()` / `canRedo()`
  read a cleared stack, so the rail shows Undo disabled while the child has
  clearly just drawn something.

The registry entry is gone, so the XR screen's eventual `releaseBoardSession`
finds nothing and the last strokes are never flushed.

**Fix.** The board's end and the spatial screen's end are one event. Either the
XR screen subscribes to the same terminal set and leaves the route before disposal
(which also lets `XrPanel` go to `exiting` and abandon a stroke in flight), or
`disposeBoardSession` refuses while holders are non-zero and the last
`releaseBoardSession` disposes instead. The first is better: a child whose lesson
has ended should not be left in a headset with a board that has quietly stopped
working.

**Not fixed in the working tree at 14:30 EDT.** The disposal subscription is
unchanged and the XR screen still reads `stageKind` only for display.

## §3 Should-fix

### S1 · A record the spatial renderer cannot draw disappears with no count

`stroke-of.ts`'s header states the contract: "Dropping it silently is wrong,
which is why the caller counts what it skipped." `xr-session.store.ts:54-55, 97,
127` declares `skippedRecords` and `setSkipped`. **Nothing calls `setSkipped`,**
and `XrBoardInk.native.tsx` does not count — it pushes the non-null results and
discards the rest.

A board carries text, notes, arrows and images when it has been used on the web
app's fuller tray. In the headset those records vanish with no count, no copy and
no signal, on a child's homework. `04-copy.md` §5 already has the sentence this
would need.

*Fixed in the working tree at 14:30 EDT — `XrBoardInk` now takes `onSkippedCount`
and the chat panel takes `skippedCount`.*

### S2 · Every polyline is rebuilt on every document change

`tutor-xr-screen.native.tsx:366` bumps `revision` on every `onRecords`. That
re-renders `BoardScene`, which re-runs `session.doc.snapshot()` — a full walk of
the `Y.Map` building a fresh plain object (`board-doc.ts:189-193`) — and hands it
to `XrBoardInk`, which re-parses **every** record through `strokeOf` and builds a
fresh `points` array for every stroke. Every `ViroPolyline` therefore gets a new
`points` prop identity and a native update.

Quickdraw emits `change` per commit rather than per sample, so this is not
per-pointer — but it is O(all strokes) per new stroke, which is O(n²) over a
session, on the JS thread, in a headset, while a child is writing.

**Fix.** Memoise per record id. The document mutates in place, so the cheap
version is to keep a `Map<id, StrokeGeometry>` and update only the ids the diff
touched — the diff is already in hand at the `onRecords` callback and is currently
discarded.

### S3 · The vendored Viro fork is declared three times and never catalogued

`pnpm-workspace.yaml:34` states the rule: "One version per dependency, declared
once. Every package.json uses `catalog:`." The branch adds
`"@reactvision/react-viro": "3.0.0-moyo.1"` as a **literal** to
`apps/mobile/package.json`, `packages/app/package.json` and
`packages/ui/package.json`, plus a `pnpm.overrides` entry in the root
`package.json` pointing at `file:./vendors/…tgz`.

The override wins, so the three declared versions are cosmetic — which is exactly
the failure mode the workspace file's own comment warns about for `react` /
`react-dom`: "an override outranks the catalog silently, so a bump in one place
without the other gives a workspace whose declared version is not its installed
one."

**Fix.** One `catalog:` entry with the tarball's provenance in the comment beside
it, the same way `@quickdrawjs/*` and `three` are handled.

### S4 · A 52 MB binary landed with no provenance note

`vendors/reactvision-react-viro-3.0.0-moyo.1.tgz` is 52,438,927 bytes, committed
to git. `vendors/README.md` exists and documents exactly one thing — the Redraw
tarballs — including why the `file:` protocol is used. It says nothing about this
tarball: not what fork it is, not where it came from, not what differs from
upstream `@reactvision/react-viro@3.0.0`, not how to rebuild it.

`04-copy.md` and `03-design-system.md` both cite paths inside a local checkout at
`/Users/mikevocalz/viro/`, which is a machine nobody else has.

**Fix.** A `## ViroReact (the spatial whiteboard)` section in `vendors/README.md`
naming the upstream commit, the fork's own ref, the patch it carries, and the
command that produced the tarball. A binary blob nobody can regenerate is a
dependency with one copy in the world.

### S5 · Metre tokens used as dp

`tutor-xr-screen.native.tsx:437`:

```ts
left: -boardSurfacePixels.width - spatialSpacing.md,
```

`spatialSpacing.md` is 0.1 **metres**. The result is `-1400.1` dp, so nothing
visibly breaks — but `spatial-tokens.ts`'s entire header is the argument that
these are metres precisely because a dp is a different kind of promise. Using one
as a pixel offset is the first crack in that.

**Fix.** A plain number with a comment, or a dp token.

## §4 Child safety

Four things were checked specifically, and three are clean.

**No paywall, price or upgrade prompt.** Verified across `packages/ui/xr`,
`XrBoardButton.tsx` and both `tutor-xr-entry` forks. Not a price, a plan, a tier,
a streak, a limit or a countdown anywhere. `04-copy.md` §1 reaches the same
result by a different route.

**The board cannot become a browser.** `whiteboard-board.native.tsx:380-385`:

```tsx
originWhitelist={['about:blank']}
onShouldStartLoadWithRequest={() => false}
```

with the reason written out — "this is a learner surface; an accidental
navigation off it is an unsupervised web view in a child's homework session."
Nothing in the page loads from the network; the engine is inlined and
dependency-free. This is the single most important line in the branch from a
safety standpoint and it is correct.

**The injected pointer batch cannot carry script.** `PointerPacket` is
`[PhaseCode, number, number, number | null]` and the phase travels as an *index*
that the page-side shim resolves from a table it owns
(`whiteboard-board.native.tsx:110-133, 159-170`). So the serialised batch is
digits, signs, commas, brackets and the token `null` — there is no string in it
to escape out of and no quote or angle bracket to escape with. The reasoning is
written down and it checks out.

**The route is guarded.** `apps/mobile/app/(learner)/tutor-xr.tsx` lives in the
`(learner)` group, which is wrapped in `Stack.Protected guard={isLearner}`, and
the file says why a route outside it would be a child's board reachable by
somebody who is not that child.

**The one gap, and it is handled honestly.** The local storage slot is not
learner-scoped, so `disposeAllBoardSessions` clears memory while the device slot
still holds the previous learner's encoded board — and the next
`acquireBoardSession` restores from it. `board-session.ts:246-264` states this,
explains why scoping the key alone is not a one-liner (`capture-problem` shares
the slot and is equally unscoped; a device upgrading mid-homework needs a
read-through), and `board-session.test.ts:160-214` **demonstrates the leak as a
passing assertion** with an instruction to invert it when the fix lands:

```ts
assert.deepEqual(
  records(next).sort(),
  ['shape:alice', 'shape:alice-2'],
  'the device slot is scoped now — invert this assertion and delete the note above',
);
```

That is the right way to carry a known gap — it cannot be forgotten and cannot be
mistaken for fixed. It still needs an issue with an owner, because on a shared
classroom device it is one child's handwriting reachable by the next.

## §5 Nits

- **N1 · `packages/ui/package.json`** — the `./xr` export block is indented two
  spaces short and it pushed `"./icons"` out of alignment with it.
- **N2 · `moveHandle: 'bottomOrnament'` is typed and unimplemented.** The
  `dragType` / `onDrag` wiring is inside a `moveHandle === 'frame'` branch
  (`XrPanel.native.tsx:365-374`), so the third value silently behaves as
  `'none'`. Implement it or narrow the type — a union member that does nothing is
  a lie the type system tells.
- **N3 · `handsPrimary` and `reducedMotion` are declared on `XrPanelProps` and
  never destructured** (`:102-114`). Neither has an effect today.
- **N4 · `board-session.ts`'s header describes a navigation that does not
  happen.** "Navigating from the tutor screen to the spatial screen unmounts the
  2D tree before the XR tree mounts" — the route is a `router.push`, so the tutor
  screen stays mounted. The *design* is still right (it has to survive a remount
  and a double-mount either way); the scenario in the comment is more defensive
  than the navigation it describes.
- **N5 · `opacity: 0` on the parked engine view** (`tutor-xr-screen.native.tsx:441`)
  is belt-and-braces with `left: -1400`. The file's own argument is that the
  engine must keep drawing, and `opacity: 0` is one platform decision away from
  being treated as "skip this subtree" the same way `display: none` tears the
  surface down. Pick the off-screen park and drop the opacity.
- **N6 · `Node v26.8.1` against `engines.node: ">=24.15.0 <26"`.** Every turbo
  invocation prints `WARN Unsupported engine`. Pre-existing, not this branch's,
  and worth noticing while reading the output.

## §6 Verdict

**The architecture is right and the branch is close.** The document layer is the
best-reasoned code in the feature: every ordering decision that costs a child's
work is written down with the bug that bought it, and the six invariants in §1
hold. The pointer path is defended sample by sample against failures that were
clearly found the hard way. The web fork is enforced by a test that walks a real
module graph rather than by a naming convention.

The defects cluster in one place, and it is the seam the feature exists to
cross: **the spatial screen's own React lifecycle**. B1, B2 and B3 are all the
same shape — the screen treats itself as a leaf that mounts once and lives until
it unmounts, and it is neither. It re-renders (B1), the session identity moves
under it (B2), and something outside it can end the thing it is displaying (B3).

B1 and B2 are fixed in the working tree. **B3 is not, and it should not merge
without a fix** — a child wearing a headset when the lesson ends keeps drawing
onto a board that has silently stopped recording.
