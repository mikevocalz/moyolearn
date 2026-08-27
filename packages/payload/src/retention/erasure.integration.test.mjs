// The erasure cascade, proved rather than asserted.
//
// Doc 12 §11.1 item 4: create a session, append N messages, run the erasure job,
// then assert zero rows in the main table AND in every `_v` table. Without this
// there is intent and no evidence — and the evidence is what a district's
// counsel is actually asking for.
//
// This talks to a real database on purpose. The bug it exists to catch was
// invisible to every unit test in the repo: the code was correct, the config
// default was not, and only the rows showed it.
// SOT: docs/pack/12-systems-design.md §11.1
// SOT-KEYWORDS: erasure cascade integration test retention versions shadow learner proof
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
  Anchored to this file, not to `process.cwd()`. The paths were relative to the
  repo root, which meant the test only found the database and `sweep.sql` when it
  was invoked from there — run by a package script it silently skipped instead,
  reporting "no DATABASE_URL" while a database was sitting in `.env`. A test that
  reports itself skipped for the wrong reason is the same failure as a test that
  passes for the wrong reason.
*/
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const SWEEP_SQL = resolve(here, 'sweep.sql');

function databaseUrl() {
  for (const name of ['.env.local', '.env']) {
    const f = resolve(repoRoot, name);
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/postgres(?:ql)?:\/\/\S+/);
      if (m) return m[0].replace(/^["']|["']$/g, '');
    }
  }
  return undefined;
}

const url = databaseUrl();

