'use client';
// The drawing surface itself — native. The same Quickdraw engine, served to a
// WebView as one inlined HTML page.
//
// WHY A WEBVIEW AND NOT SKIA. `docs/design/reset/00-repo-baseline.md:34` names
// `LearningCanvas` as the mount point for a Skia/WebGPU renderer, and this is
// that mount point filled with something else on purpose: the engine that has
// to run here is the SAME engine the web app runs, because a board a child
// starts on the family laptop has to open on the phone in the car — which is
// the resume contract `tutor-screen` already keeps for the conversation. Two
// renderers would be two snapshot formats and that promise would be a lie. The
// page is bundled inside the package, so there is no network fetch and it works
// offline. A Skia rewrite would be a second implementation of a solved thing.
//
// It adds ONE native module, `react-native-webview`, at the SDK's own pin — so
// this change needs a prebuild, not just a bundle.
//
// Stylus pressure drives stroke thickness with no configuration, and once a
// stylus has been seen, a palm on the glass pans instead of drawing. On a
// homework board that is the difference between writing and smearing.
//
// WHY THIS FILE HOSTS THE WEBVIEW ITSELF, rather than rendering the vendor's
// `<Quickdraw>` component. The spatial board has to put a pointer into this
// engine — it is the only authority for strokes, tools, eraser semantics and
// export, and a second drawing implementation would be a second document. Two
// facts in the installed vendor package make that impossible through the
// component:
//
//   1. `node_modules/@quickdrawjs/react-native/src/webview-entry.js` — the
//      page's `handlers` map has no input verb at all (`init`, `loadSnapshot`,
//      `applyDiff`, `setTheme`, `setReadonly`, `setGrid`, `setTool`, `setStyle`,
//      `undo`, `redo`, `clear`, `fitContent`, `getSnapshot`, `exportPng`), and
//      `window.__qdDispatch` drops any message type it does not know. The page
//      also keeps its `board` in module scope, never on `window`, so injected
//      script cannot reach `board.editor` either.
//   2. `src/index.js` sets `ref: webRef` BEFORE it spreads `...webviewProps`,
//      and its `useImperativeHandle` exposes a fixed verb list with no `post`
//      or `inject`. So passing a ref through `webviewProps` does not add a
//      second ref — it REPLACES the vendor's own and silently kills the whole
//      bridge.
//
// What the vendor does export is everything needed to host the page directly:
// `BOARD_HTML` (the same inlined page, engine and CSS included), `createBridge`
// (the same request/settle protocol) and `encodeDispatch`. So this is the
// vendor's own low-level API, not a fork of it — one engine, one protocol, one
// page, plus a WebView reference this side owns.
//
// The input itself goes in as real `PointerEvent`s on the page's `#board`
// element — ALL FOUR of them, and that is read out of the engine rather than
// assumed. `src/board-html.generated.js` binds its entire pointer set in one
// place, `Editor._bind()`, which opens `let t = this.container` and then binds
// `pointerdown`, `pointermove`, `pointerup` and `pointercancel` to that same
// `t`. There is no second target: the page registers ZERO `window` and ZERO
// `document` listeners, so an event dispatched at `window` is delivered to
// `window` and reaches nothing — propagation descends to a node's ancestors,
// never from `window` down into the document.
//
// `container` is the `#board` div itself, not a wrapper the engine makes:
// `webview-entry.js` passes `document.getElementById('board')` into
// `createQuickdraw`, the editor stores that node unchanged and PREPENDS its two
// canvases into it. `_pointerDown` screens `event.target` and accepts exactly
// those three nodes (container, canvas, overlay), it rejects `button === 2`,
// and nothing in the page reads `isTrusted` — so an event dispatched at
// `#board` is indistinguishable to it from a finger.
//
// Dispatching every phase at `#board` is also what a ray drifting off the paper
// needs. The engine takes the offset itself (`_evPoint` subtracts the
// container's own rect), so a point past the edge arrives as a negative or
// overflowing coordinate rather than as a lost event — a stroke stays a stroke.
//
// A CANCEL HAS TO BE BUILT; THE ENGINE DOES NOT HAVE ONE. `Editor._bind` binds
// `pointercancel` to `_onUp`, the same handler as `pointerup`, so dispatching a
// cancel alone keeps the line. The abort the contract promises is assembled out
// of two events the engine already handles: a `keydown` of `Escape`, which
// `_keyDown` routes to `_cancelSession` → `_abortForPinch` → `store.remove([id])`
// + `store.endBatch()`, and then the terminal pointer event to clear the
// engine's pointer bookkeeping. The record is gone and no undo entry is left
// behind — `endBatch` folds the put and the remove together (`He`), sees an
// empty diff, and pushes nothing. Escape is only ever sent while a stroke this
// side opened is still open, because Escape with no session falls through to
// `setTool('select')` and would change the tool out from under the rail.
//
// WHAT KEEPS THE CAMERA WHERE THE MAPPING NEEDS IT. The injected coordinate is
// client space and the ink is rendered from page space, and those are the same
// space only while the camera is at its default `{x:0, y:0, z:1}` —
// `screenToPage` is `x / z - camera.x`. The engine DOES have a camera event:
// `_afterCamera()` calls `emit('camera')` and `editor.on(...)` returns an
// unsubscribe, so every `setCamera` path reports itself. It cannot be reached
// from here. `webview-entry.js` subscribes to `selection`, `theme` and `grid`
// and not to `camera`, its `handlers` map has no verb to add one, and the page
// keeps `board` in module scope inside an IIFE — so injected script has no
// route to `board.editor.on`. There is also no verb that locks the camera.
//
// So the camera is held still at its inputs instead. Every `setCamera` caller
// in the engine is reached by exactly one of: a `wheel` event, a `keydown`
// (`⌘=`, `⌘-`, `⇧1`, `⇧0`, and Space, which turns the next pointer into a pan),
// a second concurrent pointer (pinch — which also DELETES the stroke in
// progress through `_abortForPinch`), or `fitContent`, which this file never
// calls and `loadSnapshot` is always given `fit: false`. The shim takes those
// three event types at `document` capture — an ancestor of `#board`, so it runs
// before the engine's own listeners whatever the event targets, which a
// listener on `#board` itself would not for a `keydown` aimed at the focused
// container — and stops them, then reports each one so the mapping is
// re-measured rather than assumed. The lock arms itself on the first injected
// pointer and never on a board that only ever sees fingers, so the 2D pane this
// same fork renders keeps its own pinch and its own touch input.
//
// AND THE LOCK IS NOT THE GUARANTEE — THE MEASUREMENT IS. `calibrate` draws
// `WHITEBOARD_CALIBRATION_FIXTURE` into the engine, reads the page coordinates
// out of the record the engine built, and compares them to the prediction. It
// runs itself when the engine mounts and after every blocked camera event, and
// a failure is reported as a value so the session can hold itself open rather
// than drawing into the wrong place.
//
// THE HIDDEN HOST (`tutor-xr-screen.native.tsx` styles, which this file does not
// own). The engine is parked at `left: -boardSurfacePixels.width`, `opacity: 0`.
// VERIFIED BY READING THE ENGINE: nothing this seam needs depends on the host
// being visible, painted or even sized. Input, the store mutation it causes and
// the `change` message it produces all run synchronously inside the dispatch;
// `requestRender` is the only `requestAnimationFrame` user and nothing here
// reads its canvas; `exportImage` builds its own `<canvas>` from `contentBounds`
// and never touches the live one; and `#board` is `position: fixed; inset: 0`,
// so `_evPoint` subtracts an origin of `(0, 0)` whatever the viewport measures —
// the client-to-page identity does not depend on the layout size either. The
// minimum arrangement is therefore: the WebView exists, is attached, and its JS
// still runs. `display: none` is the one thing that breaks it, because it tears
// the surface down and the page restarts.
//
// NEEDS A DEVICE, AND IS NOT ASSUMED HERE: whether `opacity: 0` drops WKWebView
// out of its visible activity state, and whether either platform throttles
// `evaluateJavaScript` rather than only `requestAnimationFrame`, in the hidden
// arrangement. Neither can be read out of a bundle. The finding that belongs to
// the host rather than to this file is that `opacity: 0` buys nothing here: the
// view is already entirely outside the screen, and alpha is the term most
// likely to be the one a platform reads as "not visible". It is the host's line
// to change, and `calibrate`'s `no-surface` answer is what catches the version
// of this that DOES reach this seam — a host that never laid the board out at
// all, which leaves the page with a zero-sized rect to probe.
// SOT: packages/ui/whiteboard.types.ts · https://tryquickdraw.com/docs/react-native/
// SOT-KEYWORDS: whiteboard board native quickdraw webview canvas fork drawing surface stylus pointer injection xr calibration camera lock cancel abort

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ComponentRef,
} from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { BOARD_HTML, createBridge } from '@quickdrawjs/react-native';
// The RN binding declares `Snapshot` but does not re-export it. Type-only, so
// nothing from the browser package reaches the native bundle.
import type { Snapshot } from '@quickdrawjs/core';
import {
  WHITEBOARD_CALIBRATION_FIXTURE,
  WHITEBOARD_CALIBRATION_TOLERANCE_PX,
  whiteboardPageDrift,
  whiteboardPagePoint,
} from './whiteboard.types.ts';
import type {
  WhiteboardBoardProps,
  WhiteboardCalibration,
  WhiteboardCalibrationPoint,
  WhiteboardDiff,
  WhiteboardDiffSource,
  WhiteboardHandle,
  WhiteboardPagePoint,
  WhiteboardPointerSample,
  WhiteboardTool,
} from './whiteboard.types.ts';

