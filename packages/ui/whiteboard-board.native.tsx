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
// One asymmetry of the engine's is worth knowing at this seam: `pointercancel`
// is bound to `_onUp`, the same handler as `pointerup`, so a cancel COMMITS the
// stroke in progress instead of discarding it.
// SOT: packages/ui/whiteboard.types.ts · https://tryquickdraw.com/docs/react-native/
// SOT-KEYWORDS: whiteboard board native quickdraw webview canvas fork drawing surface stylus pointer injection xr

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { BOARD_HTML, createBridge } from '@quickdrawjs/react-native';
// The RN binding declares `Snapshot` but does not re-export it. Type-only, so
// nothing from the browser package reaches the native bundle.
import type { Snapshot } from '@quickdrawjs/core';
import type {
  WhiteboardBoardProps,
  WhiteboardHandle,
  WhiteboardPointerSample,
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
 */
const POINTER_SHIM = `window.__moyo={inject:function(b){
var el=document.getElementById('board');
if(!el)return;
var T=['pointerdown','pointermove','pointerup','pointercancel'];
for(var i=0;i<b.length;i++){
var s=b[i],t=T[s[0]];
if(!t)continue;
var d={pointerId:1,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,composed:true,clientX:s[1],clientY:s[2],buttons:s[0]<2?1:0};
if(s[3]!==null)d.pressure=s[3];
try{el.dispatchEvent(new PointerEvent(t,d));}catch(e){}
}
}};true;`;

export const WhiteboardBoard = forwardRef<WhiteboardHandle, WhiteboardBoardProps>(
  function WhiteboardBoard({ onChange, onReady }, ref) {
    const web = useRef<WebView>(null);

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
      if (pending.current.length === 0) return;
      const batch = pending.current;
      /* A fresh array before the injection, not after: the send is the last
         thing that happens to this batch, and a sample that arrives during it
         belongs to the next frame rather than to a batch already gone. */
      pending.current = [];
      web.current?.injectJavaScript(`window.__moyo.inject(${JSON.stringify(batch)});true;`);
    }, []);
    /*
      A scheduled frame must not outlive the mount — it would fire against a
      released WebView ref — and the buffer it was going to carry must not be
      dropped on the floor either. Unmounting mid-stroke is a real case here:
      the spatial screen tears this pane down when the session ends, which can
      land between a `begin` and its `end`. Flushing gives the engine the
      terminal sample it needs to close the stroke while the page is still
      alive; cancelling first stops the frame from doing it twice.
    */
    useEffect(
      () => () => {
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        flushPointers();
      },
      [flushPointers],
    );

    /* Callbacks read through a ref so a re-render cannot re-wire the page. */
    const callbacks = useRef({ onChange, onReady });
    useEffect(() => {
      callbacks.current = { onChange, onReady };
    }, [onChange, onReady]);

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
          break;
        case 'change':
          callbacks.current.onChange?.(
            message.diff as never,
            message.source as never,
          );
          break;
        case 'snapshot':
          bridgeRef.current?.settle(message.id as string, message.snapshot);
          break;
        case 'export':
          bridgeRef.current?.settle(message.id as string, message.dataUrl);
          break;
      }
    }, []);

    useImperativeHandle(ref, () => ({
      /*
        Already a data URL on this side — the bridge cannot carry a Blob, so the
        page encodes before it crosses. Same options as the web fork and for
        the same two reasons: keep the paper, and give the recogniser pixels it
        can segment.
      */
      exportPng: async () =>
        (await bridgeRef.current?.request<string | null>({
          type: 'exportPng',
          opts: { background: true, scale: 2 },
        })) ?? null,
      getSnapshot: async () => (await bridgeRef.current?.request<Snapshot | null>({ type: 'getSnapshot' })) ?? null,
      applyDiff: (diff) => bridgeRef.current?.post({ type: 'applyDiff', diff }),
      /* `fit: false`: do not re-frame the camera. The board is not panned or
         zoomed on this surface, and a fit on restore would move a child's paper
         under them for no reason they asked for. */
      loadSnapshot: (next) => bridgeRef.current?.post({ type: 'loadSnapshot', snapshot: next, fit: false }),
      setTool: (tool) => bridgeRef.current?.post({ type: 'setTool', tool }),
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
