# Spatial whiteboard — the copy

<!--
What it is: every string a child can see or hear on the spatial whiteboard,
collected from the source with its file and line, the context it appears in, the
reason it is worded that way, and the audit against `CLAUDE.md`'s children's-
surface rules and `tooling/check-copy-law.mjs`.
Why it exists: the spatial surface writes its strings as literals at the point
they render — inside a `ViroText`, inside a rail key's `label` prop — with no
copy deck anywhere, and `check-copy-law.mjs` does not scan this app at all. So
nothing reviews these words and nothing can. Three of them are wrong for a K–2
reader, one of them tells a child something about Natalie that is not true, and
three that are written have no surface to appear on. This file is the review.
Nothing here edits code; every fix is a proposal with a file and a line.
SOT: packages/ui/xr/XrRail.native.tsx · packages/ui/xr/XrPanel.native.tsx ·
     packages/ui/xr/XrChatPanel.native.tsx · packages/ui/xr/XrOrnaments.native.tsx ·
     packages/ui/XrBoardButton.tsx · packages/app/features/tutor/tutor-xr-entry.tsx ·
     packages/ui/Whiteboard.tsx · CLAUDE.md · tooling/check-copy-law.mjs
SOT-KEYWORDS: xr copy strings learner surface k-2 reading level rail labels
              recenter leave assurance fidelity polyline pressure draw highlight
-->

Status: draft, unreviewed by a child · Date: 2026-09-13 · Branch: `feat/spatial-whiteboard-xr`

## §1 The rules these strings were checked against

**`CLAUDE.md` §Children's surfaces.** No paywall, price or upgrade prompt on a
learner surface, ever. No engagement-pressure mechanics aimed at minors — no
shame copy, no guilt notifications, no late-night pushes.

Result: **clean.** Not one string in `packages/ui/xr`, `XrBoardButton.tsx` or the
two `tutor-xr-entry` forks mentions a price, a plan, a tier, an upgrade, a
streak, a limit, a countdown or a consequence for stopping. The closest thing to
pressure in the whole feature is the Ask key changing to `Sending`, which is a
status. Every assurance line points the same direction — the board is safe,
nothing is lost, you can go back — which is the opposite of pressure.

**`tooling/check-copy-law.mjs`.** Ran clean: `copy-law OK — 60 site files carry no
banned promise`.

That result says nothing about this feature, and the honest version has to be
stated rather than implied. The gate walks `apps/web-vite/src` only — the
marketing site — and its own header says so. It does not read `packages/ui`,
`packages/app` or `apps/mobile`. **No automated check reads a single string on
the spatial whiteboard.** The four laws it enforces (no answer promises, no
business pricing on a parent surface, no voice-input or social promises, US-only
compliance framing) were applied by hand below, and by hand is currently the only
way they can be applied here.

Manual result against the four laws: no string promises an answer, prices
anything, offers voice input, promises a social feature, or names a non-US
regulation. `Ask` and `Ask Natalie` are questions asked of a tutor, which is what
the product is.

**One rule the code states about itself and does not keep.** `XrRail.native.tsx`'s
header: "a child who has used the board on a laptop should not have to relearn it
in a headset." Three of its labels are words the 2D board does not use (§3.1).

## §2 Every string, where it lives, and why

### §2.1 The door in

| String | Where | Context | Why it reads this way |
| --- | --- | --- | --- |
| `XR` | `packages/ui/XrBoardButton.tsx:76` | The visible label on the compact pill in Natalie's alcove | The component's rationale is that this is an alternative view of work the child can already do, so it is a pill and not a primary action. The label itself has no stated rationale — and the comment three lines above argues against it (§3.2) |
| `Opening…` | `XrBoardButton.tsx:76` | Replaces `XR` between the press and the route being on screen | A press that takes a moment has to say so, or a child presses again. `entering` also gates `onPress`, so the words and the lock agree |
| `Open spatial whiteboard` | `XrBoardButton.tsx:71` | `aria-label`, on the pill | "What it does, not what it is" — the file's own comment. Not read aloud in the headset; this label serves the 2D tutor screen, which is where the pill lives |

