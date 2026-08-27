// Retention repository — the reads and writes the transcript TTL sweep needs.
//
// Separate from `student-model.repository.ts` because the tutor's repository is
// learner-scoped (every query is built from `ctx.learnerId`) and this one is
// deliberately not: a retention sweep runs for every learner at once, from a
// scheduler with no session. Mixing the two would put an unscoped query next to
// scoped ones in the same file, which is how an unscoped one eventually gets
// copied onto a request path.
//
// The row decoder is NOT duplicated — `factFromDoc` is imported, so both
// repositories agree on what a stored fact is.
// SOT: docs/design/seq-erasure-cascade.md · packages/student-model/src/erasure.ts
// SOT-KEYWORDS: retention repository sweep transcript expiry erasure cascade derived fact provenance version shadow payload
import 'server-only';
import { readFileSync } from 'node:fs';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { QueryResult, QueryResultRow } from 'pg';
import type { DerivedFact, SessionTranscript } from '@acme/student-model';
import { factFromDoc } from './student-model.repository';

/** Payload's `find` caps a page; the sweep pages rather than raising the cap. */
const PAGE_SIZE = 200;

/**
 * `where … in` is built as one clause per id against the `_texts` side table, so
 * an unbounded id list becomes an unbounded query. Chunked at a size that keeps
 * a single sweep to a handful of round trips at the §7 load.
 */
const ID_CHUNK = 100;

