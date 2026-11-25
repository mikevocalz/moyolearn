// Security pass H5, proved against the real sweep and real rows.
//
// `TutorMessages.ts` gave every turn its own `expires_at` so one exchange could
// be erased without the conversation around it, and `sweep.sql` then deleted
// `tutor_sessions` and `session_transcripts` and never named `tutor_messages`.
// The 30-day promise deleted the empty session row and kept the words. This
// test inserts one expired turn and one live turn, runs the REAL `sweep.sql`
// read off disk, and asserts the first is gone and the second is not — the
// control without which a sweep that deleted nothing would pass.
//
// Same harness as the three tests beside it: a database named by `DATABASE_URL`
// (the environment first, then `.env.local` / `.env` at the repo root), skipped
// honestly when there is none, and SQL issued here because the repository
// begins with `import 'server-only'` and will not load outside a server bundle.
// SOT: docs/verification/security-pass-2026-11.md H5 · packages/payload/src/retention/sweep.sql · packages/payload/src/collections/TutorMessages.ts
// SOT-KEYWORDS: tutor messages sweep integration test retention expires at thirty day turn transcript erasure
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const SWEEP = readFileSync(resolve(here, 'sweep.sql'), 'utf8');

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const name of ['.env.local', '.env']) {
    const file = resolve(repoRoot, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/postgres(?:ql)?:\/\/\S+/);
      if (match) return match[0].replace(/^["']|["']$/g, '');
    }
  }
  return undefined;
}

const url = databaseUrl();
const skip = url ? false : 'no DATABASE_URL';

async function client() {
  const { default: pg } = await import('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  return c;
}

/** One turn, expired or not. The text is a fixture, never a child's words. */
async function insertTurn(db, { messageId, sessionId, learner, expiresAt }) {
  await db.query(
    `insert into payload.tutor_messages
       (message_id, session_id, learner_auth_id, role, text, attachments, expires_at)
     values ($1, $2, $3, 'learner', 'fixture turn', '[]'::jsonb, $4)`,
    [messageId, sessionId, learner, expiresAt],
  );
}

const present = async (db, messageId) => {
  const { rows } = await db.query('select 1 from payload.tutor_messages where message_id = $1', [
    messageId,
  ]);
  return rows.length > 0;
};

test('the sweep deletes an expired tutor turn and keeps a live one', { skip }, async () => {
  const stamp = `tutor-messages-sweep-${randomUUID()}`;
  const learner = `${stamp}-learner`;
  const sessionId = `${stamp}-session`;
  const EXPIRED = `${stamp}-expired`;
  const LIVE = `${stamp}-live`;
  const db = await client();

  try {
    const { rows } = await db.query(
      "select to_regclass('payload.tutor_messages') is not null as present",
    );
    assert.equal(rows[0].present, true, 'payload.tutor_messages is missing — nothing to sweep');

    await insertTurn(db, {
      messageId: EXPIRED,
      sessionId,
      learner,
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    await insertTurn(db, {
      messageId: LIVE,
      sessionId,
      learner,
      expiresAt: new Date(Date.now() + 29 * 86_400_000).toISOString(),
    });

    assert.equal(await present(db, EXPIRED), true);
    assert.equal(await present(db, LIVE), true);

    // Sent WHOLE, as `retention.repository.ts` sends it.
    await db.query(SWEEP);

    assert.equal(await present(db, EXPIRED), false, 'the expired turn survived the sweep — the 30-day promise is false');
    assert.equal(await present(db, LIVE), true, 'a turn inside its window was deleted');

    // Idempotent: a retry deletes nothing more.
    await db.query(SWEEP);
    assert.equal(await present(db, LIVE), true, 'a second sweep took a live turn');
  } finally {
    await db.query('delete from payload.tutor_messages where learner_auth_id = $1', [learner]);
    await db.end();
  }
});
