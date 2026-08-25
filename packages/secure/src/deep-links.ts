// Deep-link parameter validation (doc 07-security §2.4).
//
// Two rules from the spec, both enforced here rather than at the routes:
// every deep-link param is parsed through a schema before a screen sees it, and
// "no tokens, usernames, or child identifiers ever appear in URLs". The second
// is the one that needs a check, because it is broken by good intentions —
// `/memory?learner=maya` is a convenient link and a child identifier in a URL
// that lands in browser history, referrer headers, and the family's shared
// clipboard.
//
// Guards are NOT re-implemented here. `Stack.Protected` already applies to deep
// links (doc 06), so this layer does the thing the guard tree cannot: it decides
// whether the params are even a shape the app knows, and refuses before a screen
// renders against a string a stranger chose.
// SOT: docs/pack/07-security-spec.md §2.4
// SOT-KEYWORDS: deep link params zod validation route identifiers url guards

import { z } from 'zod';

/**
 * Never legal in a deep link. Names are checked case-insensitively against the
 * whole param set, so a route added later cannot quietly reintroduce one.
 */
const FORBIDDEN_PARAMS = [
  'token',
  'session',
  'jwt',
  'username',
  'learner',
  'learnerid',
  'child',
  'childid',
  'email',
  'password',
] as const;

const opaqueId = z
  .string()
  .min(1)
  .max(64)
  // Opaque ids only: anything with a separator is usually a composite someone
  // built from a name, and a name in a URL is the rule above being broken.
  .regex(/^[A-Za-z0-9_-]+$/, 'ids in links are opaque — no names, no composites');

/**
 * One schema per deep-linkable route. A route that is not in this map is not
 * deep-linkable, which is the safe default: adding a route should not silently
 * add an externally-reachable surface.
 */
export const DEEP_LINK_ROUTES = {
  '/': z.object({}).strict(),
  '/explore': z.object({}).strict(),
  '/memory': z.object({}).strict(),
  '/ai-activity': z.object({}).strict(),
  '/onboarding/[flow]': z
    .object({
      flow: z.enum(['guardian', 'learner', 'tutor', 'business', 'teacher']),
    })
    .strict(),
  '/split': z.object({ event: opaqueId.optional() }).strict(),
} as const;

export type DeepLinkRoute = keyof typeof DEEP_LINK_ROUTES;

export const isDeepLinkRoute = (route: string): route is DeepLinkRoute =>
  Object.hasOwn(DEEP_LINK_ROUTES, route);

export type DeepLinkResult =
  | { ok: true; route: DeepLinkRoute; params: Record<string, string> }
  | { ok: false; reason: string };

/**
 * The whole check, in the order that fails cheapest first. Returns a result
 * rather than throwing because the caller's job is to route the user somewhere
 * sensible, and an unhandled throw on a cold start from a link is a crash the
 * user reads as "the app is broken".
 */
export function parseDeepLink(route: string, params: Record<string, string>): DeepLinkResult {
  if (!isDeepLinkRoute(route)) {
    return { ok: false, reason: `"${route}" is not a deep-linkable route` };
  }

  for (const name of Object.keys(params)) {
    if (FORBIDDEN_PARAMS.includes(name.toLowerCase() as (typeof FORBIDDEN_PARAMS)[number])) {
      return { ok: false, reason: `"${name}" may never appear in a link (doc 07 §2.4)` };
    }
  }

  const parsed = DEEP_LINK_ROUTES[route].safeParse(params);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues[0]?.message ?? 'invalid link parameters' };
  }

  return { ok: true, route, params: parsed.data as Record<string, string> };
}
