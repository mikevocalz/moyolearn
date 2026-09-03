'use client';
// Web has no live viewfinder here: `GuidedFrame`'s web fork is already the
// file-picker fallback, and the browser's own capture UI is the platform
// affordance. `pickCamera.web` keeps handling it, so this renders nothing and
// exists only so the root layout can mount one name on both platforms.
// SOT: ./CameraSheet.native.tsx
// SOT-KEYWORDS: camera sheet web stub no viewfinder
export function CameraSheet(_props: { ageBand?: string }) {
  return null;
}
