// The one API base URL every client fetch resolves against, and the honest
// account of where it came from.
//
// This existed as a copied three-line expression in 23 files, each ending in a
// hardcoded `http://localhost:3001` — a port nothing in this repo serves. Next
// only inlines `NEXT_PUBLIC_*`, so on web the `EXPO_PUBLIC_` value is ALWAYS
// undefined and every one of those files fell through to that dead port: not
// just in local dev, but on any deploy whose env is missing the variable,
// where it silently turned working screens into empty ones.
//
// THE DEAD PORT IS GONE, AND ON A HEADSET IT WAS WORSE THAN DEAD. `localhost`
// on a device is the DEVICE, so every request went to a port on the PICO
// itself and came back as a connection error a child reads as "the app is
// broken". Measured 2026-09-14: the spatial route's session reads failed
// exactly that way while Metro was perfectly reachable, which sent the
// diagnosis through the bundler for an hour.
//
// WHY THE ORIGIN IS A UNION AND NOT A STRING WITH A COMMENT. Three different
// facts produce a base URL — an operator configured one, a browser can use its
// own origin, and a developer's machine can be reached through a tunnel — and
// they fail in three different ways. Callers that only need to build a URL
// take `API_URL` and never see this; the startup check and any diagnostics
// read the variant, so "which of the three am I on" is answerable rather than
// inferred from the shape of a string.
//
// NOTHING HERE THROWS AT IMPORT. A module that can throw while being loaded
// fails in whatever file happened to import it first, which is never the file
// that owns the mistake. `assertApiOriginConfigured` is the operation that can
// fail, and it is called once from app startup.
// SOT: apps/web/app/api/* · packages/app/core/api-fetch.ts
// SOT-KEYWORDS: api url base origin fetch env public app url fail closed adb reverse localhost tunnel

/**
 * The port `apps/web`'s own `dev` script serves, and the one a device tunnel
 * must forward.
 */
const DEV_LOOPBACK_URL = 'http://localhost:3000';

/**
 * Where {@linkcode API_URL} came from.
 *
 * Each variant carries the `url` callers would build a request with, so the
 * discriminant is never needed just to read the value.
 *
 * @see {@linkcode resolveApiOrigin}
 */
export type ApiOrigin =
  /** An operator set `NEXT_PUBLIC_APP_URL` or `EXPO_PUBLIC_APP_URL`. */
  | { readonly kind: 'configured'; readonly url: string }
  /**
   * A browser, using the page's own origin — correct by construction, because
   * the API routes ship in the same Next app.
   */
  | { readonly kind: 'same-origin'; readonly url: '' }
  /**
   * A React Native dev build with nothing configured, pointed at the
   * developer's machine.
   *
   * On a simulator this works as written. On a device or a headset it works
   * ONLY through a reverse tunnel — `adb reverse tcp:3000 tcp:3000` — because
   * `localhost` there means the device.
   */
  | { readonly kind: 'dev-loopback'; readonly url: string }
  /**
   * A native release build with no configured URL. There is no base URL that
   * could be right, so this variant carries none and
   * {@linkcode assertApiOriginConfigured} refuses to let the app start.
   */
  | { readonly kind: 'unconfigured' };

/**
 * Which of the three sources is in play, resolved from the environment.
 *
 * Cheap and synchronous — it reads env values and two globals. Call it for
 * diagnostics or a startup check; call sites that just need a URL should use
 * {@linkcode API_URL}.
 */
export function resolveApiOrigin(): ApiOrigin {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.EXPO_PUBLIC_APP_URL;
  if (configured !== undefined && configured !== '') {
    return { kind: 'configured', url: configured };
  }

  /* `document`, not `window` — React Native defines `window`. */
  if (typeof document !== 'undefined') {
    return { kind: 'same-origin', url: '' };
  }

  /*
    `__DEV__` IS THE REACT NATIVE TEST, and it has to be guarded rather than
    read. Metro defines it; Node does not, so a bare `__DEV__` here is a
    ReferenceError during `next build` and in every server render — this module
    is imported by code that runs on both.
  */
  if (typeof __DEV__ === 'undefined') {
    return { kind: 'same-origin', url: '' };
  }

  return __DEV__ ? { kind: 'dev-loopback', url: DEV_LOOPBACK_URL } : { kind: 'unconfigured' };
}

const origin = resolveApiOrigin();

/**
 * The base every client request is built against — `''` on web, which makes
 * each request same-origin.
 *
 * Empty for a native release build with nothing configured; that build is
 * stopped by {@linkcode assertApiOriginConfigured} rather than by every fetch
 * it would have made.
 *
 * @see {@linkcode resolveApiOrigin} for which source produced it.
 */
export const API_URL: string = origin.kind === 'unconfigured' ? '' : origin.url;

/**
 * Fail a build that cannot reach its API, at the moment it starts.
 *
 * Called once from app startup. A native release with no `EXPO_PUBLIC_APP_URL`
 * has no origin to fall back to and no tunnel to borrow, so it throws — the
 * same fail-closed rule this codebase applies at every other boundary. Finding
 * out at the first fetch instead means one broken screen per child and a
 * support ticket rather than a failed build.
 *
 * On a dev build it warns instead, because the loopback genuinely works on a
 * simulator and needs one documented command on a device.
 *
 * @throws When a native release build has no configured API URL.
 */
export function assertApiOriginConfigured(): void {
  if (origin.kind === 'unconfigured') {
    throw new Error(
      'API_URL: neither NEXT_PUBLIC_APP_URL nor EXPO_PUBLIC_APP_URL is set. A native ' +
        'release build has no origin to fall back to, and a loopback default would ' +
        'point every request at the device itself.',
    );
  }

  if (origin.kind === 'dev-loopback') {
    console.warn(
      `[api-url] EXPO_PUBLIC_APP_URL is unset — using ${origin.url}. On a device or ` +
        'headset that is the DEVICE: run `adb reverse tcp:3000 tcp:3000` with ' +
        '`apps/web` serving, or set the variable.',
    );
  }
}
