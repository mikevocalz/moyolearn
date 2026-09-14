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
export type WhiteboardInk =
  | 'black'
  | 'blue'
  | 'red'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'violet';

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
   *
   * `scale` defaults to 2 — the size the tutor path has always asked for, and
   * the reason is downstream OCR rather than an eye (see either fork). The
   * argument exists for the one caller that is an eye: the spatial paper
   * re-rasters the whole document every time it settles, and a 2× picture of a
   * 1400×1960 page is megabytes of base64 across the bridge for a surface
   * whose pixels land at 1.5 m. That caller asks for 1.
   */
  exportPng(opts?: { scale?: number }): Promise<string | null>;
  /** The document, for the session to keep. Cheap, but not free — debounce it. */
  getSnapshot(): Promise<WhiteboardSnapshot | null>;
  /** Fold in a change from the document — a restore, a merge, or a peer. */
  applyDiff(diff: WhiteboardDiff): void;
  /**
   * Replace the whole board with a document.
   *
   * This is the vendor's own late-joiner move — hand the newcomer a snapshot,
   * then stream diffs — and it is what makes an arriving document safe
   * regardless of when it arrives. `applyDiff` alone was not: the engine mounts
   * asynchronously on both platforms, and a diff that reaches a board with no
   * editor yet is dropped with no error. Measured: a second device fetched a
   * 1224-byte board, merged it, emitted the diff, and rendered blank paper.
   */
  loadSnapshot(snapshot: WhiteboardSnapshot): void;
  setTool(tool: WhiteboardTool): void;
  /** The colour the pen and the highlighter draw in. The eraser ignores it. */
  setInk(ink: WhiteboardInk): void;
  undo(): void;
  /**
   * Put back what `undo` just took.
   *
   * The engine has always had it — Quickdraw's store exposes `undo` and `redo`
   * as a pair — and the 2D tray deliberately does not show it: a tap is a cheap
   * thing to aim, and a tray with one fewer key is a tray a seven-year-old can
   * read. A ray pointed across a room is not cheap to aim, so the spatial rail
   * does show it, and this is the verb it needs.
   */
  redo(): void;
  /**
   * Drive the engine's own input with a pointer it did not receive from a
   * finger — the seam the spatial board draws through.
   *
   * COORDINATES ARE THE ENGINE'S CLIENT SPACE, in CSS pixels relative to the
   * board's own surface, NOT page space and NOT normalised. That is deliberate:
   * the engine maps client to page itself (`editor.screenToPage`), and the one
   * failure mode worth designing against here is transforming a coordinate
   * twice. The spatial caller converts a world hit to `(u, v)` on the 5:7
   * surface once, multiplies by the surface's pixel size, and stops.
   *
   * `phase` is a full gesture, not a click: `'begin'`, then any number of
   * `'move'`, then exactly one of `'end'` or `'cancel'`. A caller that stops
   * sending without one of those leaves the engine mid-stroke — which is what
   * `'cancel'` is for when tracking is lost or the ray leaves the paper.
   */
  injectPointer(sample: WhiteboardPointerSample): void;
  /** Empties the board in one undoable step. */
  clear(): void;
  /**
   * Prove the injected-pointer mapping still holds, and say so in numbers.
   *
   * `injectPointer`'s contract rests on one runtime fact the caller cannot see:
   * the engine's camera is at its default, so client space and page space are
   * the same space. If that ever stops being true the ink lands somewhere the
   * child did not point, and the surface that renders the document from page
   * coordinates draws it in the wrong place — silently, because every layer
   * still reports success. This draws `WHITEBOARD_CALIBRATION_FIXTURE`, reads
   * back the page coordinates the engine actually recorded, and compares them
   * to `whiteboardPagePoint`'s prediction. The probe stroke is aborted rather
   * than committed, so it is never part of the child's board.
   *
   * A failure is a state, not an exception: it resolves `ok: false` with the
   * drift per point so the caller can hold the session in a recoverable
   * `interrupted` state. Blank paper — or worse, ink under the wrong finger —
   * is the outcome this exists to prevent, so it must never be the outcome of
   * the check itself.
   *
   * OPTIONAL BECAUSE ONLY THE INJECTED PATH HAS SOMETHING TO CALIBRATE. The
   * native fork implements it; a fork or a wrapper that does not forward it is
   * a board no ray is pointed at, and a caller that finds it missing is not
   * driving one either.
   */
  calibrate?(): Promise<WhiteboardCalibration>;
}

