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
  Sent WHOLE, exactly as `apps/web/lib/retention.repository.ts:sweepVersionShadows`
  sends it. If the two ever disagree about how the file is executed, this test
  stops testing the thing that runs in production.

  It used to split on `;` and tolerate `42P01`, to survive the file naming
  shadow tables that had been dropped. The guard belongs in the SQL and is there
  now — `sweep.sql` resolves each table with `to_regclass` — and the splitter
  could not survive it: the guard is written as a dollar-quoted PL/pgSQL block,
  which is precisely what the splitter's own comment warned would break it.
*/
async function applySweepSql(client) {
  await client.query(readFileSync(SWEEP_SQL, 'utf8'));
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

/*
  The EDUCATIONAL store's half of the same guarantee.

  Doc 12 §4: "Erasure cascades span all three (tested)." Until now the tested
  part meant the `payload` schema only, which was the whole cascade while the
  educational store was a paragraph in a spec. `edu` exists now
  (`packages/payload/migrations/edu_schema.sql`), so a sweep that leaves it alone
  is a sweep that deletes a child's transcript from one schema and leaves the
  same child's transcript in another.

  Same shape as the transcript test above and for the same reasons: the DECISION
  comes from the real `expireTranscripts`, imported rather than restated, and the
  writes are issued as SQL here because `apps/web/lib/edu.repository.ts` begins
  with `import 'server-only'` and will not load outside a server bundle. This is
  the file `tooling/check-store-separation.mjs` allowlists to write `edu` SQL.

  `edu.embeddings` is asserted but never deleted by anything below. That is the
  point of the assertion: the vectors are removed by the foreign key declared
  ON DELETE CASCADE, so this test fails if someone ever "optimises" that
  constraint away, and no sweep has to remember doc 19 §5.5's rule that an
  embedding of learner content IS learner content.
*/
test(
  'the sweep spans the edu schema — transcripts, derived facts and their vectors',
  { skip: url ? false : 'no DATABASE_URL' },
  async () => {
    const { default: pg } = await import('pg');
    const { expireTranscripts } = await import('../../../student-model/src/erasure.ts');

    const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();

    const stamp = `edu-sweep-${randomUUID()}`;
    const learner = `${stamp}-learner`;
    const EXPIRED = randomUUID();
    const LIVE = randomUUID();
    const SOLE = `${stamp}:mastery:sole`;
    const SHARED = `${stamp}:mastery:shared`;
    const UNRELATED = `${stamp}:mastery:unrelated`;

    // The edu leg of `apps/web/app/api/retention/sweep`, statement for statement:
    // load expired, load every fact naming one of them through the GIN-indexed
    // `derived_from &&`, hand both to the real cascade, then apply its answer in
    // the route's order — facts before transcripts.
    const runEduSweep = async () => {
      const cutoff = new Date();
      const { rows: transcriptRows } = await c.query(
        `select session_id, learner_id, captured_at, expires_at
           from edu.transcripts
          where learner_id = $1 and expires_at <= $2`,
        [learner, cutoff.toISOString()],
      );
      const transcripts = transcriptRows.map((r) => ({
        id: r.session_id,
        learnerId: r.learner_id,
        capturedAt: r.captured_at.toISOString(),
        expiresAt: r.expires_at.toISOString(),
        turns: [],
      }));
      const ids = transcripts.map((transcript) => transcript.id);

      const factRows =
        ids.length === 0
          ? []
          : (
              await c.query(
                // `::text[]` on both sides: `derived_from` is an array of the
                // `edu.opaque_id` DOMAIN, and `pg` has no parser for that OID — it
                // hands back the raw `{a,b}` literal as a string. The repository
                // carries the same cast for the same reason.
                'select fact_id, derived_from::text[] as derived_from from edu.knowledge_graph where derived_from && $1::edu.opaque_id[]',
                [ids],
              )
            ).rows;
      const facts = factRows.map((r) => ({ id: r.fact_id, derivedFrom: r.derived_from }));

      const cascade = expireTranscripts(transcripts, facts, cutoff);

      if (cascade.erasedFactIds.length > 0) {
        await c.query('delete from edu.knowledge_graph where fact_id = any($1)', [
          cascade.erasedFactIds,
        ]);
      }
      /*
        An UPDATE of the array, not a delete-then-insert. `edu.knowledge_graph`
        carries `knowledge_graph_has_provenance`, so the empty-array state a
        two-step rewrite passes through is not merely wrong, it is illegal —
        the constraint that encodes erasure.ts's "a fact left with no provenance
        is DELETED, never kept as an orphan" also refuses to hold one briefly.
      */
      const before = new Map(facts.map((f) => [f.id, f.derivedFrom.length]));
      for (const fact of cascade.facts) {
        if (before.get(fact.id) === fact.derivedFrom.length) continue;
        await c.query('update edu.knowledge_graph set derived_from = $2 where fact_id = $1', [
          fact.id,
          fact.derivedFrom,
        ]);
      }
      if (ids.length > 0) {
        await c.query('delete from edu.transcripts where session_id = any($1)', [ids]);
      }
      return cascade;
    };

    const provenanceOf = async (factId) => {
      const { rows } = await c.query(
        'select derived_from::text[] as derived_from from edu.knowledge_graph where fact_id = $1',
        [factId],
      );
      return rows[0]?.derived_from ?? null;
    };

    const countTranscript = async (sessionId) =>
      (
        await c.query('select count(*)::int n from edu.transcripts where session_id = $1', [
          sessionId,
        ])
      ).rows[0].n;

    const countVectors = async (sessionId) =>
      (
        await c.query('select count(*)::int n from edu.embeddings where transcript_id = $1', [
          sessionId,
        ])
      ).rows[0].n;

    try {
      await c.query(
        `insert into edu.transcripts (session_id, learner_id, captured_at, expires_at, turns)
         values ($1, $3, now() - interval '31 days', now() - interval '1 day', '[]'::jsonb),
                ($2, $3, now(),                      now() + interval '29 days', '[]'::jsonb)`,
        [EXPIRED, LIVE, learner],
      );

      for (const [factId, provenance] of [
        [SOLE, [EXPIRED]],
        [SHARED, [EXPIRED, LIVE]],
        [UNRELATED, [LIVE]],
      ]) {
        await c.query(
          `insert into edu.knowledge_graph
             (fact_id, learner_id, kind, skill_id, skill_title, p, attempts,
              derived_from, observed_at, expires_at)
           values ($1, $2, 'mastery', 'fraction-addition', 'Adding fractions', 0.5, 3,
                   $3, now(), now() + interval '400 days')`,
          [factId, learner, provenance],
        );
      }

      for (const sessionId of [EXPIRED, LIVE]) {
        await c.query(
          `insert into edu.embeddings (kind, transcript_id, learner_id, model, embedding)
           select 'transcript', $1, $2, 'pinned-1024',
                  ('[' || string_agg('0.01', ',') || ']')::extensions.vector(1024)
             from generate_series(1, 1024)`,
          [sessionId, learner],
        );
      }

      const first = await runEduSweep();
      assert.deepEqual(first.erasedFactIds, [SOLE], 'the sole-source edu fact was not identified');

      assert.equal(await countTranscript(EXPIRED), 0, 'the expired edu transcript survived');
      assert.equal(await countTranscript(LIVE), 1, 'an edu transcript inside its window was deleted');

      assert.equal(
        await provenanceOf(SOLE),
        null,
        'an edu fact whose only source expired survived — the tutor can still state a deleted belief',
      );
      assert.deepEqual(await provenanceOf(SHARED), [LIVE], 'shared edu provenance was not trimmed');
      assert.deepEqual(await provenanceOf(UNRELATED), [LIVE], 'an untouched edu fact was rewritten');

      assert.equal(
        await countVectors(EXPIRED),
        0,
        'the expired transcript is gone and its embedding is not — learner content survived its source',
      );
      assert.equal(
        await countVectors(LIVE),
        1,
        'a live transcript lost its embedding',
      );

      // The scheduler retries. A second pass must be a no-op rather than
      // trimming a shared fact's provenance twice.
      const second = await runEduSweep();
      assert.deepEqual(second.erasedFactIds, [], 'a second edu sweep erased facts the first already had');
      assert.deepEqual(await provenanceOf(SHARED), [LIVE], 'a retry rewrote a settled edu fact');
      assert.deepEqual(await provenanceOf(UNRELATED), [LIVE], 'a retry rewrote an untouched edu fact');
    } finally {
      await c.query('delete from edu.knowledge_graph where learner_id = $1', [learner]);
      await c.query('delete from edu.transcripts where learner_id = $1', [learner]);
      await c.end();
    }
  },
);

/*
  THE NEW WRITE PATH, swept end to end.

  The three tests above prove the cascade's ALGEBRA against rows somebody
  hand-wrote to suit it. That was the honest limit of them while the tutoring
  path still wrote `payload.session_transcripts` and `payload.student_model_facts`
  and `edu` held nothing: they proved a sweep would work on rows of a shape no
  production writer produced.

  It produces them now. `apps/web/lib/edu.repository.ts:saveEduTranscript` and
  `saveEduFacts` are what `POST /api/tutor/evaluate` calls, so this test seeds
  the store the way THEY do — a real `SessionTurn`, through the real `distill`,
  written with the same column mapping — and then sweeps it. What it is
  therefore able to catch, and the tests above are not, is a model the distiller
  can emit that the educational store refuses to hold, or holds in a shape the
  cascade cannot walk.

  It caught one immediately, which is the reason `eduFactColumns` below is not
  a spread of the fact: `distill` emits a scaffolding fact for every storable
  turn, `ScaffoldingFact` carries no `skillTitle` (`scaffoldingFact` spends it on
  the sentence and drops it), and `knowledge_graph_variant_shape` requires
  `skill_title` for a scaffolding row. Writing the fact's own fields produced

    new row for relation "knowledge_graph" violates check constraint
    "knowledge_graph_variant_shape"

  on the third fact of the first turn — i.e. every tutoring turn would have
  500'd. The title is recovered from the mastery or review fact for the same
  skill in the same batch, which `distill` always emits alongside it.

  The mapping is MIRRORED here rather than imported for the reason the two tests
  above give about themselves: `edu.repository.ts` begins with
  `import 'server-only'` and will not load outside a server bundle. This file is
  the one `tooling/check-store-separation.mjs` allowlists to write `edu` SQL.
*/

/** `skillId` → a title, from whichever fact in the batch has one. */
function skillTitleIndex(facts) {
  const titles = new Map();
  for (const fact of facts) {
    if (fact.kind === 'mastery' || fact.kind === 'review') titles.set(fact.skillId, fact.skillTitle);
  }
  return titles;
}

/** One `DerivedFact` as the sixteen values `edu.knowledge_graph` takes. */
function eduFactColumns(fact, titles) {
  const variant =
    fact.kind === 'mastery'
      ? [fact.skillId, fact.skillTitle, null, fact.p, fact.attempts, null, null, null, null, null]
      : fact.kind === 'review'
        ? [fact.skillId, fact.skillTitle, null, null, null, fact.dueAt, fact.intervalDays, null, null, null]
        : fact.kind === 'scaffolding'
          ? [fact.skillId, titles.get(fact.skillId) ?? fact.skillId, null, null, null, null, null, fact.hintDepth, null, null]
          : fact.kind === 'misconception'
            ? [fact.skillId, null, fact.tag, null, null, null, null, null, fact.active, null]
            : [null, null, fact.tag, null, null, null, null, null, null, fact.guardianApproved];
  return [
    fact.id,
    fact.learnerId,
    fact.kind,
    ...variant,
    fact.derivedFrom,
    fact.observedAt,
    fact.expiresAt,
  ];
}

test(
  'erasure spans the tutoring write path: a distilled model written to edu is swept whole',
  { skip: url ? false : 'no DATABASE_URL' },
  async () => {
    const { default: pg } = await import('pg');
    const { distill, transcriptExpiry } = await import('../../../student-model/src/distill.ts');
    const { expireTranscripts } = await import('../../../student-model/src/erasure.ts');

    const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();

    const stamp = `edu-writepath-${randomUUID()}`;
    const learner = `${stamp}-learner`;
    const sessionId = randomUUID();

    /*
      Captured 31 days ago so the REAL `transcriptExpiry` — the same function
      `tutor.service.ts` calls — puts the window one day in the past. The row is
      expired because the published 30-day window says so, not because the test
      wrote a date it liked.
    */
    const capturedAt = new Date(Date.now() - 31 * 86_400_000);
    const observedAt = new Date();

    // Exactly what `evaluateTutorTurn` builds for a storable turn.
    const turn = {
      skillId: 'Fractions',
      skillTitle: 'Fractions',
      correct: false,
      hintDepth: 2,
      storable: true,
    };
    const transcript = {
      id: sessionId,
      learnerId: learner,
      capturedAt: capturedAt.toISOString(),
      expiresAt: transcriptExpiry(capturedAt),
      turns: [turn],
    };
    const facts = distill(transcript, [], observedAt);

    // The distiller's contract, asserted before the store's: a storable turn
    // produces mastery, review and scaffolding. If this ever stops being true
    // the coverage below silently narrows.
    assert.deepEqual(
      [...facts.map((f) => f.kind)].sort(),
      ['mastery', 'review', 'scaffolding'],
      'distill no longer emits the three facts this test sweeps',
    );

    try {
      // `saveEduTranscript`, statement for statement.
      await c.query(
        `insert into edu.transcripts (session_id, learner_id, captured_at, expires_at, turns)
         values ($1, $2, $3, $4, $5::jsonb)
         on conflict (session_id) do nothing`,
        [
          transcript.id,
          transcript.learnerId,
          transcript.capturedAt,
          transcript.expiresAt,
          JSON.stringify(transcript.turns),
        ],
      );

      // `saveEduFacts`, statement for statement.
      const titles = skillTitleIndex(facts);
      for (const fact of facts) {
        await c.query(
          `insert into edu.knowledge_graph
             (fact_id, learner_id, kind,
              skill_id, skill_title, tag, p, attempts,
              due_at, interval_days, hint_depth, active, guardian_approved,
              derived_from, observed_at, expires_at)
           values ($1, $2, $3::edu.fact_kind,
                   $4, $5, $6, $7, $8,
                   $9, $10, $11, $12, $13,
                   $14::edu.opaque_id[], $15, $16)
           on conflict (fact_id) do update set
             kind = excluded.kind, skill_id = excluded.skill_id,
             skill_title = excluded.skill_title, tag = excluded.tag,
             p = excluded.p, attempts = excluded.attempts,
             due_at = excluded.due_at, interval_days = excluded.interval_days,
             hint_depth = excluded.hint_depth, active = excluded.active,
             guardian_approved = excluded.guardian_approved,
             derived_from = excluded.derived_from,
             observed_at = excluded.observed_at, expires_at = excluded.expires_at`,
          eduFactColumns(fact, titles),
        );
      }

      /*
        The write path landed, in the store doc 12 §4 names. Asserted rather than
        assumed: before the cutover this count was 0 for every learner in
        production, because the tutoring path wrote the other schema.
      */
      const landed = await c.query(
        'select count(*)::int n from edu.knowledge_graph where learner_id = $1',
        [learner],
      );
      assert.equal(landed.rows[0].n, 3, 'the distilled model did not reach the educational store');

      // A second write of the same turn is an UPSERT, not a duplicate: `distill`
      // keys facts deterministically and returns the whole model every time.
      for (const fact of facts) {
        await c.query(
          `insert into edu.knowledge_graph
             (fact_id, learner_id, kind, skill_id, skill_title, tag, p, attempts,
              due_at, interval_days, hint_depth, active, guardian_approved,
              derived_from, observed_at, expires_at)
           values ($1,$2,$3::edu.fact_kind,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
                   $14::edu.opaque_id[],$15,$16)
           on conflict (fact_id) do update set attempts = excluded.attempts`,
          eduFactColumns(fact, titles),
        );
      }
      const afterRewrite = await c.query(
        'select count(*)::int n from edu.knowledge_graph where learner_id = $1',
        [learner],
      );
      assert.equal(afterRewrite.rows[0].n, 3, 'the write path appends instead of upserting');

      // The sweep, as `app/api/retention/sweep` runs its edu leg.
      const cutoff = new Date();
      const { rows: transcriptRows } = await c.query(
        `select session_id, learner_id, captured_at, expires_at
           from edu.transcripts
          where learner_id = $1 and expires_at <= $2`,
        [learner, cutoff.toISOString()],
      );
      assert.equal(transcriptRows.length, 1, 'the 30-day window did not close on a 31-day-old capture');

      const expired = transcriptRows.map((r) => ({
        id: r.session_id,
        learnerId: r.learner_id,
        capturedAt: r.captured_at.toISOString(),
        expiresAt: r.expires_at.toISOString(),
        turns: [],
      }));
      const ids = expired.map((t) => t.id);
      const { rows: factRows } = await c.query(
        'select fact_id, derived_from::text[] as derived_from from edu.knowledge_graph where derived_from && $1::edu.opaque_id[]',
        [ids],
      );
      const cascade = expireTranscripts(
        expired,
        factRows.map((r) => ({ id: r.fact_id, derivedFrom: r.derived_from })),
        cutoff,
      );

      /*
        EVERY fact, not some. The turn had one source, so `distill` gave all
        three facts a single-element provenance and the cascade must take all
        three — a model whose only session is gone is a model with nothing left
        to say about the child.
      */
      assert.deepEqual(
        [...cascade.erasedFactIds].sort(),
        [...facts.map((f) => f.id)].sort(),
        'the cascade left part of a single-session model standing',
      );

      await c.query('delete from edu.knowledge_graph where fact_id = any($1)', [
        cascade.erasedFactIds,
      ]);
      await c.query('delete from edu.transcripts where session_id = any($1)', [ids]);

      const factsLeft = await c.query(
        'select count(*)::int n from edu.knowledge_graph where learner_id = $1',
        [learner],
      );
      assert.equal(factsLeft.rows[0].n, 0, 'derived facts survived the sweep of their only source');

      const transcriptsLeft = await c.query(
        'select count(*)::int n from edu.transcripts where learner_id = $1',
        [learner],
      );
      assert.equal(transcriptsLeft.rows[0].n, 0, 'the expired transcript survived');

      const vectorsLeft = await c.query(
        'select count(*)::int n from edu.embeddings where learner_id = $1',
        [learner],
      );
      assert.equal(vectorsLeft.rows[0].n, 0, 'an embedding of learner content outlived its transcript');
    } finally {
      await c.query('delete from edu.knowledge_graph where learner_id = $1', [learner]);
      await c.query('delete from edu.transcripts where learner_id = $1', [learner]);
      await c.end();
    }
  },
);

/*
  ERASURE THAT SURVIVES THE NEXT SESSION.

  Every test above proves that a deleted thing goes away. None of them proves it
  STAYS away, and that is the gap doc 07 §S27's "the eraser works" actually
  stands or falls on: a guardian erases "likes examples about basketball", the
  next distillation reads the same turns, and the same tag walks back into
  `edu.knowledge_graph` under the same deterministic `fact_id`. Nothing in the
  cascade is wrong when that happens. The cascade ran, the row went, and the loop
  around it put it back — which from the family's side is indistinguishable from
  the delete button not being wired up at all.

  `erasure.ts:withoutBlockedTags` is the guard, and it was exported, unit-tested
  and unreachable: there was no table to read a blocked tag from and no writer to
  put one there. So this test is deliberately end-to-end over the DURABLE record
  — `edu.blocked_tags` — rather than over the pure function, because the pure
  function was already green while the product was already broken.

  THE CONTROL ASSERTION IS THE POINT. Before filtering, the test proves the fact
  DOES come back; only then does it prove that filtering stops it. Without the
  control, a distiller that stopped deriving interests for any unrelated reason
  would turn this test green while erasure quietly went back to being theatre.

  Same allowlisted-SQL arrangement as the three tests above and for the same
  reason: `apps/web/lib/edu.repository.ts` begins with `import 'server-only'`.
  The statements below are `loadEduBlockedTags` and `eraseEduFactAndBlockTag`,
  statement for statement, transaction included.
*/
test(
  'an erased interest does not come back: distillation reads the blocked tag, not just the deleted row',
  { skip: url ? false : 'no DATABASE_URL' },
  async () => {
    const { default: pg } = await import('pg');
    const { distill, transcriptExpiry } = await import('../../../student-model/src/distill.ts');
    const { withoutBlockedTags } = await import('../../../student-model/src/erasure.ts');

    const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();

    const stamp = `blocked-tags-${randomUUID()}`;
    const learner = `${stamp}-learner`;
    const sessionId = randomUUID();
    const TAG = 'basketball';

    /*
      `guardianApprovedInterests` is passed because doc 07 §4 Loop A makes
      interests opt-in and `distill` derives none without it. A family that never
      consented has no interest fact to erase, so the scenario under test only
      exists for a family that did — and the erasure has to beat the consent,
      which is precisely the case that would otherwise re-derive forever.
    */
    const options = { guardianApprovedInterests: [TAG] };

    const capturedAt = new Date();
    const turn = {
      skillId: 'Fractions',
      skillTitle: 'Fractions',
      correct: true,
      hintDepth: 1,
      interestTags: [TAG],
      storable: true,
    };
    const transcript = {
      id: sessionId,
      learnerId: learner,
      capturedAt: capturedAt.toISOString(),
      expiresAt: transcriptExpiry(capturedAt),
      turns: [turn],
    };

    /** `saveEduFacts`, statement for statement. */
    const writeFacts = async (facts) => {
      const titles = skillTitleIndex(facts);
      for (const fact of facts) {
        await c.query(
          `insert into edu.knowledge_graph
             (fact_id, learner_id, kind,
              skill_id, skill_title, tag, p, attempts,
              due_at, interval_days, hint_depth, active, guardian_approved,
              derived_from, observed_at, expires_at)
           values ($1, $2, $3::edu.fact_kind,
                   $4, $5, $6, $7, $8,
                   $9, $10, $11, $12, $13,
                   $14::edu.opaque_id[], $15, $16)
           on conflict (fact_id) do update set
             kind = excluded.kind, skill_id = excluded.skill_id,
             skill_title = excluded.skill_title, tag = excluded.tag,
             p = excluded.p, attempts = excluded.attempts,
             due_at = excluded.due_at, interval_days = excluded.interval_days,
             hint_depth = excluded.hint_depth, active = excluded.active,
             guardian_approved = excluded.guardian_approved,
             derived_from = excluded.derived_from,
             observed_at = excluded.observed_at, expires_at = excluded.expires_at`,
          eduFactColumns(fact, titles),
        );
      }
    };

    const countFact = async (factId) =>
      (
        await c.query('select count(*)::int n from edu.knowledge_graph where fact_id = $1', [
          factId,
        ])
      ).rows[0].n;

    /** `loadEduBlockedTags`, statement for statement. */
    const loadBlockedTags = async () =>
      (
        await c.query('select tag from edu.blocked_tags where learner_id = $1', [learner])
      ).rows.map((row) => row.tag);

    try {
      await c.query(
        `insert into edu.transcripts (session_id, learner_id, captured_at, expires_at, turns)
         values ($1, $2, $3, $4, $5::jsonb)
         on conflict (session_id) do nothing`,
        [
          transcript.id,
          transcript.learnerId,
          transcript.capturedAt,
          transcript.expiresAt,
          JSON.stringify(transcript.turns),
        ],
      );

      // Session one, through the real distiller and the real column mapping.
      const first = distill(transcript, [], new Date(), options);
      const interest = first.find((fact) => fact.kind === 'interest');
      assert.ok(
        interest !== undefined,
        'distill derived no interest fact — this test can no longer see the thing it erases',
      );
      await writeFacts(first);
      assert.equal(await countFact(interest.id), 1, 'the interest fact did not reach the store');

      /*
        THE ERASURE, as `eraseEduFactAndBlockTag` performs it: one transaction,
        the delete scoped by `learner_id` as well as `fact_id` so the id a client
        supplies can only ever name a row the caller's own ctx owns, and the tag
        taken from the DELETED ROW's `returning` rather than from anything the
        client sent — a caller who could name the tag could block a tag it never
        had a fact for.
      */
      await c.query('begin');
      const { rows: deleted } = await c.query(
        `delete from edu.knowledge_graph
          where fact_id = $1 and learner_id = $2
          returning kind::text as kind, tag`,
        [interest.id, learner],
      );
      assert.equal(deleted.length, 1, 'the guardian erased a line and no row was deleted');
      await c.query(
        `insert into edu.blocked_tags (learner_id, tag, kind)
         values ($1, $2, $3::edu.fact_kind)
         on conflict (learner_id, tag) do nothing`,
        [learner, deleted[0].tag, deleted[0].kind],
      );
      await c.query('commit');

      assert.equal(await countFact(interest.id), 0, 'the erased fact survived its own deletion');

      /*
        The model as it stands after the erasure — which is what
        `loadEduPriorFacts` returns on the next turn. Taken from the batch rather
        than re-read and reconstructed, because the id set is what distillation
        keys on and reconstructing the rows here would be a fourth copy of
        `factFromRow` proving nothing this test is about.
      */
      const priorFacts = first.filter((fact) => fact.id !== interest.id);

      /*
        THE CONTROL. Unfiltered, over turns that still carry the tag — because
        the turns are a record of what happened and erasure does not rewrite
        them — the fact walks straight back under the same deterministic id.
        This assertion is the bug, held still.
      */
      const unfiltered = distill(transcript, priorFacts, new Date(), options);
      assert.ok(
        unfiltered.some((fact) => fact.id === interest.id),
        'control failed: the distiller no longer re-derives an erased interest on its own, ' +
          'so the assertion below proves nothing',
      );

      // The real path: the durable record, read back, through the real filter.
      assert.deepEqual(
        await loadBlockedTags(),
        [TAG],
        'the erasure recorded no blocked tag — the next session has nothing to filter on',
      );

      const blockedTags = await loadBlockedTags();
      const filtered = distill(
        { ...transcript, turns: withoutBlockedTags(transcript.turns, blockedTags) },
        priorFacts,
        new Date(),
        options,
      );
      assert.equal(
        filtered.some((fact) => fact.id === interest.id),
        false,
        'the erased interest was re-derived — erasure works once, on one device',
      );

      /*
        And written back, because a filter that holds in memory and a store that
        holds the row are two different claims. This is the one the guardian sees
        when S27 reloads.
      */
      await writeFacts(filtered);
      assert.equal(
        await countFact(interest.id),
        0,
        'the erased line came back into the educational store on the next session',
      );

      /*
        The work the child did is untouched. `erasure.ts` refuses to make mastery
        blockable on purpose, and a filter that quietly took the whole turn with
        the tag would be the easy wrong implementation of this feature.
      */
      assert.ok(
        filtered.some((fact) => fact.id === `${learner}:mastery:Fractions`),
        'blocking an interest tag also suppressed the mastery estimate for the same turn',
      );
    } finally {
      /*
        ROLLBACK FIRST, and `c.end()` in a nested finally.

        This is the only test here that opens an explicit transaction, and a
        failure inside one leaves the connection in an aborted block where every
        cleanup statement comes back `25P02: current transaction is aborted`. The
        first version of this teardown therefore reported the aborted-block error
        instead of the assertion that actually failed, and then never reached
        `c.end()` — so the runner hung on an open socket and the real message was
        lost twice over. A teardown that can hide the failure it is tidying up
        after is worse than no teardown.
      */
      try {
        await c.query('rollback');
        await c.query('delete from edu.blocked_tags where learner_id = $1', [learner]);
        await c.query('delete from edu.knowledge_graph where learner_id = $1', [learner]);
        await c.query('delete from edu.transcripts where learner_id = $1', [learner]);
      } finally {
        await c.end();
      }
    }
  },
);

/*
  S27's SECOND eraser: a guardian deleting one session.

  `memory.store.ts:confirmEraseTranscript` filtered a zustand array and stopped,
  exactly as `eraseLine` did before the commit above — the transcript vanished
  from the guardian's screen, the row and every belief derived from it stayed in
  `edu`, and a reload brought the lot back. The cascade this test drives is the
  REAL `eraseTranscript` from `@acme/student-model`, called on the rows the
  DATABASE holds, because the promise doc 07 §4 makes is about the store and not
  about a React tree.

  THE CONTROL COMES FIRST, and it is the naive implementation held still: a
  separate transcript is deleted with the one statement anybody would write, and
  the fact it was the sole source of is proved to SURVIVE that. Without it, a
  foreign key or a trigger somebody added later would make the assertions below
  pass while the cascade did nothing — the test would be green and the tutor
  would still be able to state a belief whose only source a parent deleted.

  Same allowlisted-SQL arrangement as every test above, for the same reason:
  `apps/web/lib/edu.repository.ts` begins with `import 'server-only'`. The
  statements in `runErase` are `eraseEduTranscriptCascade`, statement for
  statement, `for update` and transaction included.
*/
test(
  'erasing one session takes the beliefs it alone supports and its vectors, and trims the rest',
  { skip: url ? false : 'no DATABASE_URL' },
  async () => {
    const { default: pg } = await import('pg');
    const { eraseTranscript } = await import('../../../student-model/src/erasure.ts');

    const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();

    const stamp = `erase-transcript-${randomUUID()}`;
    const learner = `${stamp}-learner`;
    const TARGET = randomUUID();
    const OTHER = randomUUID();
    const CONTROL = randomUUID();
    const SOLE = `${stamp}:mastery:sole`;
    const SHARED = `${stamp}:mastery:shared`;
    const UNRELATED = `${stamp}:mastery:unrelated`;
    const CONTROL_FACT = `${stamp}:mastery:control`;

    const seedTranscript = async (sessionId) => {
      await c.query(
        `insert into edu.transcripts (session_id, learner_id, captured_at, expires_at, turns)
         values ($1, $2, now(), now() + interval '29 days', '[]'::jsonb)`,
        [sessionId, learner],
      );
      await c.query(
        `insert into edu.embeddings (kind, transcript_id, learner_id, model, embedding)
         select 'transcript', $1, $2, 'pinned-1024',
                ('[' || string_agg('0.01', ',') || ']')::extensions.vector(1024)
           from generate_series(1, 1024)`,
        [sessionId, learner],
      );
    };

    const seedFact = async (factId, provenance) =>
      c.query(
        `insert into edu.knowledge_graph
           (fact_id, learner_id, kind, skill_id, skill_title, p, attempts,
            derived_from, observed_at, expires_at)
         values ($1, $2, 'mastery', 'fraction-addition', 'Adding fractions', 0.5, 3,
                 $3, now(), now() + interval '400 days')`,
        [factId, learner, provenance],
      );

    const countFact = async (factId) =>
      (await c.query('select count(*)::int n from edu.knowledge_graph where fact_id = $1', [factId]))
        .rows[0].n;

    const provenanceOf = async (factId) =>
      (
        await c.query(
          'select derived_from::text[] as derived_from from edu.knowledge_graph where fact_id = $1',
          [factId],
        )
      ).rows[0]?.derived_from ?? null;

    const countTranscript = async (sessionId) =>
      (await c.query('select count(*)::int n from edu.transcripts where session_id = $1', [sessionId]))
        .rows[0].n;

    const countVectors = async (sessionId) =>
      (await c.query('select count(*)::int n from edu.embeddings where transcript_id = $1', [sessionId]))
        .rows[0].n;

    /** `eraseEduTranscriptCascade`, statement for statement. */
    const runErase = async (transcriptId) => {
      await c.query('begin');
      try {
        /*
          `for update`, and the cascade computed from what this SELECT returned.
          A distillation landing between the read and the write would otherwise
          rewrite `derived_from` under the erasure and re-provenance a fact back
          onto a transcript this transaction is about to delete.
        */
        const { rows } = await c.query(
          `select fact_id, derived_from::text[] as derived_from
             from edu.knowledge_graph
            where learner_id = $1 and derived_from && $2::edu.opaque_id[]
            for update`,
          [learner, [transcriptId]],
        );
        const facts = rows.map((row) => ({ id: row.fact_id, derivedFrom: row.derived_from }));
        const cascade = eraseTranscript(facts, transcriptId);

        if (cascade.erasedFactIds.length > 0) {
          await c.query(
            'delete from edu.knowledge_graph where fact_id = any($1) and learner_id = $2',
            [cascade.erasedFactIds, learner],
          );
        }

        const before = new Map(facts.map((fact) => [fact.id, fact.derivedFrom.length]));
        const trimmed = cascade.facts.filter(
          (fact) => before.get(fact.id) !== fact.derivedFrom.length,
        );
        for (const fact of trimmed) {
          await c.query(
            'update edu.knowledge_graph set derived_from = $2 where fact_id = $1 and learner_id = $3',
            [fact.id, fact.derivedFrom, learner],
          );
        }

        const { rowCount } = await c.query(
          'delete from edu.transcripts where session_id = $1 and learner_id = $2',
          [transcriptId, learner],
        );
        await c.query('commit');
        return {
          erased: (rowCount ?? 0) > 0,
          erasedFactIds: cascade.erasedFactIds,
          trimmedFactIds: trimmed.map((fact) => fact.id),
        };
      } catch (error) {
        await c.query('rollback');
        throw error;
      }
    };

    try {
      await seedTranscript(TARGET);
      await seedTranscript(OTHER);
      await seedTranscript(CONTROL);
      await seedFact(SOLE, [TARGET]);
      await seedFact(SHARED, [TARGET, OTHER]);
      await seedFact(UNRELATED, [OTHER]);
      await seedFact(CONTROL_FACT, [CONTROL]);

      /*
        THE CONTROL. The obvious one-statement implementation — delete the
        transcript the guardian named — and the belief derived from nothing else
        is still there afterwards. This assertion is the bug, held still: if it
        ever fails, something outside the cascade is removing these facts and
        every assertion below stops proving that the cascade does.
      */
      await c.query('delete from edu.transcripts where session_id = $1 and learner_id = $2', [
        CONTROL,
        learner,
      ]);
      assert.equal(
        await countFact(CONTROL_FACT),
        1,
        'control failed: deleting the transcript row alone already removed its sole-source fact, ' +
          'so the cascade assertions below prove nothing',
      );

      const result = await runErase(TARGET);

      assert.equal(result.erased, true, 'the guardian erased a session and no transcript row went');
      assert.deepEqual(result.erasedFactIds, [SOLE], 'the sole-source fact was not identified');
      assert.deepEqual(result.trimmedFactIds, [SHARED], 'the shared fact was not re-provenanced');

      assert.equal(await countTranscript(TARGET), 0, 'the erased session survived');
      assert.equal(await countTranscript(OTHER), 1, 'erasing one session deleted another');

      assert.equal(
        await countFact(SOLE),
        0,
        'a belief whose only source the guardian deleted survived — the tutor can still state it',
      );
      assert.deepEqual(
        await provenanceOf(SHARED),
        [OTHER],
        'a fact with another source was deleted instead of having its provenance trimmed',
      );
      assert.deepEqual(await provenanceOf(UNRELATED), [OTHER], 'an untouched fact was rewritten');

      assert.equal(
        await countVectors(TARGET),
        0,
        'the session is gone and its embedding is not — doc 19 §5.5: an embedding of learner content IS learner content',
      );
      assert.equal(await countVectors(OTHER), 1, 'another session lost its embedding');

      /*
        Erasing a SESSION blocks nothing. The tag on a surviving fact may be
        supported by transcripts the guardian kept, and recording a block here
        would forbid a topic on the strength of a request to delete one evening.
        `edu.blocked_tags` is written by the single-line eraser, which knows the
        guardian named the belief itself.
      */
      assert.equal(
        (
          await c.query('select count(*)::int n from edu.blocked_tags where learner_id = $1', [
            learner,
          ])
        ).rows[0].n,
        0,
        'erasing a session recorded a blocked tag — a session delete is not a topic ban',
      );

      // A double-press, or a retry of a request that already committed.
      const again = await runErase(TARGET);
      assert.equal(again.erased, false, 'a second erasure of the same session reported a deletion');
      assert.deepEqual(again.erasedFactIds, [], 'a retry erased facts the first pass already had');
      assert.deepEqual(await provenanceOf(SHARED), [OTHER], 'a retry rewrote a settled fact');
    } finally {
      try {
        await c.query('rollback');
        await c.query('delete from edu.knowledge_graph where learner_id = $1', [learner]);
        await c.query('delete from edu.transcripts where learner_id = $1', [learner]);
      } finally {
        await c.end();
      }
    }
  },
);

/*
  "Forget everything" — and everything means every table, for ONE learner.

  `memory.store.ts:confirmForgetAll` was `set({ facts: [], transcripts: [] })`.
  The dialog told a guardian "all N notes and N sessions are deleted. Her
  account, her plan and her past work are not touched", and the only true clause
  in it was the second one.

  TWO THINGS THIS PROVES THAT A ROW COUNT CANNOT.

  1. THE BLOCKED TAGS GO TOO, and the control is what makes that a decision
     rather than an omission. Before the erasure it proves a surviving
     `edu.blocked_tags` row really does suppress the next derivation — so a
     forget-all that kept them would leave a child unable to be noticed liking
     something, on the strength of a fact that no longer exists and that nobody
     can look up to explain why. After it, the same turns derive the interest
     again: the child starts over knowable, which is what the dialog says.

  2. NOBODY ELSE'S ROWS MOVE. A second learner is seeded with a row in every one
     of the four tables and asserted intact afterwards, because the whole
     operation is a `where learner_id = $1` and a missing predicate is the one
     bug here whose blast radius is other people's children.

  The statements are `forgetEduLearnerRecord`, statement for statement. Same
  allowlist reason as every test above.
*/
test(
  'forget everything empties every edu table for one learner and touches no other learner',
  { skip: url ? false : 'no DATABASE_URL' },
  async () => {
    const { default: pg } = await import('pg');
    const { distill, transcriptExpiry } = await import('../../../student-model/src/distill.ts');
    const { withoutBlockedTags } = await import('../../../student-model/src/erasure.ts');

    const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();

    const stamp = `forget-all-${randomUUID()}`;
    const learner = `${stamp}-learner`;
    const bystander = `${stamp}-bystander`;
    const TAG = 'basketball';
    const options = { guardianApprovedInterests: [TAG] };

    const seedTranscript = async (who, sessionId) => {
      await c.query(
        `insert into edu.transcripts (session_id, learner_id, captured_at, expires_at, turns)
         values ($1, $2, now(), now() + interval '29 days', '[]'::jsonb)`,
        [sessionId, who],
      );
      await c.query(
        `insert into edu.embeddings (kind, transcript_id, learner_id, model, embedding)
         select 'transcript', $1, $2, 'pinned-1024',
                ('[' || string_agg('0.01', ',') || ']')::extensions.vector(1024)
           from generate_series(1, 1024)`,
        [sessionId, who],
      );
    };

    const seedFact = async (who, factId, provenance) =>
      c.query(
        `insert into edu.knowledge_graph
           (fact_id, learner_id, kind, skill_id, skill_title, p, attempts,
            derived_from, observed_at, expires_at)
         values ($1, $2, 'mastery', 'fraction-addition', 'Adding fractions', 0.5, 3,
                 $3, now(), now() + interval '400 days')`,
        [factId, who, provenance],
      );

    const seedBlockedTag = async (who, tag) =>
      c.query(
        `insert into edu.blocked_tags (learner_id, tag, kind)
         values ($1, $2, 'interest'::edu.fact_kind)
         on conflict (learner_id, tag) do nothing`,
        [who, tag],
      );

    const rowsIn = async (table, who) =>
      (await c.query(`select count(*)::int n from edu.${table} where learner_id = $1`, [who]))
        .rows[0].n;

    /** `loadEduBlockedTags`, statement for statement. */
    const loadBlockedTags = async (who) =>
      (await c.query('select tag from edu.blocked_tags where learner_id = $1', [who])).rows.map(
        (row) => row.tag,
      );

    /** `forgetEduLearnerRecord`, statement for statement. */
    const forgetEverything = async (who) => {
      await c.query('begin');
      try {
        const tags = await c.query('delete from edu.blocked_tags where learner_id = $1', [who]);
        const facts = await c.query('delete from edu.knowledge_graph where learner_id = $1', [who]);
        /*
          `edu.embeddings` is NOT deleted here, exactly as the retention sweep
          does not delete it: `embeddings_owner_shape` makes `transcript_id` NOT
          NULL for every learner-scoped row and the foreign key is ON DELETE
          CASCADE, so the statement below takes the vectors with it. Asserted,
          never issued — if someone ever relaxes that constraint this test goes
          red instead of a child's embeddings quietly outliving the request to
          delete them.
        */
        const transcripts = await c.query('delete from edu.transcripts where learner_id = $1', [who]);
        await c.query('commit');
        return {
          transcripts: transcripts.rowCount ?? 0,
          facts: facts.rowCount ?? 0,
          blockedTags: tags.rowCount ?? 0,
        };
      } catch (error) {
        await c.query('rollback');
        throw error;
      }
    };

    const capturedAt = new Date();
    const nextSession = {
      id: randomUUID(),
      learnerId: learner,
      capturedAt: capturedAt.toISOString(),
      expiresAt: transcriptExpiry(capturedAt),
      turns: [
        {
          skillId: 'Fractions',
          skillTitle: 'Fractions',
          correct: true,
          hintDepth: 1,
          interestTags: [TAG],
          storable: true,
        },
      ],
    };
    const interestId = `${learner}:interest:${TAG}`;

    try {
      await seedTranscript(learner, randomUUID());
      await seedTranscript(learner, randomUUID());
      await seedFact(learner, `${stamp}:mastery:one`, [nextSession.id]);
      await seedFact(learner, `${stamp}:mastery:two`, [nextSession.id]);
      await seedBlockedTag(learner, TAG);

      await seedTranscript(bystander, randomUUID());
      await seedFact(bystander, `${stamp}:mastery:bystander`, [nextSession.id]);
      await seedBlockedTag(bystander, TAG);

      /*
        THE CONTROL, in two halves. Unfiltered, the next session derives the
        interest — so the distiller can still see the thing this test is about.
        Filtered through the blocked tag as it stands BEFORE the erasure, it
        cannot. That is what a surviving `edu.blocked_tags` row would do to a
        child who was told everything had been forgotten.
      */
      assert.ok(
        distill(nextSession, [], new Date(), options).some((fact) => fact.id === interestId),
        'control failed: the distiller derives no interest from these turns, ' +
          'so the blocked-tag assertions below prove nothing',
      );
      const before = await loadBlockedTags(learner);
      assert.deepEqual(before, [TAG], 'the blocked tag was not seeded');
      assert.equal(
        distill(
          { ...nextSession, turns: withoutBlockedTags(nextSession.turns, before) },
          [],
          new Date(),
          options,
        ).some((fact) => fact.id === interestId),
        false,
        'control failed: a blocked tag no longer suppresses derivation, so clearing it proves nothing',
      );

      const forgotten = await forgetEverything(learner);
      assert.equal(forgotten.transcripts, 2, 'forget-all did not delete both sessions');
      assert.equal(forgotten.facts, 2, 'forget-all did not delete both facts');
      assert.equal(forgotten.blockedTags, 1, 'forget-all did not clear the blocked tag');

      for (const table of ['transcripts', 'knowledge_graph', 'embeddings', 'blocked_tags']) {
        assert.equal(
          await rowsIn(table, learner),
          0,
          `forget-all left rows in edu.${table} — the guardian was told everything was deleted`,
        );
      }

      /*
        The other family. One row in each of the same four tables, seeded before
        the erasure and asserted after it, because "delete this child's record"
        and "delete a child's record" are one missing predicate apart.
      */
      for (const table of ['transcripts', 'knowledge_graph', 'embeddings', 'blocked_tags']) {
        assert.equal(
          await rowsIn(table, bystander),
          1,
          `forget-all for one learner deleted another learner's edu.${table} rows`,
        );
      }

      /*
        And the point of clearing the blocked tags: the same turns derive the
        interest again. A forget-all that kept them would leave the child
        permanently unable to be noticed liking basketball, enforced by a row
        referring to a fact that no longer exists.
      */
      const after = await loadBlockedTags(learner);
      assert.deepEqual(after, [], 'a blocked tag survived a request to forget everything');
      assert.ok(
        distill(
          { ...nextSession, turns: withoutBlockedTags(nextSession.turns, after) },
          [],
          new Date(),
          options,
        ).some((fact) => fact.id === interestId),
        'the child cannot be known again after starting over — an erased instruction is still suppressing derivation',
      );
    } finally {
      try {
        await c.query('rollback');
        for (const who of [learner, bystander]) {
          await c.query('delete from edu.blocked_tags where learner_id = $1', [who]);
          await c.query('delete from edu.knowledge_graph where learner_id = $1', [who]);
          await c.query('delete from edu.transcripts where learner_id = $1', [who]);
        }
      } finally {
        await c.end();
      }
    }
  },
);
