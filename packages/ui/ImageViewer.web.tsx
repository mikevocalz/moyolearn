'use client';
// Full-screen image viewing on web.
//
// The kit's own `Lightbox` rather than Galeria: there is no shared-element
// transition to inherit in a browser, and the Lightbox already carries the
// brand's yellow pagination, keyboard paging and a real touch target per dot.
// Swapping it for a framer-motion viewer would trade a themed, accessible
// component for a transition the platform cannot do anyway.
// SOT-KEYWORDS: image viewer web lightbox pagination keyboard
import { useCallback, type ReactElement } from 'react';
import { Pressable } from './primitives';
import { Lightbox } from './Lightbox';
import { useInstanceStore, useStore } from './use-instance-store';

export interface ImageViewerProps {
  urls: readonly string[];
  index: number;
  children: ReactElement;
}

export function ImageViewer({ urls, index, children }: ImageViewerProps) {
  const store = useInstanceStore<{ open: boolean }>(() => ({ open: false }));
  const open = useStore(store, (s) => s.open);
  const show = useCallback(() => store.setState({ open: true }), [store]);
  const hide = useCallback(() => store.setState({ open: false }), [store]);

  return (
    <>
      <Pressable onPress={show} aria-label="Open image">
        {children}
      </Pressable>
      <Lightbox images={urls as string[]} initialIndex={index} open={open} onClose={hide} />
    </>
  );
}
