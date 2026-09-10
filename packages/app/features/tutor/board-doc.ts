'use client';
// The board's document, as a CRDT — the thing that persists and the thing a
// second person would draw into.
//
// WHY A CRDT AND NOT THE JSON SNAPSHOT IT REPLACES. The snapshot worked and did
// not survive contact with two of anything. It is whole-document, so two
// devices writing the same session are read-modify-write and the later write
// erases the earlier one — the exact flaw `tutor-session.repository`'s header
// already confesses to for `messages`, reproduced for a child's working. And it
// has no seam for a second author at all: a remote tutor drawing on this board
// would be a snapshot race with a child, at stroke rate.
//
// A `Y.Map` keyed by record id IS Quickdraw's own conflict rule. Its sync page
// settles contention per record, last writer wins, and notes that freehand
// sidesteps it entirely because every stroke is a new record. Yjs gives that
// same rule plus the three things the snapshot could not: merge instead of
// clobber, an origin-scoped undo stack, and offline edits that reconcile rather
// than vanish.
//
// TRANSPORT IS DELIBERATELY ABSENT. This workspace has no WebSocket service and
// no realtime vendor — the only streaming route in it is the coach's SSE — so a
// provider here would be infrastructure invented inside a feature. What this
// file guarantees is that adding one later is a constructor call against
// `doc`, not a rewrite: everything below already speaks in `Uint8Array` updates
// and tagged origins. See `docs/design/tutor-board-collaboration.md`.
// SOT: https://tryquickdraw.com/docs/sync/ · docs/design/tutor-board-collaboration.md
// SOT-KEYWORDS: tutor board document yjs crdt collaboration persistence origin undo diff quickdraw

import * as Y from 'yjs';
import type { WhiteboardDiff, WhiteboardSnapshot } from '@acme/ui';

/**
 * Who a change came from, and it is load-bearing in three places at once.
 *
 * Quickdraw's `DiffSource` makes the same distinction for the same reasons —
 * no echo loop, and "their own last stroke vanishes, not a collaborator's" —
 * so the two vocabularies are kept deliberately parallel. `local` is this
 * device's learner; `remote` is anyone else, including this same learner on
 * another device; `restore` is a document being loaded, which is nobody's edit
 * and must never enter an undo stack.
 */
export type BoardOrigin = 'local' | 'remote' | 'restore';

/** The board's records live under one key, so a doc can grow other maps later. */
const RECORDS = 'records';

export interface BoardDoc {
  readonly doc: Y.Doc;
  /**
   * Fold one of Quickdraw's diffs in. Returns nothing: the observer below is
   * what tells the engine about it, including for local edits, so there is
   * exactly one path from document to canvas.
   */
  applyDiff(diff: WhiteboardDiff, origin: BoardOrigin): void;
  /** The whole board, in the shape `loadSnapshot` takes. */
  snapshot(): WhiteboardSnapshot;
  /** Everything this doc knows, for storage or for a joining peer. */
  encode(): Uint8Array;
  /**
   * Merge someone else's state in. Yjs updates COMMUTE, so a stale copy and a
   * fresh one converge in either order — which is what lets a device that drew
   * offline and a server that moved on both keep everything.
   */
  merge(update: Uint8Array, origin: BoardOrigin): void;
  /** Fires for changes this device did not make, with a diff to hand the engine. */
  onRemote(listener: (diff: WhiteboardDiff) => void): () => void;
  /** Undo the LOCAL author's last change, never a collaborator's. */
  undo(): void;
  destroy(): void;
}

/*
  THE VENDOR'S DIFF IS NOT SYMMETRICAL, and reading it as if it were is the
  mistake this comment exists to stop. `added` is `{id: record}`; `updated` is
  `{id: [before, after]}`, so the new record is the SECOND element; `removed` is
  also `{id: record}` and the engine only ever reads its keys. A first pass here
  treated `removed` as an array of ids and dropped every deletion silently.
*/
function put(records: Y.Map<unknown>, bag: Record<string, unknown> | undefined): void {
  if (!bag) return;
  for (const [id, record] of Object.entries(bag)) records.set(id, record);
}

