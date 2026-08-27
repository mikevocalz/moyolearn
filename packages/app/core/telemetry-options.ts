// The shared Sentry init options — doc 35 §4's base config, built in exactly
// one place so "sendDefaultPii is false everywhere" and "tracesSampleRate is 0"
// are properties of a function rather than of four files agreeing.
//
// PURE. No Sentry import, no env read: each surface hands in what it read from
// ITS bundler's env (a client bundle can only inline a literal
// `process.env.NEXT_PUBLIC_…` read, so the reads cannot live here) and spreads
// the result into its own `Sentry.init`. Both SDKs accept this shape
// structurally, the same arrangement as `telemetry-scrub.ts`.
//
// DSN CONVENTION (doc 35 §3, adjusted): the three-project split (`moyo-mobile`
// / `moyo-web` / `moyo-server`) is DEFERRED — the free Developer plan is
// single-seat and project provisioning for the split is paid-gated, so v1 runs
// the one `moyolearn` project and the `surface` tag below stands in for it.
// Each init site therefore reads a per-surface DSN var FIRST and falls back to
// the shared one, so the split later is an env edit, not a refactor:
//
//   server  SENTRY_DSN_SERVER              ?? SENTRY_DSN
//   web     NEXT_PUBLIC_SENTRY_DSN_WEB     ?? NEXT_PUBLIC_SENTRY_DSN
//   mobile  EXPO_PUBLIC_SENTRY_DSN_MOBILE  ?? EXPO_PUBLIC_SENTRY_DSN
//
// ---------------------------------------------------------------------------
// SENTRY-UI CHECKLIST — the settings that live in Sentry's UI, not in code.
// Doc 35 §7's verification checklist rows 7, 8 and 12 point here; re-verify
// after any org change. All against org $SENTRY_ORG, project $SENTRY_PROJECT.
//
//   [ ] Three-project split (§3): DEFERRED — free tier is single-seat and the
//       split's provisioning is paid-gated; the `surface` tag is the stand-in.
//       When it lands: create `moyo-mobile`/`moyo-web`/`moyo-server`, set the
//       per-surface DSN vars above, and re-run this whole checklist per project.
//   [ ] Spike protection ON, with notifications (§6.3).
//   [ ] Inbound filters ON for the web surface: browser extensions, web
//       crawlers, legacy browsers, localhost (§4.3, §7 row 8) — server-side,
//       pre-quota, free.
//   [ ] Security & Privacy → "Prevent Storing of IP Addresses" ON (§7.1 —
//       amended COPPA, eff. Apr 22 2026: IP is a child's personal information).
//   [x] DSN key rate limit 50 errors/hour (set 2026-08-26) — smooths storms
//       server-side; the client-side breaker in `telemetry-storm.ts` is still
//       what protects the monthly quota from sustained burn.
//   [x] JS-loader Replay/Performance toggles OFF (set 2026-08-26) — §7.4:
//       replay on a learner surface is a recording of a child's work.
//   [ ] Burn alert (§6.1): metric alert, event count > daily budget × 1.5 in
//       24h → email. Daily budget = 5000/30 ≈ 166, so threshold 250/24h while
//       the project is unsplit.
//   [ ] New-issue alert (first occurrence) + regression alert; weekly digest.
// ---------------------------------------------------------------------------
// SOT: docs/pack/35-sentry-free-tier.md §3 §4 §6 §7 · docs/design/slo.md §3.1
// SOT-KEYWORDS: sentry init options factory shared base enabled production sendDefaultPii tracesSampleRate ignoreErrors surface tag dsn checklist ui burn alert

/** Doc 35 §3's four surfaces — the `surface` tag standing in for the project split. */
export type TelemetrySurface = 'mobile' | 'web' | 'server' | 'worker';

export interface TelemetryInitInput {
  /** Already resolved per-surface (see the header's DSN convention). */
  readonly dsn: string | undefined;
  readonly surface: TelemetrySurface;
  /** `'production' | 'preview' | 'development'` — whatever the platform names it. */
  readonly environment: string | undefined;
  /**
   * The ONLY gate on sending. Doc 35 §2: local dev sends nothing, ever — dev
   * noise is the #1 silent quota leak. Each surface passes its own truth
   * (`NODE_ENV === 'production'` on the server and web, `!__DEV__` on mobile).
   */
  readonly isProduction: boolean;
  /** Release id, when the build knows one. Omitted, not empty, when it does not. */
  readonly release?: string;
}

/**
 * The initial scope's tags. `surface` always; `runtime` only where doc 35 §3
 * separates Payload-server from worker traffic inside one project. Both are in
 * §7.7's tag allowlist, which `tooling/check-sentry-invariants.mjs` enforces.
 *
 * A type alias, NOT an interface — Sentry's `ScopeContext.tags` is an index
 * signature, and only object-literal types are implicitly compatible with one.
 */
export type TelemetryTags = {
  readonly surface: TelemetrySurface;
  readonly runtime?: 'server' | 'worker';
};

/** Doc 35 §4's base, as a closed shape both SDKs accept structurally. */
export interface TelemetryInitOptions {
  readonly dsn: string | undefined;
  readonly enabled: boolean;
  readonly environment: string;
  readonly release?: string;
  readonly sendDefaultPii: false;
  readonly maxBreadcrumbs: number;
  readonly sampleRate: number;
  readonly tracesSampleRate: 0;
  readonly ignoreErrors: (string | RegExp)[];
  readonly initialScope: { tags: TelemetryTags };
}

/**
 * Doc 35 §4's `ignoreErrors`, verbatim. All expected-environment noise: a
 * dropped connection on school wi-fi is a state, not an error (§4.1), and each
 * of these dropped client-side costs no quota at all.
 */
export const TELEMETRY_IGNORE_ERRORS: readonly (string | RegExp)[] = [
  'Network request failed',
  'Failed to fetch',
  'Load failed',
  'AbortError',
  'TimeoutError',
  /ResizeObserver loop/,
  /Non-Error promise rejection/,
];

/**
 * Builds the base every `Sentry.init` spreads.
 *
 * `enabled` requires production AND a DSN — §2's "env-gated DSN" and
 * `enabled: production` folded into one flag, so a preview deploy with no DSN
 * and a dev checkout with one both send nothing. `sampleRate: 1` beside
 * `tracesSampleRate: 0` is §2's whole role definition: every unique real error,
 * zero perf events (the ≤2s SLO is measured by our own timing rows, not by
 * vendor traces; the sanctioned exception — a `tracesSampler` at ~0.02 for the
 * capture→first-token transaction during Phase-1 tuning — is a deliberate,
 * temporary edit at ONE call site, never a default here).
 */
export function telemetryInitOptions(input: TelemetryInitInput): TelemetryInitOptions {
  const tags: TelemetryTags =
    input.surface === 'server' || input.surface === 'worker'
      ? { surface: input.surface, runtime: input.surface }
      : { surface: input.surface };

  return {
    dsn: input.dsn,
    enabled: input.isProduction && input.dsn !== undefined && input.dsn !== '',
    environment: input.environment ?? 'development',
    ...(input.release === undefined ? {} : { release: input.release }),
    sendDefaultPii: false,
    maxBreadcrumbs: 30,
    sampleRate: 1,
    tracesSampleRate: 0,
    ignoreErrors: [...TELEMETRY_IGNORE_ERRORS],
    initialScope: { tags },
  };
}