/** The props the page is initialised with — the vendor's `init` message. */
const INIT = {
  /* Light in both schemes — see the note in `whiteboard.types.ts`. */
  theme: 'light',
  grid: 'lines',
  readonly: false,
  hideUi: true,
  themeToggle: false,
  gridControl: false,
  watermark: false,
} as const;

/**
 * The phase codes a pointer crosses the bridge as.
 *
 * The wire carries the INDEX, not the event name, and the shim turns it back
 * into a literal from a table it owns. That is the whole reason a batch cannot
 * carry script: with the type name resolved page-side, every field of every
 * packet is a number or `null`, so the serialised batch is digits, signs,
 * commas, brackets and the token `null` — there is no string in it to escape
 * out of and no quote, backslash or angle bracket to escape with.
 *
 * `cancel` is the one code the shim does not resolve through that table: it is
 * an abort the engine has no event for, so the shim branches on the code and
 * builds one. The order here is still the table's order, because `T[0..2]` is
 * indexed by these same numbers.
 */
const PHASE_CODE = {
  begin: 0,
  move: 1,
  end: 2,
  cancel: 3,
} as const satisfies Record<WhiteboardPointerSample['phase'], number>;

type PhaseCode = (typeof PHASE_CODE)[keyof typeof PHASE_CODE];

