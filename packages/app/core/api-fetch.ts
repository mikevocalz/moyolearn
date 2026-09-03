// The one client read helper every `fetch`-backed Query hook goes through, and
// the retry predicate the QueryClient reads.
//
// This existed as four byte-identical `getJson` copies (assignments, learner
// assignments, classes, reports) and thirteen sites throwing a bare
// `new Error(\`HTTP ${status}\`)` — a string with the status baked into its
// message and therefore unreadable by anything downstream. Two failures came
// out of that, both visible on screen:
//
//  1. The QueryClient's blanket `retry: 2` treated 401/403/404 as transient.
//     Those never come good on a retry, so a signed-out or foreign read spent
//     the full exponential backoff in `status: 'pending'` — and a screen whose
//     pending branch is a skeleton renders as a blank page for seven seconds
//     before its honest error branch ever runs. The error states were written
//     correctly; nothing reached them in time.
//  2. A screen could not tell "this row does not exist" (404 — the silent-drop
//     wall foreign ids must hit, doc 36 §4.4) from "the read failed" (401/500 —
//     which owes an honest error and a retry). Both arrived as `data: null`, so
//     failed reads rendered as not-found and as calm empty states.
//
// `ApiError` carries the status as data, which is what makes both decidable.
// SOT: packages/app/core/api-url.ts · packages/app/providers/query-provider.tsx
// SOT-KEYWORDS: api fetch getJson http error status retry transient 404 not found client read

import { API_URL } from './api-url.ts';

/** A non-2xx response, with the status kept as data rather than baked into a message. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`HTTP ${String(status)}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** True only for a response the server refused to find — the silent-drop wall. */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * The session ended, told apart from every other failed read.
 *
 * Worth its own predicate because it is the one failure whose honest sentence
 * is NOT "try again": retrying a 401 fails identically forever, so a screen that
 * only offers a retry sends the reader round a loop it cannot leave. Signing in
 * is the way out, and only this status knows that. 403 is deliberately not here
 * — that is "signed in, not yours", where signing in again changes nothing.
 */
export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * Retry only what a retry can fix. A 4xx is a settled answer — the credentials,
 * the scope, or the row is wrong, and asking again changes none of them, so the
 * screen gets its error branch on the first response instead of after backoff.
 * 408 and 429 are the two 4xx that DO come good on a retry.
 *
 * An error with no status is a transport failure (DNS, offline, aborted socket)
 * and stays retryable — that is the case retries exist for, and it keeps every
 * hook not yet moved onto `getJson` behaving exactly as it does today.
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  if (error.status === 408 || error.status === 429) return true;
  return error.status < 400 || error.status >= 500;
}

export async function getJson<T>(path: string, signal: AbortSignal | undefined): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', signal });
  if (!res.ok) throw new ApiError(res.status);
  return (await res.json()) as T;
}