/*
  `sweep.sql` applied the way the route applies it — statement by statement,
  inside one transaction, with a savepoint each.

  Sending the file as one string is what this test used to do, and it stopped
  working: every collection now pins `versions: false`, and a Payload schema push
  against that config DROPS the `_<table>_v` tables. Eight of the file's ten
  statements name a relation that no longer exists, and libpq's implicit
  transaction around a multi-statement string means one missing relation aborts
  the other two as well — so the expired parents were never deleted either.

  `42P01` alone is skipped, because it means the shadow table this statement
  exists to empty is already gone, which is the state the file is trying to
  reach. This mirrors `apps/web/lib/retention.repository.ts:sweepVersionShadows`
  exactly; if that tolerance changes, this must change with it.
*/
async function applySweepSql(client) {
  const statements = readFileSync(SWEEP_SQL, 'utf8')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  await client.query('BEGIN');
  for (const statement of statements) {
    await client.query('SAVEPOINT sweep_statement');
    try {
      await client.query(statement);
      await client.query('RELEASE SAVEPOINT sweep_statement');
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT sweep_statement');
      if (error.code !== '42P01') {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  }
  await client.query('COMMIT');
}

/**
 * Rows left in a version shadow table, or 0 when the table itself is gone.
 *
 * An absent `_v` table satisfies the guarantee more completely than an empty
 * one, so it is not a skip. Asked through `to_regclass` rather than a try/catch
 * so a table that exists and errors for any other reason still fails the test.
 */
async function shadowRows(client, table, column, value) {
  const { rows } = await client.query('select to_regclass($1) is not null as present', [
    `payload.${table}`,
  ]);
  if (!rows[0].present) return 0;
  const counted = await client.query(
    `select count(*)::int n from payload.${table} where ${column} = $1`,
    [value],
  );
  return counted.rows[0].n;
}

/*
  Skipped rather than failed when there is no database. A test that goes red on
  a laptop without credentials is a test people learn to ignore, and an ignored
  erasure test is worse than none — it reads as proof while proving nothing.
*/
test('erasure cascade leaves nothing behind, including version tables', { skip: url ? false : 'no DATABASE_URL' }, async () => {
  const { default: pg } = await import('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const sessionId = `erasure-test-${randomUUID()}`;
  try {
    await c.query(
      `insert into payload.tutor_sessions (session_id, learner_auth_id, problem, messages, expires_at)
       values ($1, 'erasure-test-learner', 'test', '[]'::jsonb, now() - interval '1 day')`,
      [sessionId],
    );
    const { rows: [{ id }] } = await c.query('select id from payload.tutor_sessions where session_id=$1', [sessionId]);

    // N turns. Each is a read-modify-write of the whole document — the shape
    // that produced the version churn in the first place.
    for (let i = 0; i < 5; i += 1) {
      await c.query(
        `update payload.tutor_sessions
         set messages = messages || jsonb_build_array(jsonb_build_object('id', $2::text, 'role','learner','text','turn','attachments','[]'::jsonb))
         where id = $1`,
        [id, `m${i}`],
      );
    }

    await applySweepSql(c);

    const live = await c.query('select count(*)::int n from payload.tutor_sessions where session_id=$1', [sessionId]);
    assert.equal(live.rows[0].n, 0, 'expired session survived the sweep');

    /*
      QUERIED BY CONTENT, NOT BY `parent_id`. This is the whole test.

      Payload's version FK is `ON DELETE SET NULL`, not CASCADE. Deleting the
      parent does not delete the version — it NULLS the pointer and leaves the
      child's transcript sitting in `_tutor_sessions_v` with its text intact.

      My first version of this test counted `where parent_id = $1` and passed. It
      passed because after SET NULL the row no longer matches that predicate — it
      had not gone anywhere. A test that goes green by asking a question the data
      has stopped answering is worse than no test: it is evidence pointing the
      wrong way, on exactly the guarantee that most needs evidence.
    */
    assert.equal(
      await shadowRows(c, '_tutor_sessions_v', 'version_session_id', sessionId),
      0,
      'version rows survived the sweep — the erasure guarantee is false',
    );
  } finally {
    await c.query('delete from payload.tutor_sessions where session_id=$1', [sessionId]);
    await c.end();
  }
});

/*
  The TRANSCRIPT half of the same guarantee.

  `SessionTranscripts.ts` says in its own header that the sweep acting on
  `expiresAt` "deletes the row AND every derived fact the row is the sole source
  of". That sentence had no runtime until `apps/web/app/api/retention/sweep`
  existed, so the test below is what makes it evidence rather than a claim.

  WHAT IS UNDER TEST: the cascade CONTRACT — which rows must and must not survive
  a sweep. The decision itself is made by the real `expireTranscripts`, imported
  here rather than restated. The writes that apply its answer are performed by
  `apps/web/lib/retention.repository.ts` (`deleteFacts`, `updateFactProvenance`,
  `deleteTranscripts`, `sweepVersionShadows`); they are issued as SQL here
  because that repository begins with `import 'server-only'` and cannot be loaded
  outside a server bundle. So this proves the algebra against real rows and the
  end state the route must produce — not the route's own wiring.
*/
test(
  'transcript sweep erases expired transcripts and every fact they are the sole source of',
  { skip: url ? false : 'no DATABASE_URL' },
  async () => {
    const { default: pg } = await import('pg');
    const { expireTranscripts } = await import('../../../student-model/src/erasure.ts');

    const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();

    const stamp = `transcript-sweep-${randomUUID()}`;
    const learner = `${stamp}-learner`;
    const EXPIRED = `${stamp}-expired`;
    const LIVE = `${stamp}-live`;
    const SOLE = `${stamp}:sole`;
    const SHARED = `${stamp}:shared`;
    const UNRELATED = `${stamp}:unrelated`;

    // The sweep as the route runs it: one cutoff, read the expired set, hand it
    // to the real cascade, then apply the writes the route applies in its order.
    const runSweep = async () => {
      const cutoff = new Date();
      const { rows: transcriptRows } = await c.query(
        `select session_id, learner_auth_id, captured_at, expires_at
           from payload.session_transcripts
          where learner_auth_id = $1 and expires_at <= $2`,
        [learner, cutoff.toISOString()],
      );
      const transcripts = transcriptRows.map((r) => ({
        // `session_id`, not the numeric row id: that is what distillation writes
        // into a fact's provenance (tutor.service.ts), so it is the id the
        // cascade edge is expressed in.
        id: r.session_id,
        learnerId: r.learner_auth_id,
        capturedAt: r.captured_at.toISOString(),
        expiresAt: r.expires_at.toISOString(),
        turns: [],
      }));

      const { rows: factRows } = await c.query(
        `select f.fact_id,
                coalesce(array_agg(t.text order by t."order") filter (where t.text is not null), '{}') as derived_from
           from payload.student_model_facts f
           left join payload.student_model_facts_texts t
             on t.parent_id = f.id and t.path = 'derivedFrom'
          where f.learner_auth_id = $1
          group by f.fact_id`,
        [learner],
      );
      const facts = factRows.map((r) => ({ id: r.fact_id, derivedFrom: r.derived_from }));

      const cascade = expireTranscripts(transcripts, facts, cutoff);

      if (cascade.erasedFactIds.length > 0) {
        await c.query('delete from payload.student_model_facts where fact_id = any($1)', [
          cascade.erasedFactIds,
        ]);
      }
      const before = new Map(facts.map((f) => [f.id, f.derivedFrom.length]));
      for (const fact of cascade.facts) {
        if (before.get(fact.id) === fact.derivedFrom.length) continue;
        const { rows } = await c.query(
          'select id from payload.student_model_facts where fact_id = $1',
          [fact.id],
        );
        await c.query(
          `delete from payload.student_model_facts_texts where parent_id = $1 and path = 'derivedFrom'`,
          [rows[0].id],
        );
        for (const [order, text] of fact.derivedFrom.entries()) {
          await c.query(
            `insert into payload.student_model_facts_texts (parent_id, "order", path, text)
             values ($1, $2, 'derivedFrom', $3)`,
            [rows[0].id, order, text],
          );
        }
      }
      // Exactly the ids the cascade ran on, not `expires_at < now()` again: the
      // route deletes the set it cascaded so a transcript cannot cross its
      // expiry mid-sweep and lose its facts permanently.
      if (transcripts.length > 0) {
        await c.query('delete from payload.session_transcripts where session_id = any($1)', [
          transcripts.map((transcript) => transcript.id),
        ]);
      }
      await applySweepSql(c);
      return cascade;
    };

    const provenanceOf = async (factId) => {
      const { rows } = await c.query(
        `select coalesce(array_agg(t.text order by t."order") filter (where t.text is not null), '{}') as p
           from payload.student_model_facts f
           left join payload.student_model_facts_texts t
             on t.parent_id = f.id and t.path = 'derivedFrom'
          where f.fact_id = $1
          group by f.id`,
        [factId],
      );
      return rows[0]?.p ?? null;
    };

    try {
      await c.query(
        `insert into payload.session_transcripts
           (session_id, learner_auth_id, turns, captured_at, expires_at)
         values ($1, $3, '[]'::jsonb, now() - interval '31 days', now() - interval '1 day'),
                ($2, $3, '[]'::jsonb, now(),                     now() + interval '29 days')`,
        [EXPIRED, LIVE, learner],
      );

      for (const [factId, provenance] of [
        [SOLE, [EXPIRED]],
        [SHARED, [EXPIRED, LIVE]],
        [UNRELATED, [LIVE]],
      ]) {
        const { rows } = await c.query(
          `insert into payload.student_model_facts
             (fact_id, learner_auth_id, kind, sentence, detail, observed_at, expires_at)
           values ($1, $2, 'mastery', 'seeded', '{}'::jsonb, now(), now() + interval '400 days')
           returning id`,
          [factId, learner],
        );
        for (const [order, text] of provenance.entries()) {
          await c.query(
            `insert into payload.student_model_facts_texts (parent_id, "order", path, text)
             values ($1, $2, 'derivedFrom', $3)`,
            [rows[0].id, order, text],
          );
        }
      }

      const first = await runSweep();
      assert.deepEqual(first.erasedFactIds, [SOLE], 'the sole-source fact was not identified');

      const gone = await c.query(
        'select count(*)::int n from payload.session_transcripts where session_id = $1',
        [EXPIRED],
      );
      assert.equal(gone.rows[0].n, 0, 'the expired transcript survived the sweep');

      const kept = await c.query(
        'select count(*)::int n from payload.session_transcripts where session_id = $1',
        [LIVE],
      );
      assert.equal(kept.rows[0].n, 1, 'a transcript inside its window was deleted');

      assert.equal(
        await provenanceOf(SOLE),
        null,
        'a fact whose only source expired survived — the tutor can still state a deleted belief',
      );

      /*
        The half a row-count check cannot see. A fact sourced from two transcripts
        must LOSE ONE and stay, and it must stop pointing at the deleted one: a
        surviving fact whose provenance names a transcript that no longer exists
        can never be swept again, because the edge the cascade walks is broken.
      */
      assert.deepEqual(await provenanceOf(SHARED), [LIVE], 'shared provenance was not trimmed');
      assert.deepEqual(await provenanceOf(UNRELATED), [LIVE], 'an untouched fact was rewritten');

      assert.equal(
        await shadowRows(c, '_session_transcripts_v', 'version_session_id', EXPIRED),
        0,
        'version rows survived — the erasure guarantee is false',
      );

      // Idempotent: the scheduler will retry, and a second pass must be a no-op
      // rather than trimming a shared fact's provenance a second time.
      const second = await runSweep();
      assert.deepEqual(second.erasedFactIds, [], 'a second sweep erased facts the first already had');
      assert.deepEqual(await provenanceOf(SHARED), [LIVE], 'a retry rewrote a settled fact');
      assert.deepEqual(await provenanceOf(UNRELATED), [LIVE], 'a retry rewrote an untouched fact');
    } finally {
      await c.query('delete from payload.student_model_facts where learner_auth_id = $1', [learner]);
      await c.query('delete from payload.session_transcripts where learner_auth_id = $1', [learner]);
      await c.end();
    }
  },
);
