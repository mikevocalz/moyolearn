'use client';
// One board, one document, one set of save timers — for however many places the
// board is being shown at once.
//
// WHY THIS FILE EXISTS. `TutorWorkbench` owned the document, and that was
// correct while the workbench was the only thing that ever showed a board: the
// 2D pane and the collapsed sheet are the SAME workbench instance, which is why
// `tutor-screen` builds it once and hands it to either host. The spatial
// whiteboard breaks that, because it is a second React tree on a second route.
// A document owned by a component mounted in one of them is a document the
// other cannot see, and two components each running `createBoardDoc()` is two
// boards for one piece of homework — the child draws in the headset, comes
// back, and their working is gone.
//
// So ownership moves up to something neither route can unmount: a registry
// keyed by the session the board belongs to. Not a global singleton. A global
// one would hand the next learner on a shared classroom device the last
// learner's strokes, and it would keep a document alive for a session that
// ended hours ago.
//
// WHAT DID NOT CHANGE, and must not. Every ordering decision in the workbench's
// header was paid for with a bug, so all of it is moved verbatim rather than
// reconsidered: the synchronous local restore before first paint, the late
// server merge, the late-joiner order (whole snapshot on ready, diffs after),
// the two debounce windows, the last write on the way out, and the deliberate
// absence of `doc.destroy()` in React cleanup. The only thing added is that
// each of those now happens ONCE for N presentations instead of once per
// component.
//
// SOT: packages/app/features/tutor/board-doc.ts · packages/app/features/tutor/board-storage.ts
// SOT-KEYWORDS: board session controller one document presentation late joiner debounce autosave xr 2d shared ownership

import type { WhiteboardDiff, WhiteboardDiffSource, WhiteboardHandle, WhiteboardSnapshot } from '@acme/ui';
import { createBoardDoc, type BoardDoc } from './board-doc.ts';

/**
 * Where a board is kept, as a port rather than an import.
 *
 * `board-storage` reaches the capture domain's index for the device's storage,
 * and that graph needs a bundler — so importing it here would make every
 * ordering in this file untestable. The app passes `boardPersistence`; a test
 * passes a recorder. One interface, and the second implementation is the reason
 * the first one is trustworthy.
 */
export interface BoardPersistence {
  readLocal(): Uint8Array | null;
  writeLocal(doc: BoardDoc): void;
  fetchRemote(sessionId: string): Promise<Uint8Array | null>;
  pushRemote(sessionId: string, doc: BoardDoc): Promise<void>;
}

/** Unchanged from the workbench: the windows a child's working is worth. */
const LOCAL_SAVE_MS = 400;
const REMOTE_SAVE_MS = 2000;

/**
 * A board with no server session yet is still a board. Opening the spatial
 * screen must not require a successful save, so a draft gets a key of its own
 * rather than being refused one.
 */
export const DRAFT_BOARD_KEY = 'draft';

/**
 * The key a board belongs to. One expression, used by both routes, so the 2D
 * pane and the spatial screen cannot disagree about which board they are on.
 */
export function boardSessionKey(sessionId: string | null): string {
  return sessionId ?? DRAFT_BOARD_KEY;
}

/** What a presentation is, from the document's point of view. */
export interface BoardPresentation {
  /** Stable per presentation — `'pane'`, `'sheet'`, `'xr'`. Identifies the echo. */
  readonly id: string;
  readonly board: WhiteboardHandle;
}

export interface BoardSession {
  readonly key: string;
  readonly doc: BoardDoc;
  /**
   * The board as it stood before the first paint. Every presentation gets the
   * same object, so mounting a second one cannot remount the first one's engine
   * with a different `snapshot` prop mid-stroke.
   */
  readonly initialSnapshot: WhiteboardSnapshot;
  /**
   * The session id can arrive after the board does — a child draws, and the
   * server row appears when the turn is sent. Setting it fetches the server
   * copy once and gives the pending writes somewhere to go.
   */
  setSessionId(id: string | null): void;
  /**
   * A presentation's engine reports itself ready. It is handed the WHOLE
   * document and then streams diffs, in that order, because a diff that reaches
   * an engine with no editor is dropped silently and with no error.
   */
  attach(presentation: BoardPresentation): () => void;
  /** An engine change. Only `'user'` is this hand's work; the rest is echo. */
  change(presentationId: string, diff: WhiteboardDiff, source: WhiteboardDiffSource): void;
  /** Write now rather than on the next tick of a debounce. */
  flush(): void;
}

interface Registered {
  session: BoardSession;
  /** How many mounted trees are using it. Zero does NOT dispose — see below. */
  holders: number;
}

const registry = new Map<string, Registered>();

