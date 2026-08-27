// @acme/payload — THE ONLY client-side access to Payload content (§3).
// The CMS itself mounts inside apps/web ((payload) route group) once the
// database exists; generated types replace these when `payload generate:types` runs.
// Only repositories import this module (doc 11 §3); features never do.
// SOT: docs/pack/11-architectural-guardrails.md §3
// SOT-KEYWORDS: payload cms content collections repository backend

// Generated types are the source of truth for collection shapes (CLAUDE.md
// §Types). Re-exported so repositories can name them without a deep path.
export type { Organization, Lead, Media, User } from './src/payload-types';

// The Loop A row shapes, named so the repositories that decode them do not have
// to reach through a deep path into the generated file. `SessionTranscript` is
// the ROW; `@acme/student-model`'s type of the same name is the DOMAIN object
// distillation works on. They are deliberately different — the row carries a
// numeric Payload id and a JSON `turns` column — so a consumer importing both
// must alias one of them rather than assume they interchange.
export type { SessionTranscript, StudentModelFact } from './src/payload-types';

/*
  The safety store's ROW, and the same collision as `SessionTranscript` above:
  `@acme/safety` exports a `SafetyEvent` too, and that one is the DOMAIN object
  the plane produces. The row carries a numeric Payload id, a `learnerAuthId`
  rather than a `learnerId`, and a `trace` that is a JSON column rather than a
  `PlaneLog[]`. A consumer importing both aliases one — `safety-event.repository.ts`
  does exactly that.
*/
export type { SafetyEvent } from './src/payload-types';

export interface PayloadClientConfig {
  /** Payload REST base, e.g. https://example.com/payload-api */
  baseUrl: string;
}

export interface PayloadListResponse<T> {
  docs: T[];
  totalDocs: number;
  page: number;
  totalPages: number;
}

/** Typed REST reader for published content (anon-readable collections only). */
export function createPayloadClient(config: PayloadClientConfig) {
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${config.baseUrl}${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Payload request failed: ${res.status} ${path}`);
    return (await res.json()) as T;
  };

  return {
    find: <T>(collection: string, query = '') =>
      get<PayloadListResponse<T>>(`/${collection}${query ? `?${query}` : ''}`),
    findGlobal: <T>(slug: string) => get<T>(`/globals/${slug}`),
  };
}