/**
 * One sample, reduced to the four numbers the page needs.
 *
 * A tuple rather than an object because this shape is written once per input
 * sample and read once per frame: at display rate the difference between
 * `[1,240.5,331,null]` and the same thing with four keys is most of the
 * payload. `null` pressure means the device reported none — see
 * `WhiteboardPointerSample`, where not faking one is the point.
 */
type PointerPacket = readonly [
  phase: PhaseCode,
  x: number,
  y: number,
  pressure: number | null,
];

/**
 * The page-side half of the pointer path, installed once when the page reports
 * `ready`.
 *
 * WHY A SHIM AND NOT A SCRIPT PER SAMPLE. `injectJavaScript` is a crossing into
 * the WebView plus a full parse-and-evaluate of a fresh program on the other
 * side, and a child drawing produces one sample per display frame per stroke.
 * Sending the events instead of the code that makes them turns that into one
 * crossing per FRAME carrying however many samples the frame produced, and the
 * event construction — the part that never varies — is parsed once for the life
 * of the page.
 *
 * `pointerId` is constant across a gesture because that is what the engine's
 * capture logic keys on; a fresh id per sample reads as a new finger each frame
 * and produces a board covered in single-point dots. `buttons` is 1 while the
 * pen is down and 0 once it lifts or cancels, which is how a real pointer
 * stream reports it and what the engine's `pointerup` path expects. `pressure`
 * is set only when one was reported, so the engine falls back to its own
 * default rather than being handed an invented taper.
 *
 * The element is resolved per batch, not captured at install: `#board` is in
 * the page's static HTML and the engine keeps that same node, but a lookup once
 * a frame costs nothing and cannot go stale.
 *
 * `self` is set around every dispatch this shim makes and read by the camera
 * guard, which sits at `document` capture and would otherwise swallow the
 * shim's own `Escape` and its own pointers along with a real one. A flag rather
 * than a property on the event because the dispatch is synchronous: the flag
 * can only be true inside one, so it cannot outlive the event it describes.
 *
 * `down` is the shim's memory of whether it has an open stroke, and it is what
 * makes the abort safe to send: `Escape` with a session cancels it, `Escape`
 * without one falls through `_keyDown` to `setTool('select')`. Tracked here
 * rather than on the native side because the native side knows what it QUEUED
 * and this knows what was actually dispatched.
 *
 * The probe is in the shim rather than assembled on the native side because
 * only the page can measure `#board`. It reports the rect it used before it
 * dispatches anything, so the native side predicts against the same numbers the
 * events were built from and a zero-sized host is a reported state rather than
 * four events into nowhere.
 */
