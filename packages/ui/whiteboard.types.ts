// The whiteboard's shared contract — the surface both platform forks meet at.
//
// Quickdraw's two bindings do NOT share an API: the web package hands back the
// live `Editor` object, the React Native one hands back an async method bridge
// over a WebView. Neither shape can be the kit's, so this file is the third
// shape both are adapted to — the smallest set of verbs a child's homework
// board actually needs, all of them async so the WebView's round trip is not a
// lie the web fork tells.
// THE PAPER IS ALWAYS LIGHT, and it is the app's one deliberate break from the
// colour scheme. Quickdraw's dark theme draws white ink on `#191713`, and the
// board's output is not just looked at — it is READ. Measured in dark mode: the
// export came back white-on-near-black, the recogniser is trained on the other
// polarity, and the tutor answered "your whiteboard's hard to read, but the
// answer tells me…". The same export is also the thumbnail in the thread, where
// pale strokes on a dark field at 224px wide read as an empty rectangle.
//
// A whiteboard is white — Freeform, Zoom and Apple's own markup all keep the
// canvas light under a dark UI for the same reason. Exporting light while
// displaying dark was the alternative and it is worse in both directions: on
// web it means flipping the live editor's theme mid-export (a visible flash),
// and on native the bridge has no theme call at all, so the two platforms would
// have produced different pictures of the same board.
// SOT: https://tryquickdraw.com/docs/react-native/ · https://tryquickdraw.com/docs/persistence/
// SOT-KEYWORDS: whiteboard board types handle export png snapshot tool fork contract quickdraw

/**
 * The three marks a child makes on their own working, and no more.
 *
 * Quickdraw's engine carries eleven tools (geo shapes, sticky notes, a laser
 * pointer, an image importer that opens a file picker). Doc 23 §5 rules that
 * the second pane holds the thing the learner is stuck on and nothing else, so
 * the stock dock is hidden (`hideUi`) and this is what the kit puts back:
 * write, mark up what you wrote, take it away.
 */
export type WhiteboardTool = 'draw' | 'highlight' | 'eraser';

/**
 * The pen colours the tray offers — a subset of Quickdraw's twelve `ColorId`s.
 *
 * Narrowed here rather than re-exported whole so the control and the engine
 * cannot drift: `Whiteboard`'s roster is `satisfies` this, and a colour the
 * board could draw but the tray never offers is unrepresentable.
 */
export type WhiteboardInk = 'black' | 'blue' | 'red' | 'green' | 'orange' | 'violet';

/**
 * The document, as Quickdraw serialises it.
 *
 * `unknown` rather than the vendor's `Snapshot`: that type lives in
 * `@quickdrawjs/core`, which is a browser module, and importing it into the
 * kit's shared surface would pull DOM code into the native bundle for the sake
 * of a shape nothing here inspects. A snapshot is stored and handed back, never
 * read — `any` is banned and `unknown` is the honest width for that.
 */
export type WhiteboardSnapshot = unknown;

/**
 * One change to the board, in Quickdraw's own shape.
 *
 * Mirrored rather than imported for the reason `WhiteboardSnapshot` gives — the
 * vendor's types live in a browser module — and every field is optional here
 * because the engine reads them as `diff.added || {}`. The asymmetry is the
 * vendor's and is worth stating: `removed` is keyed by id like the others (the
 * engine only ever reads its KEYS), while `updated` holds a `[before, after]`
 * pair, so a consumer that wants the new record has to take the second element.
 */
export interface WhiteboardDiff {
  added?: Record<string, unknown>;
  removed?: Record<string, unknown>;
  updated?: Record<string, [unknown, unknown]>;
}

/** Who made a change. `remote` never enters the local undo stack. */
export type WhiteboardDiffSource = 'user' | 'remote';

export interface WhiteboardHandle {
  /**
   * The board as a PNG data URL, or `null` when there is nothing drawn.
   *
   * `null` is not a failure and must not be reported as one: it is the answer
   * for a board a child cleared, or opened and never touched. The caller says
   * so in words rather than sending an empty picture to the tutor.
   */
  exportPng(): Promise<string | null>;
  /** The document, for the session to keep. Cheap, but not free — debounce it. */
  getSnapshot(): Promise<WhiteboardSnapshot | null>;
  /** Fold in a change from the document — a restore, a merge, or a peer. */
  applyDiff(diff: WhiteboardDiff): void;
  setTool(tool: WhiteboardTool): void;
  /** The colour the pen and the highlighter draw in. The eraser ignores it. */
  setInk(ink: WhiteboardInk): void;
  undo(): void;
  /** Empties the board in one undoable step. */
  clear(): void;
}

export interface WhiteboardBoardProps {
  /** A document to restore at mount. Read once; later changes are ignored. */
  snapshot?: WhiteboardSnapshot;
  /**
   * Every change the board makes, with who made it.
   *
   * Carries the DIFF rather than just firing, because the document upstream
   * (`board-doc.ts`) is a CRDT that has to be told what changed, not that
   * something did. `source` is the vendor's and is the same distinction the
   * document draws: `user` is this learner's hand, `remote` is a restore or a
   * peer and must not be echoed back out.
   */
  onChange?: (diff: WhiteboardDiff, source: WhiteboardDiffSource) => void;
}