function createSession(key: string, store: BoardPersistence): BoardSession {
  const doc = createBoardDoc();

  /*
    `restore`, not `remote`: a document being loaded is nobody's edit. It must
    not enter an undo stack and must not make an untouched board count as work.
    Read here, at construction, because construction happens during the first
    render that asks for the session — which is the same moment the workbench's
    lazy `useState` initialiser used to run.
  */
  const local = store.readLocal();
  if (local) doc.merge(local, 'restore');
  const initialSnapshot = doc.snapshot();

  const presentations = new Map<string, BoardPresentation>();
  let sessionId: string | null = null;
  let fetched: string | null = null;
  let localTimer: ReturnType<typeof setTimeout> | null = null;
  let remoteTimer: ReturnType<typeof setTimeout> | null = null;

  const write = () => {
    store.writeLocal(doc);
    if (sessionId !== null) void store.pushRemote(sessionId, doc);
  };

  return {
    key,
    doc,
    initialSnapshot,

    setSessionId(id) {
      sessionId = id;
      if (id === null || fetched === id) return;
      /*
        Once per id, not once per mount. Entering and leaving the spatial screen
        re-runs every effect in the 2D tree; a fetch per mount would re-merge
        the server's copy over strokes drawn since, at route-transition rate.
      */
      fetched = id;
      void store.fetchRemote(id).then((update) => {
        if (update !== null) doc.merge(update, 'remote');
      });
    },

    attach(presentation) {
      presentations.set(presentation.id, presentation);
      presentation.board.loadSnapshot(doc.snapshot());
      const stop = doc.onRemote((diff) => presentation.board.applyDiff(diff));
      return () => {
        stop();
        presentations.delete(presentation.id);
      };
    },

    change(presentationId, diff, source) {
      /*
        A change the engine calls `remote` is one the document just gave it.
        Writing it back is the echo loop Quickdraw's sync page names first.
      */
      if (source !== 'user') return;
      doc.applyDiff(diff, 'local');

      /*
        AND THE OTHER ENGINES ARE TOLD DIRECTLY, because `onRemote` is blind to
        local origins by design (see `board-doc`'s header) — so a stroke drawn
        into one attached engine would never reach a second one. Today there is
        one Quickdraw engine and this loop does nothing; it exists so that the
        day a second presentation attaches a real engine, the strokes are not
        one-directional and nobody has to rediscover why.
      */
      for (const [id, other] of presentations) {
        if (id !== presentationId) other.board.applyDiff(diff);
      }

      if (localTimer !== null) clearTimeout(localTimer);
      localTimer = setTimeout(() => store.writeLocal(doc), LOCAL_SAVE_MS);

      if (remoteTimer !== null) clearTimeout(remoteTimer);
      remoteTimer = setTimeout(() => {
        if (sessionId !== null) void store.pushRemote(sessionId, doc);
      }, REMOTE_SAVE_MS);
    },

    flush() {
      if (localTimer !== null) clearTimeout(localTimer);
      if (remoteTimer !== null) clearTimeout(remoteTimer);
      localTimer = null;
      remoteTimer = null;
      /*
        A last write, not a cancelled one. The timers are debounces, and
        dropping a pending one loses whatever the child drew in the last breath
        before they navigated away.
      */
      write();
    },
  };
}

/**
 * The session for this board, created on first ask.
 *
 * Callers pair this with `releaseBoardSession` in the same effect's cleanup.
 */
export function acquireBoardSession(key: string, store: BoardPersistence): BoardSession {
  const found = registry.get(key);
  if (found) {
    found.holders += 1;
    return found.session;
  }
  const created: Registered = { session: createSession(key, store), holders: 1 };
  registry.set(key, created);
  return created.session;
}

/**
 * One holder is done with the board.
 *
 * THE SESSION SURVIVES REACHING ZERO HOLDERS, and that is the entire point of
 * the file. Navigating from the tutor screen to the spatial screen unmounts the
 * 2D tree before the XR tree mounts — a registry that disposed at zero would
 * throw the document away in the gap and hand the headset an empty board. It
 * also survives React's development double-mount for the same reason.
 *
 * What it does do is write, because reaching zero holders is the moment the
 * child is not looking at their working anywhere.
 */
export function releaseBoardSession(key: string): void {
  const found = registry.get(key);
  if (!found) return;
  found.holders = Math.max(0, found.holders - 1);
  if (found.holders === 0) found.session.flush();
}

/**
 * The session is over, or the person using the device changed.
 *
 * Called on session end and on learner switch. The document is destroyed HERE
 * and nowhere else — never from a React cleanup, which runs between a
 * double-mount's two halves and would unobserve a document the remount then
 * keeps using (a board that merged 3613 bytes, held nine records, and drew
 * blank paper).
 *
 * NOTE ON LEARNER SCOPE. The local copy this restores from is a single device
 * slot (`problemStorage`), not a per-learner one, so isolating two learners on
 * one device needs that storage key scoped as well. That is pre-existing and
 * outside this change; disposing here is the half that is in it.
 */
export function disposeBoardSession(key: string): void {
  const found = registry.get(key);
  if (!found) return;
  registry.delete(key);
  found.session.flush();
  found.session.doc.destroy();
}

/** Every board on the device, for a learner switch or a sign-out. */
export function disposeAllBoardSessions(): void {
  for (const key of [...registry.keys()]) disposeBoardSession(key);
}
