'use client';
// Full-screen image viewing with a native shared-element zoom, on BOTH
// platforms.
//
// The obvious candidate was expo-router's `Link.AppleZoom` (the App Store card
// transition). It was rejected on two grounds, and the second is the decisive
// one:
//
//  - It is route-based. The zoom is threaded through an href and read from
//    route params by the destination, so the viewer has to become a screen. A
//    photo in a chat thread is not a place you navigate to; WhatsApp and
//    Telegram do not push a URL to look at a picture.
//  - It is iOS 18+. Below that, and on ANDROID, the components pass through and
//    a press degrades to a plain stack push — no transition at all. "Android
//    just pushes" is not the same experience.
//
// Galeria ships a real native view on both (`requireNativeView('Galeria')`), so
// the zoom, the pan-to-dismiss and the paging are the platform's own on iOS and
// Android alike.
//
// `Link.AppleZoom` remains the right tool for a card that opens a screen — a
// lesson card into a lesson, say. It is the wrong tool for this.
// SOT: packages/ui/TutorThread.tsx
// SOT-KEYWORDS: image viewer galeria shared element zoom native android ios lightbox
// Named, not default: the package re-exports its default as `{ Galeria }`, so
// a default import silently binds the whole module namespace and `Galeria.Image`
// resolves to nothing.
import { Galeria } from '@nandorojo/galeria';
import type { ReactElement } from 'react';

export interface ImageViewerProps {
  /** Every image the viewer can page through, in thread order. */
  urls: readonly string[];
  /** Which one this trigger opens. */
  index: number;
  /** The thumbnail. Galeria animates THIS element into the full-screen view. */
  children: ReactElement;
}

export function ImageViewer({ urls, index, children }: ImageViewerProps) {
  return (
    <Galeria urls={urls as string[]} theme="dark">
      <Galeria.Image index={index}>{children}</Galeria.Image>
    </Galeria>
  );
}
