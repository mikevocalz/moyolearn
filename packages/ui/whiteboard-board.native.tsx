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
// SOT: packages/ui/whiteboard.types.ts · https://tryquickdraw.com/docs/react-native/
// SOT-KEYWORDS: whiteboard board native quickdraw webview canvas fork drawing surface stylus

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Quickdraw, type QuickdrawRef } from '@quickdrawjs/react-native';
// The RN binding declares `Snapshot` but does not re-export it. Type-only, so
// nothing from the browser package reaches the native bundle.
import type { Snapshot } from '@quickdrawjs/core';
import type { WhiteboardBoardProps, WhiteboardHandle } from './whiteboard.types.ts';

export const WhiteboardBoard = forwardRef<WhiteboardHandle, WhiteboardBoardProps>(
  function WhiteboardBoard({ snapshot, onLearnerEdit }, ref) {
    const board = useRef<QuickdrawRef>(null);

    useImperativeHandle(ref, () => ({
      /*
        Already a data URL on this side — the bridge cannot carry a Blob, so the
        vendor encodes before it crosses. Same options as the web fork and for
        the same two reasons: keep the paper, and give the recogniser pixels it
        can segment.
      */
      exportPng: async () =>
        (await board.current?.exportPng({ background: true, scale: 2 })) ?? null,
      getSnapshot: async () => (await board.current?.getSnapshot()) ?? null,
      setTool: (tool) => board.current?.setTool(tool),
      setInk: (colour) => board.current?.setStyle('color', colour),
      undo: () => board.current?.undo(),
      clear: () => board.current?.clear(),
    }));

    return (
      <Quickdraw
        ref={board}
        /* Light in both schemes — see the note in `whiteboard.types.ts`. */
        theme="light"
        grid="lines"
        hideUi
        watermark={false}
        snapshot={snapshot as Snapshot | undefined}
        onChange={(_diff, source) => {
          if (source === 'user') onLearnerEdit?.();
        }}
        style={{ flex: 1 }}
        webviewProps={{
          /*
            The board is the scroll surface. Left on, the WebView bounces the
            whole page when a child draws past the bottom edge, so a downstroke
            ends with the paper sliding out from under the pen.
          */
          bounces: false,
          scrollEnabled: false,
          /* Nothing here loads from the network — the page is inlined and the
             engine is dependency-free — so a board must never become a browser.
             This is a learner surface; an accidental navigation off it is an
             unsupervised web view in a child's homework session. */
          originWhitelist: ['about:blank'],
          onShouldStartLoadWithRequest: () => false,
        }}
      />
    );
  },
);