const POINTER_SHIM = `(function(){
if(window.__moyo&&window.__moyo.installed)return;
var W={installed:true,self:false,locked:false,down:false};
var T=['pointerdown','pointermove','pointerup','pointercancel'];
var board=function(){return document.getElementById('board');};
var post=function(m){try{window.ReactNativeWebView.postMessage(JSON.stringify(m));}catch(e){}};
var fire=function(el,ev){W.self=true;try{el.dispatchEvent(ev);}catch(e){}W.self=false;};
var point=function(el,type,x,y,pressure,buttons){
var d={pointerId:1,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y,buttons:buttons};
if(pressure!==null&&pressure!==undefined)d.pressure=pressure;
fire(el,new PointerEvent(type,d));
};
var abort=function(el,x,y){
if(W.down)fire(el,new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true,composed:true}));
W.down=false;
point(el,'pointercancel',x,y,null,0);
};
var guard=function(e){if(W.self)return;e.stopPropagation();post({type:'moyo:camera',why:e.type});};
var lock=function(){
if(W.locked)return;
W.locked=true;
document.addEventListener('wheel',guard,true);
document.addEventListener('keydown',guard,true);
document.addEventListener('pointerdown',guard,true);
};
W.inject=function(b){
var el=board();
if(!el)return;
lock();
for(var i=0;i<b.length;i++){
var s=b[i];
if(s[0]===3){abort(el,s[1],s[2]);continue;}
var t=T[s[0]];
if(!t)continue;
if(s[0]===0)W.down=true;else if(s[0]===2)W.down=false;
point(el,t,s[1],s[2],s[3],s[0]<2?1:0);
}
};
W.probe=function(p){
var el=board(),r=el?el.getBoundingClientRect():null;
var w=r?r.width:0,h=r?r.height:0;
if(!el||!(w>=1)||!(h>=1)){post({type:'moyo:probe',w:0,h:0});return;}
post({type:'moyo:probe',w:w,h:h});
lock();
W.down=true;
for(var i=0;i<p.length;i++){
point(el,i===0?'pointerdown':'pointermove',r.left+p[i][0]*w,r.top+p[i][1]*h,null,1);
}
abort(el,r.left+p[p.length-1][0]*w,r.top+p[p.length-1][1]*h);
};
window.__moyo=W;
})();true;`;

/**
 * How long the engine gets to answer a probe before the run is called lost.
 *
 * Generous against a device under load and short against a child: the whole
 * exchange is four synchronous event dispatches and the messages they produce,
 * so anything approaching this is not slowness, it is an engine that stopped
 * answering — which is exactly the state the caller needs to be told about.
 */
const CALIBRATION_TIMEOUT_MS = 2000;

/** A calibration run in flight, from the request to the engine's answer. */
interface ProbeRun {
  readonly promise: Promise<WhiteboardCalibration>;
  readonly settle: (result: WhiteboardCalibration) => void;
  readonly timer: ReturnType<typeof setTimeout>;
  /** Filled from the page's own rect, before any event is dispatched. */
  expected: readonly WhiteboardPagePoint[] | null;
  /** The record the probe's `begin` opened, once the engine reports it. */
  recordId: string | null;
  /** Held back behind a stroke the child is still drawing. */
  deferred: boolean;
}

/**
 * A stroke record's points, in page space, read without trusting its shape.
 *
 * `pts` IS FLAT, NOT A LIST OF TRIPLES — `[dx, dy, pressure, dx, dy, pressure…]`
 * offset from the record's own `x`/`y`. That is what `_beginDraw` seeds,
 * `_extendDraw` pushes onto, and every reader in the engine walks with a stride
 * of three (`for (let l = 0; l < o.pts.length; l += 3)`). It is vendor-internal
 * and undocumented, so a record that does not match is answered as no points
 * rather than as guessed ones: a calibration that cannot read the engine has to
 * say `no-record`, never invent a pass.
 */
function pagePointsOf(record: unknown): readonly WhiteboardPagePoint[] {
  if (typeof record !== 'object' || record === null) return [];
  const shape = record as { x?: unknown; y?: unknown; props?: unknown };
  if (typeof shape.x !== 'number' || typeof shape.y !== 'number') return [];
  if (typeof shape.props !== 'object' || shape.props === null) return [];
  const pts = (shape.props as { pts?: unknown }).pts;
  if (!Array.isArray(pts)) return [];
  const points: WhiteboardPagePoint[] = [];
  for (let index = 0; index + 2 < pts.length; index += 3) {
    const dx: unknown = pts[index];
    const dy: unknown = pts[index + 1];
    if (typeof dx !== 'number' || typeof dy !== 'number') return [];
    points.push({ x: shape.x + dx, y: shape.y + dy });
  }
  return points;
}

/**
 * Whether a newly added record is the stroke a probe just opened.
 *
 * The engine emits the probe's `added` as its very next change — nothing else
 * is drawing, and the dispatch is synchronous — but "very likely" is not a
 * reason to swallow a diff the document needs. An in-progress freehand stroke
 * is the one record shape that carries `done: false`: a restore, a merge and a
 * peer's stroke all arrive finished. So a change that is not that is passed
 * along to the caller untouched, and the probe times out and says so, rather
 * than quietly eating a change and reporting a pass.
 */
function looksLikeFreshStroke(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as { typeName?: unknown; props?: unknown };
  if (record.typeName !== 'shape') return false;
  if (typeof record.props !== 'object' || record.props === null) return false;
  return (record.props as { done?: unknown }).done === false;
}

