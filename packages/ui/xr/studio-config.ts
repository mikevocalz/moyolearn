// The app's link to its ReactVision Studio project, in a file the Viro
// renderer does not own.
//
// Platform-neutral on purpose, for the same reason `XrRail.types.ts` is: a
// web bundle may resolve this file, and nothing in it may name
// `@reactvision/react-viro` — no import, not even type-only, because a
// specifier is still RESOLVED by the bundler and resolving one would put the
// native renderer on the web path `web-condition.test.ts` guards.
//
// The values are public client config — `EXPO_PUBLIC_*` ships in the bundle —
// read once here so no screen names an env var. On native the Expo config
// plugin bakes the same pair into the manifest, where `VRTStudioModule` and
// `StudioSceneNavigator` read them; this module is for JS that needs to know
// whether that link exists before mounting a navigator that would fail.
// SOT: apps/mobile/app.config.ts
// SOT-KEYWORDS: xr studio config reactvision project id endpoint platform neutral no viro

export interface StudioConnection {
  /** The Studio project's UUID, or null when the build carries none. */
  readonly projectId: string | null;
  /** The platform endpoint; the known production host is the default. */
  readonly endpoint: string;
  /** Whether the project id and API key both shipped in this build. */
  readonly configured: boolean;
}

/* Static `process.env.X` reads only: Metro inlines EXPO_PUBLIC_* by literal
   name, so a dynamic `process.env[name]` would read undefined at runtime —
   the worst possible answer for a check that decides whether a navigator
   mounts. */
export function studioConnection(): StudioConnection {
  const projectId = process.env.EXPO_PUBLIC_REACTVISION_PROJECT_ID || null;
  return {
    projectId,
    endpoint: process.env.EXPO_PUBLIC_REACTVISION_ENDPOINT || 'https://platform.reactvision.xyz',
    configured: projectId !== null && Boolean(process.env.EXPO_PUBLIC_REACTVISION_API_KEY),
  };
}

/**
 * Local scene key → Studio scene UUID. An entry stays null while the scene
 * has no Studio counterpart — for the tutor board that is the permanent
 * answer: QuickDraw's live surface, the board texture host, the stylus
 * arbiter and Natalie have no Studio asset equivalent, and the repository
 * remains their source of truth. Set a UUID here once a scene is authored in
 * Studio; `XrStudioSceneHost` picks it up with no other change.
 */
export const XR_STUDIO_SCENES = {
  tutorBoard: null,
} as const satisfies Record<string, string | null>;

export type XrStudioSceneKey = keyof typeof XR_STUDIO_SCENES;

/**
 * The Studio scene id a key resolves to, or null when the local scene is the
 * one to run — an unmapped key or an unconfigured project both mean code-first.
 */
export function xrStudioSceneId(key: XrStudioSceneKey): string | null {
  if (!studioConnection().configured) return null;
  return XR_STUDIO_SCENES[key];
}