/** A point in the engine's page space, in page pixels. */
export interface WhiteboardPagePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * `(u, v)` on the board surface to the page coordinate the engine should record.
 *
 * BOTH HALVES OF THE MAPPING, AND THE SECOND ONE IS AN IDENTITY. The caller
 * multiplies a normalised surface hit by the surface's pixel size to get the
 * engine's client space (`injectPointer`), and the engine maps client to page
 * with `screenToPage`, which is `x / camera.z - camera.x`. At the camera the
 * board is pinned to — `{ x: 0, y: 0, z: 1 }` — that is the identity, so the
 * page coordinate equals the client coordinate equals `u · width`.
 *
 * Written as one function rather than two because the identity is the whole
 * claim: a reader who sees only the multiply cannot tell whether the second
 * transform was forgotten or deliberately absent. `calibrate` measures the
 * difference between this prediction and what the engine really did.
 */
export function whiteboardPagePoint(
  u: number,
  v: number,
  surface: { readonly width: number; readonly height: number },
): WhiteboardPagePoint {
  return { x: u * surface.width, y: v * surface.height };
}

/**
 * How far apart two page points are, as the larger of the two axis errors.
 *
 * Chebyshev rather than Euclidean so the number reads as "no axis is off by
 * more than this", which is the thing a tolerance is asserting — a Euclidean
 * distance lets a full tolerance of error on each axis pass as one tolerance.
 */
export function whiteboardPageDrift(a: WhiteboardPagePoint, b: WhiteboardPagePoint): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * The four points `calibrate` draws, as `(u, v)` on the surface.
 *
 * CHOSEN TO BREAK EVERY SYMMETRY A WRONG MAPPING COULD HIDE IN. No two share a
 * `u` or a `v`, and the set is not carried onto itself by swapping the axes or
 * by mirroring either one — so a transposed, flipped or mirrored mapping moves
 * at least one point far enough to fail, which a square or a diagonal would
 * not. They sit well inside the paper so a point can never be clipped, and the
 * closest pair is hundreds of page pixels apart: further than any tolerance
 * worth setting, and far past the engine's own 1.25px sample-dedupe threshold.
 *
 * Four is the smallest count that pins down an affine map — three points fix
 * one and the fourth is the one that catches it being wrong.
 */
export const WHITEBOARD_CALIBRATION_FIXTURE = [
  [0.18, 0.11],
  [0.83, 0.29],
  [0.62, 0.88],
  [0.37, 0.54],
] as const satisfies readonly (readonly [u: number, v: number])[];

/**
 * How far a recorded point may sit from its prediction, in page pixels.
 *
 * Above one pixel because `PointerEvent`'s init dictionary types `clientX` as
 * an integer in UI Events, so a fractional client coordinate can arrive at the
 * engine truncated — under a pixel of error that no amount of correct code
 * removes. Far below the error any real failure produces: a camera left where
 * `fitContent` put it is off by a zoom factor and a page-sized offset, which is
 * tens to hundreds of pixels on every point.
 */
export const WHITEBOARD_CALIBRATION_TOLERANCE_PX = 2;

/** Why a calibration run could not prove the mapping. */
export type WhiteboardCalibrationFailure =
  /** The page has not reported `ready`, so there is no engine to ask. */
  | 'not-ready'
  /** The host gave the board no laid-out box, so there is no surface to probe. */
  | 'no-surface'
  /** The engine recorded no stroke, or one with fewer points than were sent. */
  | 'no-record'
  /** The engine answered nothing in time. */
  | 'timeout'
  /** It answered, and the answer is in the wrong place. */
  | 'drift';