/** A run that ended before anything could be measured. */
function calibrationFailure(
  reason: 'not-ready' | 'no-surface' | 'timeout',
  expected: readonly WhiteboardPagePoint[] | null,
): WhiteboardCalibration {
  return {
    ok: false,
    reason,
    worst: null,
    points: (expected ?? []).map((point, index) => ({
      u: WHITEBOARD_CALIBRATION_FIXTURE[index][0],
      v: WHITEBOARD_CALIBRATION_FIXTURE[index][1],
      expected: point,
      actual: null,
      drift: null,
    })),
  };
}

/**
 * The prediction and the engine's answer, point by point, and the verdict.
 *
 * A short stroke fails as `no-record` rather than as drift: fewer points back
 * than went in means the engine dropped samples, and the ones it did keep can
 * be perfectly placed while the mapping is still not something to draw a
 * child's homework through.
 */
function calibrationResult(
  expected: readonly WhiteboardPagePoint[],
  actual: readonly WhiteboardPagePoint[],
): WhiteboardCalibration {
  const points: WhiteboardCalibrationPoint[] = expected.map((point, index) => {
    const measured = index < actual.length ? actual[index] : null;
    return {
      u: WHITEBOARD_CALIBRATION_FIXTURE[index][0],
      v: WHITEBOARD_CALIBRATION_FIXTURE[index][1],
      expected: point,
      actual: measured,
      drift: measured === null ? null : whiteboardPageDrift(point, measured),
    };
  });
  let worst = 0;
  for (const point of points) {
    if (point.drift === null) return { ok: false, reason: 'no-record', worst: null, points };
    worst = Math.max(worst, point.drift);
  }
  if (worst > WHITEBOARD_CALIBRATION_TOLERANCE_PX) {
    return { ok: false, reason: 'drift', worst, points };
  }
  return { ok: true, worst, points };
}