### §2.2 The wait, and the way back out

| String | Where | Context | Why it reads this way |
| --- | --- | --- | --- |
| `Opening your board in space…` | `tutor-xr-entry.native.tsx:34` | Suspense fallback while the Viro renderer is fetched | Words rather than a spinner alone. This is the one moment a child looks at nothing and does not know whether their board survived the trip |
| `Your working is saved. Nothing is lost if you go back.` | `tutor-xr-entry.native.tsx:36` | The caption under it | The wait is a lazy `import()`, which can be slow on a cold cache. The sentence answers the fear rather than the mechanism |
| `Getting your board ready` | `XrPanel.native.tsx:387`, state `checking` | Beside a spinner, drawn in place of the paper | A branded wait, never a blank board. An empty 5:7 rectangle that looks finished is a child drawing onto a surface about to be replaced by their restored work |
| `Bringing your working over` | `XrPanel.native.tsx:387`, state `preparing` | Same slot, second phase | Names the restore specifically, so a longer wait reads as work happening rather than as a stall. **Never rendered** — nothing sets `preparing` (`03-design-system.md` §4) |
| `This headset can't open the spatial whiteboard yet. Your board is waiting on the normal screen — nothing is lost.` | `XrPanel.native.tsx:406`, state `unsupported` | A card at `z = 0.01`, in place of the paper | Says where the board is rather than what failed. **Never rendered** — nothing calls `unsupported()`; the entry pill hides itself instead |
| `The spatial whiteboard needs a headset.` | `tutor-xr-entry.tsx:25` | The web fork of the route | A child who somehow reached `/tutor-xr` in a browser gets the honest answer instead of an empty view |
| `Your board is on the normal tutor screen, with everything you have written.` | `tutor-xr-entry.tsx:27` | The caption under it | Same rule as every other dead end here: point at where the work is |

### §2.3 The rail

Read top to bottom, which is the order a ray travels.

| String | Where | Context | Why it reads this way |
| --- | --- | --- | --- |
| `Pen` | `XrRail.native.tsx:31` | Tool key, `draw` | Matches `Whiteboard.tsx:187`'s 2D label exactly |
| `Mark` | `XrRail.native.tsx:32` | Tool key, `highlight` | No stated reason. The 2D label is `Highlighter` (`Whiteboard.tsx:188`) |
| `Erase` | `XrRail.native.tsx:33` | Tool key, `eraser` | No stated reason. The 2D label is `Eraser` (`Whiteboard.tsx:189`) |
| `Ink` | `XrRail.native.tsx:172` | Opens the colour column beside the rail | No stated reason. The 2D control's `aria-label` is `Pen color` (`Whiteboard.tsx:394`) |
| `""` (empty) | `XrRail.native.tsx:183` | Each of the seven colour swatches | No stated reason. The 2D swatches carry `Black` / `Blue` / `Red` / `Green` / `Yellow` / `Orange` / `Purple` (`Whiteboard.tsx:205–211`) |
| `Undo` | `XrRail.native.tsx:197` | Disabled when `canUndo` is false | Matches the 2D `aria-label` (`Whiteboard.tsx:601`) |
| `Redo` | `XrRail.native.tsx:205` | Disabled when `canRedo` is false | Present in the headset and absent in 2D, and the reason is in the file: a ray is far easier to overshoot than a tap |
| `Ask` | `XrRail.native.tsx:213` | Exports the board and hands it to the tutor screen's existing send path | The 2D label is `Ask Natalie` (`Whiteboard.tsx:344`) |
| `Sending` | `XrRail.native.tsx:213` | Replaces `Ask` while `asking`, key disabled | A state, not a promise. The key locks with the word, so the two cannot disagree |
| `Clear` | `XrRail.native.tsx:229` | Last, behind a `spatialSpacing.sm` gap, at 80% of a key | No confirmation dialog, for the same reason the 2D tray has none: the engine clears in one undoable step and Undo is directly above. The 2D `aria-label` is `Clear the board` (`Whiteboard.tsx:608`) |

