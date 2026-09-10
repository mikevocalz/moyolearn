# The tutor board, shared

**Date:** 2026-09-09 · **Status:** document layer built; the collaborative
surface is designed here and not yet built · **Surface:** `learner.tutor`, the
whiteboard in the second pane

The board became a CRDT so that a second person could draw on it. This is what
that second person's presence has to look like from a nine-year-old's side of
the screen, and what it has to cost them. The rules below are not preferences —
each one exists because the alternative does something specific to a child.

---

## 1. Who is in the room

Three actors, and conflating any two of them is the failure mode this section
exists to prevent.

| Actor | Where they live | What they do to the board |
|---|---|---|
| **The learner** | The whole screen | Draws. Owns the paper. |
| **Natalie** (AI) | The trailing pane | Never draws. Reads the board when asked. |
| **A remote human tutor** | A strip on the board itself | Draws, in their own ink. |

Natalie already occupies a column and a voice. A human tutor arriving must not
inherit either: a child who cannot tell whether the thing writing on their page
is the AI they have been talking to or an adult who has just joined has been
handed the worst version of both.

**So: the human's presence lives ON the board, never in Natalie's pane, and
Natalie's pane never reports a human.** Two helpers, two places, no merge.

---

## 2. The ten rules

### R1 · Both draw at once. There is no talking stick.
No lock, no request-to-draw, no "the tutor has control". A lock is a mode a
child has to ask permission to leave, and asking an adult for permission to
write on your own homework is the wrong lesson to encode in a UI. The document
already makes simultaneous drawing safe — freehand is one record per stroke, so
two hands never contend.

### R2 · Every mark is attributed, always, without being asked.
The tutor's ink is a colour the learner is never offered, so it can never be
mistaken for their own. Their name rides beside their most recent stroke and
fades after a few seconds — long enough to answer "who wrote that", short enough
not to become furniture.

*Why it is absolute:* a child looking at their own working has to be able to
tell which parts are theirs. If they cannot, the board stops being a record of
their thinking, which is the only thing it is for.

### R3 · Undo is yours. Clear is asymmetric.
Undo walks the local author's own stack and nobody else's — the document
enforces it by origin, not the UI, so it survives a reconnect. A child pressing
undo can never delete the demonstration a tutor just drew for them; a tutor
pressing it can never rub out the child's working.

**Clear is the exception and it is not symmetric.** The learner may clear the
whole board — it is their paper. A tutor may clear **only their own marks**, and
the control says so ("Clear my marks"). An adult who can wipe a child's work in
one press is a feature nobody needs and a support ticket everyone gets.

When someone else has marks on the board, the learner's Clear asks first, once,
naming what goes: *"This clears everything, including what Ms Adeyemi drew."*
That is the only confirm on this surface (H5 — a confirm for a destructive act
that is not otherwise recoverable across authors).

### R4 · Pointing is not drawing.
A tutor arrives holding the **laser**, not the pen. Ephemeral trails, no record
written, nothing to undo. Most of what a tutor does on a board is *look here* —
and a helper who leaves permanent marks all over a child's page every time they
gesture has vandalised the record of that child's thinking.

Switching to the pen is a deliberate act, and it is the tutor's second press,
not their first.

### R5 · Arrival and departure are announced, in words, on the board.
> **Ms Adeyemi joined your board.** · **Ms Adeyemi left.**

An adult appearing silently on a child's surface is the thing this rule exists
to make impossible. It is a line on the board, not a toast: a toast is a thing
you can miss (H1).

### R6 · While anyone else is connected, the board says so, permanently.
A quiet, non-dismissible strip: *"Ms Adeyemi can see this board."* Present tense,
their name, no icon-only shorthand. It does not fade and it cannot be closed,
because "who can see me" is not a notification — it is a state, and a child is
entitled to it for as long as it is true.

This is a child-safety requirement before it is a UX one (doc 07 §3).

### R7 · A dropped connection is said out loud, and costs nothing.
> **You're offline — Ms Adeyemi can't see this yet. Keep going; it'll catch up.**

Strokes drawn offline merge on reconnect; that is what the CRDT buys and it is
the only reason the copy can promise it. Never silently discard a stroke, and
never block the pen on a socket (H1, H9).

### R8 · The learner can end it.
One control, always reachable, in the strip from R6: **Only me**. It disconnects
the other party from the board — not from the lesson, not from the call, just
from the paper. No confirm, no explanation demanded, no "are you sure".

A child who cannot make an adult stop drawing on their homework does not have a
board; they have a supervised exercise.

### R9 · The record is a record.
A remote adult drawing on a child's board is an event in the session, and it
lands in the transcript the way every other turn does — who joined, when, when
they left. A guardian reviewing the session sees it without asking for it.

### R10 · Ask Natalie keeps working, and it asks about the whole board.
Nothing about a human being present changes what "Ask Natalie" does. The export
carries everything on the paper, including the tutor's marks, because that is
what the child is looking at and what their question is about.

---

## 3. What is built, and what is not

**Built (2026-09-09).**
- `board-doc.ts` — the board as a `Y.Map` keyed by record id, which is
  Quickdraw's own per-record conflict rule with merge, offline reconnect and an
  origin-scoped undo stack on top. Origins are already tagged
  `local` / `remote` / `restore`, so R3 is enforced at the document today.
- `board-storage.ts` + `PUT|GET /api/tutor/session/board` — the board survives a
  reload (device) and a change of device (server). Every push carries the whole
  document, so a lost merge repairs itself on the next one.
- The engine speaks diffs in both directions (`onChange` in, `applyDiff` out),
  which is the same pipe a peer's stroke would arrive through.

**Not built, and named rather than implied.**
- **Transport.** This workspace has no WebSocket service and no realtime vendor;
  the only streaming route in it is the coach's SSE. A provider is a
  constructor call against `doc` and no refactor of anything above — but
  choosing where it runs is an infrastructure decision, not a thing to invent
  inside a feature. On this stack the shape that needs no new infrastructure is
  SSE down plus POST up through a Next route, which is what the coach already
  proves works on Vercel.
- **Awareness.** Quickdraw's sync page moves document diffs only and says
  nothing about cursors, laser trails or identity; Yjs `awareness` is the
  natural carrier and rides the same transport. R2's name label and R4's laser
  both depend on it.
- **Identity and authorisation.** Which adult may join which child's board, and
  on whose say-so, is a safeguarding decision and belongs in an ADR with doc 07
  open, not here.

## 4. The one thing to get right first

If only part of this is ever built, build **R2 and R6** — attribution and
visible presence. A board where a child cannot tell whose ink is whose, or
cannot see that someone is watching, is worse than a board with no
collaboration at all: it takes the one artefact that recorded their thinking and
makes it untrustworthy to them.
