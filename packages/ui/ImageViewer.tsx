// TS resolution anchor — bundlers load the .native/.web forks.
//
// Native: Galeria's shared-element zoom, iOS AND Android. Web: the kit Lightbox.
// The rationale for choosing Galeria over expo-router's `Link.AppleZoom` lives
// in the native fork.
//
// Mobbin: https://mobbin.com/screens/63d3bc73-3bc9-4f4d-b8fe-f6732303a9b8 (Claude — tapping a sent image opens it full-screen from the bubble) · https://mobbin.com/screens/4f5f4f46-9b33-46ed-8a54-924c57d3c5de (Clubhouse — image in-thread, viewer opens in place rather than as a pushed screen) · https://mobbin.com/screens/1d54bc84-03b2-4f46-8bca-3c6574ac07e1 (Instagram — same, and pan-to-dismiss returns to the thumbnail). Structure only.
// SOT: packages/ui/ImageViewer.native.tsx
// SOT-KEYWORDS: image viewer anchor galeria lightbox shared element platform fork
export { ImageViewer, type ImageViewerProps } from './ImageViewer.web';