### §2.4 Below the paper

| String | Where | Context | Why it reads this way |
| --- | --- | --- | --- |
| `Recenter` | `XrOrnaments.native.tsx:115` | Puts the board back at its starting placement | Explicit and always reachable, because the app never moves the camera for a child. The only thing that moves the view is the person wearing the headset |
| `Leave` | `XrOrnaments.native.tsx:116` | Pops the route; the session keeps running | Chosen over "Exit" or "Close", which both sound like ending the lesson. Leaving the headset is not leaving Natalie |

### §2.5 Above the paper

The question line renders `problem` from `useTutorStore` verbatim
(`XrOrnaments.native.tsx:38`, via `tutor-xr-screen.native.tsx:288`). It is not
copy this feature writes. It changes when the problem does and at no other time,
so a child working through a page sees the line follow them rather than flicker
on every turn. `XrQuestionLine` returns `null` on an empty string, so there is no
empty bar above the paper before the first turn.

### §2.6 The companion panel

| String | Where | Context | Why it reads this way |
| --- | --- | --- | --- |
| `Natalie · <status>` | `XrChatPanel.native.tsx:58`, name from `tutor-xr-screen.native.tsx:296` | The panel header | Her name and what she is doing, which is the whole header. The interpunct is the 2D product's separator |
| `Here` / `Speaking` / `Thinking` / `Listening` / `Paused` / `Finished` | `tutor-xr-screen.native.tsx:413–418` | `statusLabel(stageKind)` | "Her status, in the same words the 2D presence rail uses." `Here` is the default, so an unknown stage never reads as an error |
| `She can see what you write on the board.` | `tutor-xr-screen.native.tsx:298` | The assurance line under the header | Hardcoded for every band. The 2D screen's equivalent is band-gated and differently worded (§3.3) |
| `N earlier message` / `N earlier messages on the normal screen` | `XrChatPanel.native.tsx:71` | Shown when `earlierCount > 0`; the window is the last 4 turns | The window is deliberately small — a spatial transcript a child has to scroll with a ray while holding a pencil is a transcript they will not read — so the count has to be honest about what is above it |
| `Natalie: <text>` / `You: <text>` | `XrChatPanel.native.tsx:86–92` | Every transcript row | Viro has no bubble, so the speaker has to be a word. `You` rather than the child's name, matching the 2D thread |
| `(N attached)` | `XrChatPanel.native.tsx:88` | Appended to a turn that carried attachments | The attachment is named inside the turn that carried it, never lifted out of it — the rule `TutorThread` and `MessageBubble` already agreed on |
| *action labels* | `XrChatPanel.native.tsx:119`, from `XrChatAction.label` | The live turn's actions, as keys | Locked states render nothing pressable at all, which is what `inputDisabled` means on the 2D composer: a child in a `crisis` state is not offered a button. **Never rendered** — §4 |

## §3 Flags, with replacements

Recorded here. **No code is edited by this file.**

### §3.1 The rail invents three words the product already has — `XrRail.native.tsx:32, 33, 172, 183`

The rail's own header says a child who has used the board on a laptop should not
have to relearn it in a headset. Then it renames the highlighter, the eraser and
the colour picker, and unlabels the colours entirely.

| Now | 2D product | Proposed | Why |
| --- | --- | --- | --- |
| `Mark` | `Highlighter` | `Highlight` | `Mark` is not a word a K–2 reader maps to a highlighter, and it is not the word on the laptop. `Highlight` is the verb, fits the key, and matches the tool id |
| `Erase` | `Eraser` | `Eraser` | No reason to differ. Use the shipped word |
| `Ink` | `Pen color` | `Color` | `Ink` is an adult's word for the same idea. Note the spelling: the 2D product ships `Pen color` and `Purple`, US spelling, on a product whose compliance framing is US-only |
| `""` × 7 | `Black`…`Purple` | The seven colour names | An empty label makes choosing a pen colour a colour-only decision, which is the exact failure the rail's four-signal selection rule exists to prevent. `02-design-plan.md` §4 raises it; the strings already exist at `Whiteboard.tsx:205–211` |

