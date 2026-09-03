// Tutor 3D stage — TS resolution anchor; bundlers load the .native/.web forks.
// A bare .ts/.tsx anchor beats .native.tsx in Metro resolution, so it must
// re-export. Metro takes `./tutor-avatar-3d.native`, everything else lands here
// and gets the browser stage.
//
// This file used to BE the web half, and the whole of it was `return null`:
// there was no renderer off-device, so `tutor-avatar.tsx` named a module that
// drew nothing and web sessions stayed on the 2D monogram permanently. The web
// stage replaced that; the platform split it documented is unchanged, only the
// browser side is now real.
// SOT: ./tutor-avatar-3d.web.tsx · ./tutor-avatar-3d.native.tsx
// SOT-KEYWORDS: tutor avatar 3d anchor fork resolution web native

export { TutorAvatar3D, preloadNatalie, type TutorAvatar3DProps } from './tutor-avatar-3d.web';
export { TutorAvatar3D as default } from './tutor-avatar-3d.web';
