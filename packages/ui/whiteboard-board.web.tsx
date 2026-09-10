'use client';
// The drawing surface itself — web. Quickdraw's engine, mounted into a div.
//
// `hideUi`: the stock dock is eleven tools wide and its buttons are 32px, which
// is under the WCAG 2.2 floor of 44 and a long way under this product's K–2
// target of 72. `Whiteboard` draws the controls instead, at the age band's own
// size and in the kit's chrome. `watermark` goes for the same reason doc 37
// bans upsell on a learner surface: nothing on a child's screen advertises.
//
// The ref adaption is the whole job. Quickdraw's web ref exposes the live
// `Editor`; the native one exposes an async bridge over a WebView. Neither is
// the kit's shape, so both are flattened to `WhiteboardHandle` and callers
// never learn which one they got.
//
// The stylesheet is imported here rather than in an app's globals because it is
// not decoration: `.qd-root` is `position: relative` and `.qd-canvas` is
// `position: absolute; inset: 0`, so without it the canvas has no box and the
// board renders as a zero-height strip. Only this fork is ever resolved on web,
// so Metro never sees the import.
// SOT: packages/ui/whiteboard.types.ts · https://tryquickdraw.com/docs/theming/
// SOT-KEYWORDS: whiteboard board web quickdraw editor canvas fork drawing surface

import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Quickdraw, type QuickdrawRef, type Snapshot } from '@quickdrawjs/react';
import '@quickdrawjs/core/quickdraw.css';
import type { WhiteboardBoardProps, WhiteboardHandle } from './whiteboard.types.ts';

export const WhiteboardBoard = forwardRef<WhiteboardHandle, WhiteboardBoardProps>(
  function WhiteboardBoard({ snapshot, onChange, onReady }, ref) {
    const board = useRef<QuickdrawRef>(null);

    /*
      A blob, not a data URL. `exportImage` is the browser-side call and it
      answers in the browser's currency; the handle promises a data URL because
      that is the one form BOTH platforms can produce and the one the capture
      pipeline already reads — `photograph-for-model.web` decodes it straight
      into an `Image`. `FileReader` is the conversion the platform already has,
      so nothing is hand-rolled for it.
    */
    const exportPng = useCallback(async (): Promise<string | null> => {
      const editor = board.current?.editor;
      if (!editor) return null;
      /*
        `background: true` keeps the paper. A transparent PNG of black ink is
        black-on-black the moment anything composites it onto a dark surface,
        and the model would be handed a picture of nothing.

        `scale: 2` because the reader downstream is an OCR pass, not an eye: a
        1× export of a 300dp pane is roughly 300px of handwriting, which is
        under what CRAFT reliably segments. Two is the vendor's own example and
        stays well inside `photograph-for-model`'s 1568px ceiling.
      */
      const blob = await editor.exportImage({ background: true, scale: 2 });
      if (!blob) return null;
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        exportPng,
        getSnapshot: async () => board.current?.editor?.store.getSnapshot() ?? null,
        applyDiff: (diff) => board.current?.editor?.store.applyDiff(diff as never, 'remote'),
        /* `'remote'` keeps the load out of the learner's undo history — a
           restore is not something they should be able to undo their way out
           of, which is the vendor's own note on this call. */
        loadSnapshot: (next) => board.current?.editor?.store.loadSnapshot(next as never, 'remote'),
        setTool: (tool) => board.current?.editor?.setTool(tool),
        setInk: (colour) => board.current?.editor?.setStyle('color', colour),
        undo: () => board.current?.editor?.store.undo(),
        clear: () => board.current?.editor?.clearBoard(),
      }),
      [exportPng],
    );

    return (
      <Quickdraw
        ref={board}
        /* Light in both schemes — see the note in `whiteboard.types.ts`. The
           export is read by a recogniser and by a vision model, and both want
           dark ink on light paper. */
        theme="light"
        /* Ruled paper, not a blank field: a child lining up a column of
           addition needs something to line it up against, and ruled is the
           backdrop arithmetic is done on everywhere else in their life. */
        grid="lines"
        hideUi
        watermark={false}
        snapshot={snapshot as Snapshot | undefined}
        /* Both sources go up. The document needs every change; the CALLER
           decides what "the learner has started" means, because a restored
           board is drawn on and is nobody's work this session. */
        onChange={(diff, source) => onChange?.(diff, source)}
        onMount={() => onReady?.()}
        style={{ width: '100%', height: '100%' }}
      />
    );
  },
);