Two more for consistency, lower stakes:

- `Ask` → **`Ask Natalie`** (`XrRail.native.tsx:213`). The 2D `askLabel` is
  `Ask Natalie`, and `Whiteboard.tsx:323` gives the reason: it asks about *your*
  working, which is what makes the difference between asking a tutor and looking
  something up. `Ask` alone on a key beside a conversation panel is ambiguous
  about who is being asked. If the key is too narrow, `Ask her` before `Ask`.
- `Clear` → **`Clear board`** (`XrRail.native.tsx:229`). The 2D `aria-label` is
  `Clear the board`. For the most destructive control on the rail, the object
  should be in the label.

### §3.2 The entry pill says `XR` — `packages/ui/XrBoardButton.tsx:76`

The comment directly above the `aria-label`, five lines up from the visible
label, reads: *"What it does, not what it is. 'XR' is a name for the technology;
a child looking for their board is looking for their board."* The `aria-label` is
`Open spatial whiteboard`. The visible label is `XR`.

A K–2 learner cannot read `XR` and cannot decode it if they could — it is an
initialism for a category name, on a pill whose whole purpose is to be
ignorable-but-findable. The pill is also drawn at `showLabel` in Natalie's rail,
so the word is doing the work.

Proposed: **`Board in space`** at `showLabel`, keeping `Open spatial whiteboard`
as the `aria-label`. It is three short words, it is what the control does, and it
survives the `sm` pill width at `variant="caption"`. If it does not fit, the
second choice is **`In space`**, and the third is dropping the label entirely
(the component already supports `showLabel={false}` and a `Box` glyph) rather
than shipping a technology name to a six-year-old.

### §3.3 The assurance line is not true — `tutor-xr-screen.native.tsx:298`

> `She can see what you write on the board.`

Natalie cannot see the board continuously. She sees it when the child presses Ask
and `exportPng()` hands a PNG to `tutor-screen`'s `handleAskBoard`, which stages
it as an attachment on a turn. That is the whole path, and the store's own
comment says so: the spatial rail exports the PNG, leaves it in `pendingAsk`, and
the tutor screen takes its one path.

A child who believes she is watching will write and wait. This is a truthfulness
problem before it is a copy problem, and on a children's surface it is the kind
that erodes trust in everything else the tutor says.

Proposed: **`Press Ask and she'll see your board.`**

Two secondary points on the same line:

- It is hardcoded for every band. The 2D screen's equivalent
  (`tutor-screen.tsx:199–204`) is gated to `young` and `child` with the reason
  written out — a 9–12 learner reading `Listening` already knows, and a redundant
  line on a workspace-forward surface is noise. The spatial panel shows the line
  to everybody. If the density rule is right in 2D it is right here.
- It is a different sentence from the 2D line
  (`She can still hear you. You can hear her too.`), which answers a different
  fear. Both can be true; they should not be authored in two places.

### §3.4 "Working" is British maths idiom — three strings

`Your working is saved` (`tutor-xr-entry.native.tsx:36`) and
`Bringing your working over` (`XrPanel.native.tsx:387`) use *working* as a noun
for the steps of a solution. It is standard in UK and Commonwealth schools and it
is not how US children are taught to say it, and this product's compliance
framing is US-only (`check-copy-law.mjs` rule `us-framing`). A K–2 US reader
parses *working* as a verb and stops.

Proposed:

- `Your working is saved. Nothing is lost if you go back.` →
  **`Your work is saved. Nothing is lost if you go back.`**
- `Bringing your working over` → **`Bringing your work over`**

The same word appears in code comments throughout the feature, where it is fine —
comments are not shipped copy and the codebase's prose voice is its own.