export function createBoardDoc(): BoardDoc {
  const doc = new Y.Doc();
  const records = doc.getMap<unknown>(RECORDS);

  /*
    The undo stack tracks ONE origin. A child pressing undo must not delete the
    demonstration a tutor just drew for them, and a tutor must not be able to
    rub out the child's working by pressing it twice — the rule Quickdraw states
    for its own `remote` source, enforced here at the document instead of at the
    engine so it survives a reconnect and a restore.
  */
  const undoManager = new Y.UndoManager(records, { trackedOrigins: new Set<BoardOrigin>(['local']) });

  const listeners = new Set<(diff: WhiteboardDiff) => void>();

  /*
    ONE PATH FROM DOCUMENT TO CANVAS, and local edits take it too.

    The tempting shortcut is to let the engine keep what it already drew and
    only feed it remote changes. That makes the document a mirror of the canvas
    rather than its source, and the first time an undo or a merge changed a
    record the two would disagree with nothing to reconcile them. Local edits
    are skipped only in the sense that the engine ALREADY has them — the
    observer below filters on origin and the engine's own `applyDiff` is a
    no-op for records it already holds.
  */
  const observer = (event: Y.YMapEvent<unknown>, transaction: Y.Transaction) => {
    if (transaction.origin === 'local') return;
    if (listeners.size === 0) return;
    /*
      Everything that still exists goes out as `added`, never as `updated`.
      The engine's `applyDiff` does `put(record)` for an add and `put(pair[1])`
      for an update — the same call — so a whole-record replace is the honest
      encoding of what a `Y.Map` key change actually is, and it saves carrying
      a `before` this document does not keep.
    */
    const added: Record<string, unknown> = {};
    const removed: Record<string, unknown> = {};
    for (const [id, change] of event.changes.keys) {
      if (change.action === 'delete') removed[id] = change.oldValue;
      else added[id] = records.get(id);
    }
    const hasAdded = Object.keys(added).length > 0;
    const hasRemoved = Object.keys(removed).length > 0;
    if (!hasAdded && !hasRemoved) return;
    const diff: WhiteboardDiff = {};
    if (hasAdded) diff.added = added;
    if (hasRemoved) diff.removed = removed;
    for (const listener of listeners) listener(diff);
  };
  records.observe(observer);

  return {
    doc,
    applyDiff(diff, origin) {
      /*
        One transaction per diff, so a stroke is one undo step rather than one
        per point — and so the origin is attached once, where a listener can
        read it, instead of inferred per key.
      */
      doc.transact(() => {
        put(records, diff.added);
        for (const [id, pair] of Object.entries(diff.updated ?? {})) records.set(id, pair[1]);
        for (const id of Object.keys(diff.removed ?? {})) records.delete(id);
      }, origin);
    },
    snapshot() {
      const store: Record<string, unknown> = {};
      for (const [id, record] of records.entries()) store[id] = record;
      return { document: { store } } as WhiteboardSnapshot;
    },
    encode() {
      return Y.encodeStateAsUpdate(doc);
    },
    merge(update, origin) {
      /*
        A zero-length update is a document nobody has written to yet — storage
        returning "nothing saved". Applying it is harmless and applying it
        anyway would still be harmless; it is skipped so a restore of an empty
        board does not wake the observer for no reason.
      */
      if (update.byteLength === 0) return;
      Y.applyUpdate(doc, update, origin);
    },
    onRemote(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    undo() {
      undoManager.undo();
    },
    destroy() {
      records.unobserve(observer);
      listeners.clear();
      undoManager.destroy();
      doc.destroy();
    },
  };
}

/*
  Base64, because both stores this rides through are string stores — MMKV and
  localStorage — and because the same string is what the server column holds.
  One encoding for the local copy and the remote one means a board written by a
  phone is byte-identical to the one a laptop reads back.

  `btoa`/`atob` exist on both platforms (Hermes ships them); `Buffer` does not
  exist on web without a polyfill, which is why it is not used here.
*/
export function encodeBoardUpdate(update: Uint8Array): string {
  let binary = '';
  for (const byte of update) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeBoardUpdate(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
