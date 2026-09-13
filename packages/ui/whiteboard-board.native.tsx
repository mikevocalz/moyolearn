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
// element. `src/board-html.generated.js` binds `pointerdown` on its container,
// carries `pointerId`/`setPointerCapture`, and never reads `isTrusted` — so a
// synthesised gesture is indistinguishable to it from a finger, and the engine
// does its own client-to-page mapping, which is the only place that mapping
// should happen.
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
 * One pointer sample as script the page can run.
 *
 * `pointerId` is constant across a gesture because that is what the engine's
 * capture logic keys on; a fresh id per sample reads as a new finger each frame
 * and produces a board covered in single-point dots. `buttons` is 1 while the
 * pen is down and 0 when it lifts, which is how a real pointer stream reports
 * it and what the engine's `pointerup` path expects.
 */
function pointerScript(sample: WhiteboardPointerSample): string {
  const type =
    sample.phase === 'begin'
      ? 'pointerdown'
      : sample.phase === 'move'
        ? 'pointermove'
        : sample.phase === 'end'
          ? 'pointerup'
          : 'pointercancel';
  const init = JSON.stringify({
    pointerId: 1,
    pointerType: 'pen',
    isPrimary: true,
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: sample.x,
    clientY: sample.y,
    buttons: sample.phase === 'begin' || sample.phase === 'move' ? 1 : 0,
    ...(sample.pressure === undefined ? {} : { pressure: sample.pressure }),
  });
  /*
    Dispatched at `#board`, the element the engine binds `pointerdown` on, and
    at `window` for the rest of the gesture — a move or an up that lands outside
    the container still belongs to the stroke in progress, which is exactly the
    case a ray drifting off the paper produces.
  */
  const target = type === 'pointerdown' ? "document.getElementById('board')" : 'window';
  return `(function(){try{var t=${target};if(t)t.dispatchEvent(new PointerEvent(${JSON.stringify(type)},${init}));}catch(e){}})();true;`;
}

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
      */
      injectPointer: (sample) => {
        if (!pageReady.current) return;
        web.current?.injectJavaScript(pointerScript(sample));
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
