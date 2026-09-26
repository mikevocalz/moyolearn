// What the spatial screen needs, in a file neither platform's renderer owns.
//
// The web fork of the entry must not import the native screen even for a type:
// a type-only import is erased at build, but it is still a specifier a bundler
// resolves, and resolving the native screen means resolving Viro on web. So the
// props live here and all three files — native screen, native entry, web entry
// — read them from the same place.
// SOT: packages/app/features/tutor/tutor-xr-screen.native.tsx
// SOT-KEYWORDS: tutor xr screen props types platform neutral no viro

import type { AgeBand } from '../capture/age-band.ts';

export interface TutorXrScreenProps {
  ageBand: AgeBand;
  /** Leaving the headset. The route pops; the session keeps running. */
  onExit: () => void;
  /** The existing export-and-submit path, unchanged. */
  onAsk: (png: string | null) => void;
  asking?: boolean;
}