async function withPayload<T>(
  fn: (payload: Awaited<ReturnType<typeof getPayload>>) => Promise<T>,
): Promise<T> {
  const payload = await getPayload({ config });
  return fn(payload);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Every transcript whose window has closed by `horizon`.
 *
 * Returned as the DOMAIN `SessionTranscript` so `expireTranscripts` can consume
 * it directly, with `id` carrying the row's `sessionId` rather than its numeric
 * primary key: `sessionId` is what `evaluateTutorTurn` writes into a fact's
 * `derivedFrom` (`packages/app/features/tutor/tutor.service.ts`), so it is the
 * id the provenance edge is actually expressed in. Keying the cascade on the
 * Payload row id would match nothing and delete nothing, silently.
 *
 * `turns` comes back EMPTY on purpose. The cascade is defined on provenance, not
 * on content — `expireTranscripts` never reads a turn — and decoding the JSON
 * column into `SessionTurn[]` here would be an unchecked assertion about a shape
 * this file has no reason to inspect.
 */
export async function loadExpiredTranscripts(horizon: Date): Promise<SessionTranscript[]> {
  return withPayload(async (payload) => {
    const expired: SessionTranscript[] = [];
    for (let page = 1; ; page += 1) {
      const result = await payload.find({
        collection: 'sessionTranscripts',
        where: { expiresAt: { less_than_equal: horizon.toISOString() } },
        limit: PAGE_SIZE,
        page,
        sort: 'id',
        depth: 0,
      });
      for (const doc of result.docs) {
        expired.push({
          id: doc.sessionId,
          learnerId: doc.learnerAuthId,
          capturedAt: doc.capturedAt,
          expiresAt: doc.expiresAt,
          turns: [],
        });
      }
      if (!result.hasNextPage) return expired;
    }
  });
}

/**
 * Facts with at least one of these transcripts in their provenance.
 *
 * Scoped rather than loading the whole fact table: `eraseTranscript` only ever
 * rewrites a fact whose `derivedFrom` contains the erased id, so a fact outside
 * this set is returned unchanged by the cascade and reading it would be work
 * that cannot change the outcome.
 */
export async function loadFactsDerivedFrom(
  transcriptIds: readonly string[],
): Promise<DerivedFact[]> {
  if (transcriptIds.length === 0) return [];
  return withPayload(async (payload) => {
    const byFactId = new Map<string, DerivedFact>();
    for (const ids of chunk(transcriptIds, ID_CHUNK)) {
      for (let page = 1; ; page += 1) {
        const result = await payload.find({
          collection: 'studentModelFacts',
          where: { derivedFrom: { in: ids } },
          limit: PAGE_SIZE,
          page,
          sort: 'id',
          depth: 0,
        });
        for (const doc of result.docs) {
          const fact = factFromDoc(doc);
          // De-duplicated across chunks: a fact distilled from two expired
          // transcripts matches twice, and running the cascade over the same
          // fact object twice would trim its provenance from a stale copy.
          if (fact) byFactId.set(fact.id, fact);
        }
        if (!result.hasNextPage) break;
      }
    }
    return [...byFactId.values()];
  });
}

/**
 * The transcript rows themselves, by `sessionId`.
 *
 * Deleted from here rather than left to `sweep.sql`'s own
 * `DELETE … WHERE expires_at < now()`, even though that statement exists: the
 * SQL re-evaluates `now()` after this route has already chosen which facts to
 * cascade, so it would delete a superset. A transcript deleted in that gap
 * leaves its facts behind, and on the next run the transcript is gone — nothing
 * can ever find those facts again. Deleting exactly the ids the cascade ran on
 * closes that window instead of estimating around it.
 *
 * Related rows (the `_texts` side table behind `derivedFrom`, and the same for
 * transcripts) go through Payload rather than raw SQL so the child tables are
 * handled by the layer that created them.
 */
export async function deleteTranscripts(sessionIds: readonly string[]): Promise<number> {
  if (sessionIds.length === 0) return 0;
  return withPayload(async (payload) => {
    let deleted = 0;
    for (const ids of chunk(sessionIds, ID_CHUNK)) {
      const result = await payload.delete({
        collection: 'sessionTranscripts',
        where: { sessionId: { in: ids } },
        depth: 0,
      });
      deleted += result.docs.length;
      if (result.errors.length > 0) {
        throw new Error(
          `sessionTranscripts delete failed for ${result.errors.length} row(s): ${result.errors
            .map((error) => error.message)
            .join('; ')}`,
        );
      }
    }
    return deleted;
  });
}

/** Facts the cascade found no surviving provenance for. Returns rows removed. */
export async function deleteFacts(factIds: readonly string[]): Promise<number> {
  if (factIds.length === 0) return 0;
  return withPayload(async (payload) => {
    let deleted = 0;
    for (const ids of chunk(factIds, ID_CHUNK)) {
      const result = await payload.delete({
        collection: 'studentModelFacts',
        where: { factId: { in: ids } },
        depth: 0,
      });
      deleted += result.docs.length;
      if (result.errors.length > 0) {
        // Named, not swallowed. A fact that fails to delete every night is a
        // belief the tutor keeps stating about a child after the transcript it
        // came from is gone — the exact failure the cascade exists to prevent.
        throw new Error(
          `studentModelFacts delete failed for ${result.errors.length} row(s): ${result.errors
            .map((error) => error.message)
            .join('; ')}`,
        );
      }
    }
    return deleted;
  });
}

/**
 * Rewrites `derivedFrom` for facts that lost SOME of their sources.
 *
 * Without this the fact survives pointing at a transcript that no longer exists,
 * and the next sweep cannot find it to finish the job — the provenance edge the
 * whole cascade walks would have gone stale in the one direction nothing checks.
 *
 * One update per fact: the new `derivedFrom` differs per row, so a bulk `where`
 * write cannot express it.
 */
export async function updateFactProvenance(facts: readonly DerivedFact[]): Promise<number> {
  if (facts.length === 0) return 0;
  return withPayload(async (payload) => {
    let updated = 0;
    for (const fact of facts) {
      const result = await payload.update({
        collection: 'studentModelFacts',
        where: { factId: { equals: fact.id } },
        data: { derivedFrom: [...fact.derivedFrom] },
        depth: 0,
      });
      if (result.errors.length > 0) {
        throw new Error(
          `studentModelFacts provenance update failed for ${fact.id}: ${result.errors
            .map((error) => error.message)
            .join('; ')}`,
        );
      }
      updated += result.docs.length;
    }
    return updated;
  });
}

/*
  Resolved at call time against a candidate list rather than bundled, because
  `sweep.sql` is the source of truth for the version-shadow half of the sweep and
  a copy inlined into this file would be a second one.

  The candidates cover the two layouts this runs under: `next dev`/`next start`
  with cwd at `apps/web` (the workspace link), and the Vercel build output, where
  `outputFileTracingIncludes` in `next.config.ts` copies the file preserving its
  path from the monorepo tracing root.
*/
const SWEEP_SQL_CANDIDATES = [
  'node_modules/@acme/payload/src/retention/sweep.sql',
  '../../packages/payload/src/retention/sweep.sql',
  'packages/payload/src/retention/sweep.sql',
];

function readSweepSql(): string {
  for (const candidate of SWEEP_SQL_CANDIDATES) {
    try {
      return readFileSync(candidate, 'utf8');
    } catch {
      continue;
    }
  }
  // Fail the sweep rather than skip this half of it. A run that returns 200
  // having cleared transcripts but not their version shadows reports a kept
  // promise while the child's turns are still readable in `_v`.
  throw new Error(
    `sweep.sql not found (cwd ${process.cwd()}); tried ${SWEEP_SQL_CANDIDATES.join(', ')}`,
  );
}

/** Postgres `undefined_table`. */
const UNDEFINED_TABLE = '42P01';

/*
  Split into statements rather than sent as one string.

  Sending the file whole is what you would do first: libpq's simple query
  protocol wraps a multi-statement string in an implicit transaction, which is
  exactly the atomicity `sweep.sql`'s children-before-parents ordering wants. It
  is also why the file cannot be sent that way any more — one missing relation
  aborts every statement in it, including the ones that would have worked.

  That is not hypothetical. Every collection now pins `versions: false`, and a
  Payload schema push against that config DROPS the `_<table>_v` tables. Eight of
  the file's ten statements currently name a relation that no longer exists, so
  sent whole it does nothing at all while returning no error a caller can see.

  The split is safe for THIS file and is not a general SQL parser: `sweep.sql`
  contains no string literals, no dollar-quoted bodies, and no semicolons inside
  its comments. A future statement with any of those needs this revisited.
*/
function sweepStatements(sql: string): string[] {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

/**
 * Runs `packages/payload/src/retention/sweep.sql` — the Payload version shadow
 * tables, which hold a full copy of every learner row the main sweep deletes.
 *
 * Atomic via one explicit transaction, with a savepoint per statement so a
 * shadow table that has already been dropped is skipped instead of taking the
 * rest of the sweep with it. `42P01` alone is tolerated, and only because it
 * means the table this statement exists to empty is already gone — which is the
 * state the file is trying to reach. Every other error fails the sweep.
 */
export async function sweepVersionShadows(): Promise<number> {
  return withPayload(async (payload) => {
    const statements = sweepStatements(readSweepSql());
    const client = await payload.db.pool.connect();
    let affected = 0;
    try {
      await client.query('BEGIN');
      for (const statement of statements) {
        await client.query('SAVEPOINT retention_sweep');
        try {
          const result: QueryResult<QueryResultRow> = await client.query(statement);
          affected += result.rowCount ?? 0;
          await client.query('RELEASE SAVEPOINT retention_sweep');
        } catch (error) {
          await client.query('ROLLBACK TO SAVEPOINT retention_sweep');
          const code = error instanceof Error && 'code' in error ? String(error.code) : '';
          if (code === UNDEFINED_TABLE) continue;
          throw error;
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return affected;
  });
}