export const WhiteboardBoard = forwardRef<WhiteboardHandle, WhiteboardBoardProps>(
  function WhiteboardBoard({ onChange, onReady, onCalibration }, ref) {
    /*
      `ComponentRef<typeof WebView>`, not `WebView`. react-native-webview 14 —
      the version SDK 58 pins — declares the export as
      `React.FunctionComponent<WebViewProps>` rather than the class it was
      through 13, so naming the component as a ref type no longer describes an
      instance and every prop on the element collapses to `never`. Deriving the
      handle from the component keeps `injectJavaScript` reachable and survives
      the next shape change.
    */
    const web = useRef<ComponentRef<typeof WebView>>(null);

    /*
      The page comes up asynchronously and commands arrive before it does — a
      restore is handed over during the first render. The vendor's own answer is
      a queue that drains on `ready`, and it is kept here rather than
      re-invented: without it the first `loadSnapshot` is dropped and a
      returning child sees blank paper.
    */
    const pageReady = useRef(false);
    const queued = useRef<string[]>([]);
    /* A callback, not a bare closure: the refs it reads are only legible to
       React's rules inside one, and this runs at send time rather than render
       time either way. */
    const send = useCallback((js: string) => {
      if (pageReady.current) web.current?.injectJavaScript(js);
      else queued.current.push(js);
    }, []);
    /*
      BUILT IN AN EFFECT, NOT DURING RENDER. `createBridge` runs immediately and
      closes over the refs above, so building it in the render body is a ref
      read during render. Every caller of it is post-mount anyway — the session
      hands this engine a board only once it has reported `mounted` — and doing
      it here buys the vendor's `dispose()` on the way out, which the component
      form was silently skipping.
    */
    const bridgeRef = useRef<ReturnType<typeof createBridge> | null>(null);
    useEffect(() => {
      const bridge = createBridge(send);
      bridgeRef.current = bridge;
      return () => {
        bridge.dispose();
        bridgeRef.current = null;
      };
    }, [send]);

    /* Callbacks read through a ref so a re-render cannot re-wire the page. */
    const callbacks = useRef({ onChange, onReady, onCalibration });
    useEffect(() => {
      callbacks.current = { onChange, onReady, onCalibration };
    }, [onChange, onReady, onCalibration]);

    /*
      CALIBRATION, AND WHY IT IS A PROBE RATHER THAN A READ.

      There is no way to ask the engine where its camera is from here — the page
      keeps `board` in module scope and exposes no verb for it, which the header
      sets out — so the mapping is established the only way that is left: draw
      through it and see where the ink landed. That has the better property
      anyway. A camera read would confirm one of the terms; a stroke put through
      the whole path confirms the composition of all of them, including the ones
      nobody thought to check.
    */
    const probe = useRef<ProbeRun | null>(null);
    /* Whether a stroke this side opened is still open. A probe dispatched into
       one would call `_pointerDown` on top of a live session and orphan the
       child's record mid-line, so a request that arrives then waits. */
    const strokeOpen = useRef(false);
    const finishProbe = useCallback((result: WhiteboardCalibration) => {
      const run = probe.current;
      if (run === null) return;
      probe.current = null;
      clearTimeout(run.timer);
      run.settle(result);
      /* Pushed as well as resolved: the runs that matter most — mount, and a
         blocked camera event — have no caller holding a promise. */
      callbacks.current.onCalibration?.(result);
    }, []);
    /*
      The tool the engine is holding, mirrored so the probe can put it back.
      `'draw'` is the engine's own constructor default and `init` does not
      change it, so this starts where the engine starts rather than at a guess.
    */
    const toolRef = useRef<WhiteboardTool>('draw');
    const startProbe = useCallback(() => {
      const run = probe.current;
      if (run === null) return;
      run.deferred = false;
      /*
        THE PROBE DRAWS, WHATEVER THE CHILD HAD SELECTED. Under `'eraser'` the
        engine takes `_beginErase` instead of `_beginDraw`: it creates no record
        for the probe to measure, and it RUBS OUT the four points of the child's
        work the fixture passes through. The tool is forced for the length of
        the probe and handed straight back. `'highlight'` would have measured
        correctly, but restoring one tool unconditionally is one behaviour
        instead of two.

        Both legs ride the same `injectJavaScript` queue as the probe itself, so
        they arrive either side of it in the order they were sent.
      */
      const held = toolRef.current;
      if (held !== 'draw') bridgeRef.current?.post({ type: 'setTool', tool: 'draw' });
      web.current?.injectJavaScript(
        `window.__moyo.probe(${JSON.stringify(WHITEBOARD_CALIBRATION_FIXTURE)});true;`,
      );
      if (held !== 'draw') bridgeRef.current?.post({ type: 'setTool', tool: held });
    }, []);
    const calibrate = useCallback((): Promise<WhiteboardCalibration> => {
      /*
        One run at a time, and a second request joins the first rather than
        starting a rival. A blocked wheel gesture arrives as a burst of events
        and every one of them asks for a calibration; four probe strokes racing
        each other through one engine would measure the interference, not the
        mapping.
      */
      const inFlight = probe.current;
      if (inFlight !== null) return inFlight.promise;
      if (!pageReady.current) return Promise.resolve(calibrationFailure('not-ready', null));
      let settle: (result: WhiteboardCalibration) => void = () => undefined;
      const promise = new Promise<WhiteboardCalibration>((resolve) => {
        settle = resolve;
      });
      const run: ProbeRun = {
        promise,
        settle,
        timer: setTimeout(
          () => finishProbe(calibrationFailure('timeout', probe.current?.expected ?? null)),
          CALIBRATION_TIMEOUT_MS,
        ),
        expected: null,
        recordId: null,
        deferred: strokeOpen.current,
      };
      probe.current = run;
      if (!run.deferred) startProbe();
      return promise;
    }, [finishProbe, startProbe]);
    /*
      The probe's own diffs are consumed here rather than forwarded. A phantom
      stroke in the document would net to nothing — added then removed — but
      `onChange` is also how the caller decides the learner has started working,
      and a board that reports a stroke nobody drew is a board that says a child
      began their homework because the camera moved.

      Attribution is safe because a probe only ever runs with no stroke open and
      the engine is single-threaded through the dispatch: the `added` that opens
      the probe's record is the next change the engine can emit. `expected` is
      already set by then — the page posts its rect before it dispatches, and
      the WebView delivers messages in order.
    */
    const consumeProbe = useCallback(
      (diff: WhiteboardDiff): boolean => {
        const run = probe.current;
        if (run === null || run.expected === null) return false;
        const added = Object.keys(diff.added ?? {});
        const removed = Object.keys(diff.removed ?? {});
        const updated = Object.keys(diff.updated ?? {});
        if (run.recordId === null) {
          if (added.length !== 1 || removed.length > 0 || updated.length > 0) return false;
          if (!looksLikeFreshStroke(diff.added?.[added[0]])) return false;
          run.recordId = added[0];
          return true;
        }
        const touched = new Set([...added, ...removed, ...updated]);
        if (touched.size !== 1 || !touched.has(run.recordId)) return false;
        /*
          The removal carries the whole record as it stood — `store.remove`
          writes the live value into `diff.removed`, not a tombstone — so the
          abort that keeps the probe off the child's paper is also the message
          that reports every point of it. Nothing has to be stitched together
          from the updates in between.
        */
        const gone = diff.removed?.[run.recordId];
        if (gone !== undefined) finishProbe(calibrationResult(run.expected, pagePointsOf(gone)));
        return true;
      },
      [finishProbe],
    );

    /*
      THE POINTER BUFFER, AND WHY ORDER IS THE WHOLE CONTRACT.

      Samples are appended in the order they were produced and the flush hands
      the array over whole, so the page dispatches them in that same order — a
      stroke's `end` is always dispatched before the next stroke's `begin`, even
      when both were produced inside one frame and travel in one batch. That is
      the ordering the engine needs: `_pointerUp` clears its session, then
      `_pointerDown` opens the next one. A per-sample send had this property for
      free; a buffer only keeps it if nothing ever reorders or splits the array,
      which is why the flush swaps the whole buffer out rather than draining it.
    */
    const pending = useRef<PointerPacket[]>([]);
    const frame = useRef<number | null>(null);
    const flushPointers = useCallback(() => {
      frame.current = null;
      if (pending.current.length > 0) {
        const batch = pending.current;
        /* A fresh array before the injection, not after: the send is the last
           thing that happens to this batch, and a sample that arrives during it
           belongs to the next frame rather than to a batch already gone. */
        pending.current = [];
        web.current?.injectJavaScript(`window.__moyo.inject(${JSON.stringify(batch)});true;`);
      }
      /* A held-back probe goes in here and nowhere else: the terminal sample it
         was waiting behind has just crossed, so the engine's session is closed
         and the injection order still holds. */
      if (probe.current?.deferred === true && !strokeOpen.current) startProbe();
    }, [startProbe]);
    /*
      A scheduled frame must not outlive the mount — it would fire against a
      released WebView ref — and the buffer it was going to carry must not be
      dropped on the floor either. Unmounting mid-stroke is a real case here:
      the spatial screen tears this pane down when the session ends, which can
      land between a `begin` and its `end`. Flushing gives the engine the
      terminal sample it needs to close the stroke while the page is still
      alive; cancelling first stops the frame from doing it twice.

      The probe is settled BEFORE the flush, not after: an awaiting caller must
      never be left holding a promise against a board that no longer exists, and
      clearing it first is also what stops the flush from starting a new probe
      into a page that is on its way out.
    */
    useEffect(
      () => () => {
        const run = probe.current;
        if (run !== null) {
          probe.current = null;
          clearTimeout(run.timer);
          run.settle(calibrationFailure('not-ready', run.expected));
        }
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        flushPointers();
      },
      [flushPointers],
    );

    const onMessage = useCallback((event: WebViewMessageEvent) => {
      let message: { type?: string; [key: string]: unknown };
      try {
        message = JSON.parse(event.nativeEvent.data) as typeof message;
      } catch {
        return;
      }
      switch (message.type) {
        case 'ready': {
          pageReady.current = true;
          /*
            The shim goes in first and only here. It depends on nothing the
            board sets up — `#board` is in the page's static HTML, and the shim
            resolves it per call anyway — so installing it ahead of `init` means
            there is no window in which the page is up and the pointer path is
            not. A reload would replay `ready` and simply reassign it.
          */
          web.current?.injectJavaScript(POINTER_SHIM);
          /*
            NO SNAPSHOT IN `init`, AND THAT IS A CAMERA DECISION, not a
            simplification. The page's `init` handler calls `fitContent()`
            whenever it is given a snapshot, which leaves the engine's camera at
            an arbitrary zoom and offset depending on what the child had already
            drawn. The spatial board renders the document's own page
            coordinates, and the pointer it injects is in the engine's client
            space — so a fitted camera makes those two disagree by whatever
            factor the fit chose, and the ink lands near the ray instead of
            under it.

            The board is restored through `loadSnapshot` with `fit: false`
            instead, which the session controller already does the moment this
            engine reports `mounted`. Same bytes, same order, camera untouched.
          */
          web.current?.injectJavaScript(
            `window.__qdDispatch(${JSON.stringify({ type: 'init', ...INIT })});true;`,
          );
          for (const js of queued.current.splice(0)) web.current?.injectJavaScript(js);
          break;
        }
        /* `mounted` is the engine reporting an editor exists — the only moment a
           diff can safely be applied, and what `onReady` means to callers. */
        case 'mounted':
          callbacks.current.onReady?.();
          /*
            THE FIRST CALIBRATION RUNS HERE AND NOT AT `ready`. At `ready` the
            page has loaded but `init` has not been answered yet, so there is no
            editor to draw into and nothing to measure. `mounted` is the engine
            saying there is one — the same moment the contract already means by
            "the board will accept work".
          */
          void calibrate();
          break;
        case 'change': {
          const diff = message.diff as WhiteboardDiff;
          if (consumeProbe(diff)) break;
          callbacks.current.onChange?.(diff, message.source as WhiteboardDiffSource);
          break;
        }
        /*
          The page's rect, measured at the moment the probe was dispatched and
          reported before it was. A zero here is a board the host never laid
          out: the prediction cannot be formed, so the run says so rather than
          measuring against a surface that does not exist.
        */
        case 'moyo:probe': {
          const run = probe.current;
          if (run === null) break;
          const width = typeof message.w === 'number' ? message.w : 0;
          const height = typeof message.h === 'number' ? message.h : 0;
          if (width < 1 || height < 1) {
            finishProbe(calibrationFailure('no-surface', null));
            break;
          }
          run.expected = WHITEBOARD_CALIBRATION_FIXTURE.map(([u, v]) =>
            whiteboardPagePoint(u, v, { width, height }),
          );
          break;
        }
        /*
          Something reached the page that the engine would have turned into a
          camera move. The shim stopped it, so the camera should not have
          moved — and "should" is exactly the word this whole path exists to
          replace, so the mapping is measured again rather than trusted.
        */
        case 'moyo:camera':
          void calibrate();
          break;
        case 'snapshot':
          bridgeRef.current?.settle(message.id as string, message.snapshot);
          break;
        case 'export':
          bridgeRef.current?.settle(message.id as string, message.dataUrl);
          break;
      }
    }, [calibrate, consumeProbe, finishProbe]);

    useImperativeHandle(ref, () => ({
      /*
        Already a data URL on this side — the bridge cannot carry a Blob, so the
        page encodes before it crosses. Same options as the web fork and for
        the same two reasons: keep the paper, and give the recogniser pixels it
        can segment.
      */
      exportPng: async (opts) =>
        (await bridgeRef.current?.request<string | null>({
          type: 'exportPng',
          opts: { background: true, scale: opts?.scale ?? 2 },
        })) ?? null,
      getSnapshot: async () => (await bridgeRef.current?.request<Snapshot | null>({ type: 'getSnapshot' })) ?? null,
      applyDiff: (diff) => bridgeRef.current?.post({ type: 'applyDiff', diff }),
      /* `fit: false`: do not re-frame the camera. The board is not panned or
         zoomed on this surface, and a fit on restore would move a child's paper
         under them for no reason they asked for. */
      loadSnapshot: (next) => bridgeRef.current?.post({ type: 'loadSnapshot', snapshot: next, fit: false }),
      setTool: (tool) => {
        /* Mirrored as well as sent: `startProbe` has to know what to put back,
           and this verb is the only thing that moves the engine's tool — the
           stock dock is hidden and the shim's lock stops the keyboard
           shortcuts that would otherwise move it behind this side's back. */
        toolRef.current = tool;
        bridgeRef.current?.post({ type: 'setTool', tool });
      },
      setInk: (colour) => bridgeRef.current?.post({ type: 'setStyle', key: 'color', value: colour }),
      undo: () => bridgeRef.current?.post({ type: 'undo' }),
      redo: () => bridgeRef.current?.post({ type: 'redo' }),
      /*
        Not `bridge.post`: a pointer is not a board command and must not sit in
        the same queue behind one. It is also dropped rather than queued when the
        page is not up — a stroke replayed a second late would land under a hand
        that has already moved on.

        This appends and schedules; it never sends. The frame is booked only
        when none is outstanding, so an arbitrary number of samples costs at
        most one crossing per frame no matter how fast the device produces them.
      */
      injectPointer: (sample) => {
        if (!pageReady.current) return;
        /* Whether the engine has a session open, tracked from what was queued
           rather than from what the page reports: a probe has to be held back
           from the moment the `begin` is accepted, not from the moment the
           engine gets round to confirming it. */
        if (sample.phase === 'begin') strokeOpen.current = true;
        else if (sample.phase !== 'move') strokeOpen.current = false;
        pending.current.push([
          PHASE_CODE[sample.phase],
          sample.x,
          sample.y,
          /* `?? null` and not `|| null`: a reported pressure of 0 is a reading,
             not a missing value, and must reach the engine as one. */
          sample.pressure ?? null,
        ]);
        if (frame.current === null) frame.current = requestAnimationFrame(flushPointers);
      },
      clear: () => bridgeRef.current?.post({ type: 'clear' }),
      calibrate,
    }));

    return (
      <WebView
        ref={web}
        source={{ html: BOARD_HTML }}
        onMessage={onMessage}
        javaScriptEnabled
        style={{ flex: 1, backgroundColor: 'transparent' }}
        hideKeyboardAccessoryView
        setSupportMultipleWindows={false}
        overScrollMode="never"
        /*
          The board is the scroll surface. Left on, the WebView bounces the
          whole page when a child draws past the bottom edge, so a downstroke
          ends with the paper sliding out from under the pen.
        */
        bounces={false}
        scrollEnabled={false}
        /* Nothing here loads from the network — the page is inlined and the
           engine is dependency-free — so a board must never become a browser.
           This is a learner surface; an accidental navigation off it is an
           unsupervised web view in a child's homework session. */
        originWhitelist={['about:blank']}
        onShouldStartLoadWithRequest={() => false}
      />
    );
  },
);
