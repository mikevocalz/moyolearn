// Next 16's server instrumentation hook — slo.md §3 names this file as the
// emitter for the latency, traffic and error golden signals, and §7 W-2 as the
// work that unblocks them.
//
// It boots the Node-runtime Sentry client, binds the Block's host→organisation
// reader, and forwards the framework's own request errors. All three are
// deferred behind `register()` so nothing is imported into a runtime that will
// not use it — and the tenancy wiring in particular must not reach the edge
// bundle, since it carries the Payload config.
//
// The EDGE runtime is intentionally not initialised. The only edge surface in
// this app is `middleware.ts`, no rule in slo.md §4 queries it, and the server
// scrubber's mask reaches into `@acme/inference` — which would drag a vendor
// SDK into the middleware bundle to protect a surface that carries no learner
// text. Add `sentry.edge.config.ts` the day middleware does something that can
// fail interestingly.
// SOT: docs/design/slo.md §3 · §7 W-2 · docs/pack/12-systems-design-prompt.md §7
// SOT-KEYWORDS: instrumentation register onRequestError sentry next runtime nodejs edge golden signals
import * as Sentry from '@sentry/nextjs';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    // Before the first request reaches `protectedOperation`, so no district
    // host is ever served by a process that cannot resolve it.
    await import('./lib/tenancy.wiring');
  }
}

/**
 * Next 16's hook for errors thrown inside the framework's own request handling
 * — the ones that never reach a route's `catch`. §3's Errors row names it.
 */
export const onRequestError = Sentry.captureRequestError;