### §3.5 "The normal screen" names nothing a child can find — two strings

`Your board is waiting on the normal screen` (`XrPanel.native.tsx:406`) and
`N earlier messages on the normal screen` (`XrChatPanel.native.tsx:71`). "Normal"
is a judgement about the other surface rather than a name for it, and a child
wearing a headset has no object called "the normal screen" in front of them.

Proposed:

- `XrPanel.native.tsx:406` → **`This headset can't open your board in space yet.
  Your board is safe. Take the headset off and it's there.`** Three short
  sentences, no em dash, no jargon, and the second sentence is the one that
  matters most. (Cosmetic only until something sets `unsupported` — §4.)
- `XrChatPanel.native.tsx:71` → **`N earlier messages. Take the headset off to
  read them.`**

### §3.6 `Recenter` is above a K–2 reading level — `XrOrnaments.native.tsx:115`

The word is correct, it is the platform convention, and a seven-year-old does not
have it. It is also, on current behaviour, slightly wrong: `recenter()` restores
the fixed `INITIAL_PLACEMENT`, which returns the board to the tracking origin
rather than to wherever the child is now facing (`00-research.md` §4). "Recenter"
promises the second thing.

Proposed: **`Put it back`**. It describes what the key actually does today, it
is four short syllables a K–2 reader has, and it does not promise a head-relative
recentre the code does not perform. If the behaviour is later changed to a true
head-relative recentre, **`Bring it here`** is the honest label for that.

`Leave` is fine and should stay. It was the right call over "Exit" or "Close" —
neither of which distinguishes leaving the headset from ending the lesson — and
the assurance that the session survives is carried by the fact that it does.

### §3.7 Ranking

If only three of these ship, ship §3.3 (the untrue sentence), §3.1 (the four rail
labels that make the board unusable without reading, one of which has no label at
all), and §3.2 (the technology name on the door).

## §4 Strings the code implies and nobody has written

Three surfaces exist in the type system with no copy behind them.

**`XrUnsupportedReason`** (`xr-session.store.ts:37`) has three values —
`no-xr-runtime`, `permission-declined`, `device-not-eligible` — and the store's
comment says each has a different answer and that the copy for them is reviewed
in this file rather than written at the throw site. There is no copy for them.
`XrPanel` draws one sentence for all three, and nothing calls `unsupported()`
anyway, so the union is currently a promise rather than a feature. Drafts, for
when it is wired:

| Reason | Proposed |
| --- | --- |
| `no-xr-runtime` | `This app can't open your board in space on this device. Your board is safe on the tutor screen.` |
| `permission-declined` | `Moyo needs permission to use the headset. You can turn it on in Settings. Your board is safe until then.` |
| `device-not-eligible` | `This headset can't open your board in space yet. Your board is safe on the tutor screen.` |

`permission-declined` is the only one of the three that is actionable, which is
the reason the union exists at all — a child can fix that one and cannot fix the
others.

**`XrChatAction.label`** (`XrChatPanel.types.ts`) names the live turn's actions,
documented as "Try it, Next hint, Back to plan". `tutor-xr-screen.native.tsx`
never passes `actions`, so the key row never renders. The labels should come from
whatever the 2D live turn already uses rather than being written fresh here.

**`skippedRecords`** (`xr-session.store.ts:55`) counts what the spatial renderer
could not draw, and `stroke-of.ts` says the caller counts what it skipped.
Nothing calls `setSkipped`. §5 is the copy that would be needed the moment it is
wired, and that copy is the honest answer to a real, silent data loss.

## §5 The fidelity limits, stated honestly

Two limits are structural. They are not bugs, they will not be fixed by tuning,
and a child or a guardian who notices one and has not been told is entitled to
conclude the board is broken.

### §5.1 Stylus pressure does not render in the headset

`ViroPolyline` takes a single scalar `thickness` in metres for the whole line —
verified in the installed fork's own types at
`/Users/mikevocalz/viro/dist/components/ViroPolyline.d.ts`: *"The thickness of
the line specified in meters."* One number, one line. There is no per-vertex
width.