/** One fixture point, as predicted and as the engine actually recorded it. */
export interface WhiteboardCalibrationPoint {
  readonly u: number;
  readonly v: number;
  readonly expected: WhiteboardPagePoint;
  /** `null` when the engine never recorded this point. */
  readonly actual: WhiteboardPagePoint | null;
  /** Page pixels, `whiteboardPageDrift`; `null` when `actual` is. */
  readonly drift: number | null;
}

/**
 * The answer from `WhiteboardHandle.calibrate`.
 *
 * A union rather than a struct with an `ok` flag beside an optional reason: a
 * pass has a worst-case drift and no reason, a failure has a reason and may
 * have no drift at all, and neither of the two mixed states should be possible
 * to write down.
 */
export type WhiteboardCalibration =
  | {
      readonly ok: true;
      /** The largest drift across the fixture, within tolerance. */
      readonly worst: number;
      readonly points: readonly WhiteboardCalibrationPoint[];
    }
  | {
      readonly ok: false;
      readonly reason: WhiteboardCalibrationFailure;
      /** `null` when nothing was measured — the run never got that far. */
      readonly worst: number | null;
      /** Empty when the run failed before the fixture was even predicted. */
      readonly points: readonly WhiteboardCalibrationPoint[];
    };

/** One sample of a synthesised pointer. See `WhiteboardHandle.injectPointer`. */
export interface WhiteboardPointerSample {
  /**
   * `'end'` KEEPS THE STROKE, `'cancel'` THROWS IT AWAY — and the difference is
   * the point of having both.
   *
   * The engine does not draw it. `Editor._bind` binds `pointercancel` to the
   * same `_onUp` handler as `pointerup`, so a cancel dispatched on its own
   * COMMITS the line in progress: a child whose ray slipped off the paper, or
   * whose hand left the tracking volume, would keep a stroke they never meant
   * to make and would have to find undo to get rid of it. That is the failure
   * this phase exists to prevent, so the forks implement the abort instead of
   * documenting the engine's behaviour as if it were the contract.
   *
   * NATIVE, where the injected path actually runs, performs a real abort
   * through the engine's own `_cancelSession`: the record is removed, the
   * batch closes empty so no undo entry is left behind, and the document sees
   * the stroke added and removed rather than kept. The web fork dispatches a
   * plain `pointercancel` and therefore still commits — it exists so the handle
   * has one shape, and no ray is pointed at it today.
   *
   * The eraser is the honest exception on both: erasures are applied as the
   * stroke travels, and the engine's abort ends the batch without putting the
   * shapes back. Cancelling an erase stops it; it does not undo it.
   */
  phase: 'begin' | 'move' | 'end' | 'cancel';
  /** CSS pixels in the board surface's own client space. */
  x: number;
  y: number;
  /**
   * 0–1 where the input device reports it, omitted where it does not.
   *
   * Not faked. A controller ray and a gaze have no pressure, and inventing one
   * gives a child's line a taper that responds to nothing they did — so the
   * engine is left to apply its own default rather than handed a lie.
   */
  pressure?: number;
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
  /**
   * The engine has an editor and will accept work.
   *
   * Everything before this is dropped, silently, on both platforms — which is
   * why the document does not push its contents at the board, it waits to be
   * asked. See `loadSnapshot`.
   */
  onReady?: () => void;
  /**
   * Every calibration run's answer — the board's own as well as the caller's.
   *
   * `calibrate` is a pull and the runs that matter most are pushes: the board
   * checks itself the moment the engine mounts, and again whenever anything
   * reaches the page that could have moved the camera. Neither has a promise
   * to resolve, and a caller that only ever awaited `calibrate()` would learn
   * about a broken mapping one stroke too late. See `WhiteboardHandle.calibrate`
   * for what the result means and why a failure is recoverable.
   */
  onCalibration?: (result: WhiteboardCalibration) => void;
}
