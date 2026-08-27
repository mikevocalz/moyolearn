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

function databaseUrl() {
  for (const f of ['.env.local', '.env']) {
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

    await c.query(readFileSync('packages/payload/src/retention/sweep.sql', 'utf8'));

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
    const shadow = await c.query(
      'select count(*)::int n from payload._tutor_sessions_v where version_session_id = $1',
      [sessionId],
    );
    assert.equal(shadow.rows[0].n, 0, 'version rows survived the sweep — the erasure guarantee is false');
  } finally {
    await c.query('delete from payload._tutor_sessions_v where version_session_id = $1', [sessionId]);
    await c.query('delete from payload.tutor_sessions where session_id=$1', [sessionId]);
    await c.end();
  }
});
