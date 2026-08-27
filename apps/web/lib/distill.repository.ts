// One transcript, loaded by id, WITH its turns.
//
// This is the read `edu.distill` needs and the one read of `edu.transcripts`
// that did not already exist. `edu.repository.ts:loadExpiredEduTranscripts`
// returns `turns: []` on purpose — the retention cascade is defined on
// provenance and never reads a turn — so the sweep's loader cannot serve a job
// whose entire purpose is to read the turns.
//
// It is a separate file rather than another export on `edu.repository.ts`
// because that file is the tutoring WRITE path and is being edited on another
// branch; a new read appended to it would be a merge conflict on the one file
// two features both need. It is still a repository by the only definition
// `tooling/check-store-separation.mjs` recognises — `*.repository.ts`, holding
// the edu client, exporting an operation rather than SQL.
// SOT: apps/web/lib/edu.repository.ts · packages/student-model/src/distill.ts · docs/design/jobs.md §2.1 §4.1
// SOT-KEYWORDS: distill repository transcript turns edu educational store job payload ids only load by id
import 'server-only';
import type { SessionTranscript, SessionTurn } from '@acme/student-model';
import { withEdu, type EduClient } from './edu.client';

/**
 * `turns` is typed rather than validated, and the database is what makes that
 * honest: `edu_schema.sql`'s `transcripts_turns_shape` CHECK rejects any array
 * element carrying a key outside `SessionTurn`'s, so a row that exists is a row
 * whose turns have that shape. Re-validating here would be a second, weaker copy
 * of a constraint the store already enforces — and the alternative CLAUDE.md
 * bans outright (`unknown`, then a hand-written guard) would be exactly that.
 */
interface TranscriptRow {
  session_id: string;
  learner_id: string;
  captured_at: Date;
  expires_at: Date;
  turns: readonly SessionTurn[];
}

/**
 * The transcript a distillation job names, or `null` if it is gone.
 *
 * `null` IS THE EXPECTED ANSWER for an expired transcript, and it is what makes
 * `docs/design/jobs.md` §4.1's ids-only payload rule pay off: a job row holding
 * only `{ transcriptId }` becomes harmless the moment the retention sweep
 * deletes the row it names — the handler finds nothing and completes, rather
 * than resurrecting a child's turns from a queue table the erasure cascade
 * cannot see. The caller must treat this as success, not as a failure to retry.
 */
export async function loadTranscriptForDistillation(
  transcriptId: string,
): Promise<SessionTranscript | null> {
  return withEdu(async (client: EduClient) => {
    const { rows } = await client.query<TranscriptRow>(
      `select session_id, learner_id, captured_at, expires_at, turns
         from edu.transcripts
        where session_id = $1`,
      [transcriptId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.session_id,
      learnerId: row.learner_id,
      capturedAt: row.captured_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      turns: row.turns,
    };
  });
}
