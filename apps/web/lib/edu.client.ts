// The educational store's connection, and the only module that holds one.
//
// Doc 12 §4 puts the EDUCATIONAL store in its own `edu` schema, and doc 12 §11.3
// splits how it is reached: DDL through the Supabase MCP `apply_migration`, reads
// and writes through the `pg` driver. Payload owns the `payload` schema and has
// no model of these tables, so `getPayload().find` is not an option here — this
// file is what the `pg` half of that split looks like.
//
// It deliberately does NOT open a second pool. The pool comes from
// `payload.db.pool`, exactly as `retention.repository.ts:sweepVersionShadows`
// takes it, because doc 12 §8's first trade-off is one Postgres — a second pool
// would mean a second connection budget and a second set of credentials for the
// same database, and Supabase's connection ceiling is the resource that runs out
// first at the §7 load.
//
// The narrow `EduClient` surface is the point of the file. Callers get `query`
// and nothing else: no `connect`, no transaction control, no pool. A repository
// cannot leak a checked-out connection it was never handed, and nothing outside
// this module can obtain one — which is the half of doc 12 §3's three-store
// separation that `tooling/check-store-separation.mjs` then enforces textually.
// SOT: docs/pack/12-systems-design-prompt.md §3 §4 · packages/payload/migrations/edu_schema.sql · apps/web/lib/retention.repository.ts
// SOT-KEYWORDS: edu client educational store pg driver pool separation repository only server-only
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { QueryResult, QueryResultRow } from 'pg';

/**
 * What a parameter to an edu query may be.
 *
 * Enumerated rather than left as `unknown[]`, which CLAUDE.md §Types bans and
 * which would also be a lie: `pg` serialises exactly these. `readonly string[]`
 * is here for `derived_from`, the provenance array the erasure cascade walks.
 */
export type EduParam = string | number | boolean | Date | null | readonly string[];

/** The whole surface a repository gets. See the file header for why it is this small. */
export interface EduClient {
  query<Row extends QueryResultRow>(
    text: string,
    params?: readonly EduParam[],
  ): Promise<QueryResult<Row>>;
}

/**
 * Runs `fn` against the educational store on one checked-out connection.
 *
 * The connection is released in a `finally` rather than after `fn` returns: a
 * repository that throws mid-sweep must not also leak a connection, or the
 * second failure is a pool exhaustion that looks nothing like the first.
 */
export async function withEdu<T>(fn: (client: EduClient) => Promise<T>): Promise<T> {
  const payload = await getPayload({ config });
  const connection = await payload.db.pool.connect();
  const client: EduClient = {
    query: <Row extends QueryResultRow>(text: string, params?: readonly EduParam[]) =>
      connection.query<Row>(text, params === undefined ? undefined : [...params]),
  };
  try {
    return await fn(client);
  } finally {
    connection.release();
  }
}