The engine records pressure. Quickdraw writes `pts: [[dx, dy, pressure], …]` and
its 2D freehand path builds a variable-width outline from that
(`@quickdrawjs/core/src/shapes.js:305`). `stroke-of.ts` drops the third element,
and `XrPanel`'s `send()` never sets `XrSurfaceInput.pressure` on the way in
either, so pressure is lost in both directions.

**What a child sees:** a stroke drawn with an Apple Pencil on the laptop, opened
in the headset, comes back at one even thickness. The shape is right, the
pressure shading is gone.

Proposed copy, for the moment this needs saying rather than as a permanent
banner: **`Your pencil lines look a little different in here. Everything you
wrote is still there.`**

Two related differences that are fixable and should be fixed rather than
explained away (`00-research.md` §5): the spatial stroke resolves through `SIZES`
where the 2D freehand path uses `INK_SIZES`, so a default `m` pen is about 23%
thinner in the headset; and the highlighter is drawn at `SIZES[size]` where the
engine draws it at `SIZES[size] × HIGHLIGHT_SCALE` with `HIGHLIGHT_SCALE = 4.5`,
so an 18-page-pixel band renders as a 4-pixel line at `opacity 0.4` against the
vendor's own `HIGHLIGHT_ALPHA = 0.55`. Those are arithmetic, not a platform
limit.

### §5.2 The spatial board draws strokes only

`strokeOf` returns `null` for every record that is not `type: 'draw'` or
`type: 'highlight'` (`stroke-of.ts:51`). Text, notes, arrows and images — which
the web app's fuller tray can produce — have no spatial representation and are
skipped. ADR-117's Consequences section records the same thing.

**What a child sees:** a typed note or an arrow added on the web app is simply
absent when they put the headset on. Nothing marks the gap. Nothing counts it.
The board looks complete and is not.

The store already has the counter (`skippedRecords`) and nothing fills it. Wiring
it is a small change in `XrBoardInk`; the copy it would enable is what turns a
silent loss into a stated limit:

- One record skipped: **`1 thing you added on the computer isn't shown here. It's
  still on your board.`**
- More than one: **`N things you added on the computer aren't shown here. They're
  still on your board.`**

Placement: the companion panel, under the `earlier messages` line, in
`XR_COLOR.onPanelMuted`. Not on the paper, which is the working surface, and not
as a dialog, which would block a child from the board over something they cannot
act on.

Two constraints on the wording, both of which the drafts above keep. It must say
the work is **still there**, because the fear is deletion rather than display.
And it must not name the tools — "text, notes, arrows and images" is a list a K–2
reader will not finish, and the child does not need to know which primitive
failed to render.

### §5.3 What is honest already

`Redo` on the rail and no redo in 2D is a real divergence between the two
presentations, and it is the right one — a ray overshoots where a tap does not.
It needs no copy.

The chat window of four turns is stated in words by the `N earlier messages`
line, which is why that line exists at all. It is the one place in the feature
where a limit is already declared to the child rather than left to be discovered.

## §6 What nothing checks

For the record, so that the next person does not assume otherwise.

- `tooling/check-copy-law.mjs` reads `apps/web-vite/src` and nothing else. No
  string in this feature is scanned by it.
- `tooling/check-targets.mjs` reads `packages/ui/Button.tsx` and nothing else, so
  `XrBoardButton`'s claim to derive its target from the age band is unverified
  (`03-design-system.md` §6).
- `ViroText` exposes no accessibility role or label in the installed package, so
  none of these strings is announced by a screen reader in the headset. They are
  read visually or not at all, which is why §3's reading-level flags are the
  whole accessibility story on this surface.
- There is no copy deck for the app — only for the marketing site
  (`docs/site/copy-deck.md`). Every string above is a literal at its render site.
  This file is the closest thing to a review that exists, and it is a document
  rather than a gate.
