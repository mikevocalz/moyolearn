// The durable per-learner daily inference budget (doc 12 §7).
//
// `packages/inference/src/budget.ts` defines `BudgetLedger` as a PORT and ships
// `inMemoryLedger()` behind it. That implementation is process-local, and on
// Vercel that means the §7 ceiling did not exist: every deploy zeroed every
// child's day, and two concurrent lambdas serving the same child each believed
// they were the only counter. This file is the implementation that makes the
// number true — and it lives HERE, not there, because
// `tooling/check-no-training-path.mjs` fails the build the moment
// `packages/inference` can reach a repository or the educational store. The
// gateway holds the credential; it must never also hold the read path.
//
// The table is `edu.inference_budget` (`packages/payload/migrations/edu_inference_budget.sql`),
// reached through `edu.client` exactly like every other `edu` read — which is
// what puts it behind `tooling/check-store-separation.mjs`'s one-door rule
// rather than beside it.
// SOT: packages/inference/src/budget.ts · packages/payload/migrations/edu_inference_budget.sql · docs/pack/12-systems-design-prompt.md §7
// SOT-KEYWORDS: budget ledger repository durable daily turns usd ceiling learner upsert atomic increment retention prune edu
import 'server-only';
import type { BudgetLedger, LedgerDay } from '@acme/inference';
import type { VoiceBudgetLedger, VoiceLedgerDay } from '@acme/voice';
import { withEdu, type EduClient } from './edu.client';

/**
 * `pg` returns `numeric` as a string so a value wider than a double survives the
 * trip. Parsed here rather than trusted, for the same reason `edu.repository.ts`
 * gives about `p` and `hint_depth`: the decision to narrow should be visible at
 * the place it happens.
 */
interface BudgetRow {
  turns: number;
  usd: string;
}

/**
 * The durable ledger.
 *
 * A factory rather than an object literal so the composition root can name the
 * moment it is installed, and so a test can hold two of them — which is the
 * whole proof this file needed. Two instances share nothing in this process;
 * the only thing they have in common is the row, which is exactly what a
 * restarted process has in common with the one before it.
 */
export function durableBudgetLedger(): BudgetLedger {
  return {
    /**
     * A missing row is a day not yet started, not an error. `{ turns: 0, usd: 0 }`
     * is the same value `inMemoryLedger` returns for an unknown key, so
     * `budgetStateFor` cannot tell a fresh learner from a fresh deploy — which
     * is correct, because for a learner those are the same day.
     */
    read: async (learnerId: string, day: string): Promise<LedgerDay> =>
      withEdu(async (client: EduClient) => {
        const { rows } = await client.query<BudgetRow>(
          `select turns, usd
             from edu.inference_budget
            where learner_id = $1 and day = $2::date`,
          [learnerId, day],
        );
        const row = rows[0];
        return row === undefined ? { turns: 0, usd: 0 } : { turns: row.turns, usd: Number(row.usd) };
      }),

    /**
     * One statement, and that is the load-bearing detail.
     *
     * The obvious shape — SELECT, add one, UPDATE — is a read-modify-write across
     * a network, and two lambdas debiting the same child at the same instant
     * would both read `n` and both write `n + 1`. The child gets a free turn per
     * collision, which is precisely the overrun the ceiling exists to stop, and
     * it happens most under the 3–7pm peak doc 12 §7 models. `ON CONFLICT … DO
     * UPDATE` makes the increment atomic in Postgres, so concurrency is the
     * database's problem and not a comment asking future callers to be careful.
     *
     * `expires_at` is absent from the INSERT because the column is GENERATED: the
     * retention window is not something a writer may choose. See the migration.
     */
    record: async (learnerId: string, day: string, usd: number): Promise<void> => {
      await withEdu(async (client: EduClient) => {
        await client.query(
          `insert into edu.inference_budget (learner_id, day, turns, usd)
                values ($1, $2::date, 1, $3)
           on conflict (learner_id, day) do update
                   set turns = edu.inference_budget.turns + 1,
                       usd   = edu.inference_budget.usd + excluded.usd,
                       last_turn_at = now()`,
          [learnerId, day, usd],
        );
      });
    },
  };
}

/**
 * `pg` numerics arrive as strings; see `BudgetRow`.
 */
interface VoiceBudgetRow {
  voice_chars: number;
  voice_usd: string;
}

/**
 * The durable VOICE ledger — doc 32 §5's cost line, on the SAME row as the
 * inference budget and deliberately not the same columns.
 *
 * Same row: one learner-day is one record of a child's activity, swept by one
 * retention rule (`expires_at` covers the whole row), behind the one `edu`
 * door `check-store-separation.mjs` already guards. A second table would be a
 * second place a learner id lives that the sweep has to know about.
 *
 * Separate columns: doc 32 §6's shed order — "voice degrades to text before
 * tutoring degrades at all" — needs voice spend and tutoring spend to hit
 * DIFFERENT ceilings, and `record` on the inference ledger counts a TURN per
 * call, which a per-sentence TTS debit would burn through in minutes. Voice is
 * priced per character; it gets a character column and a usd column of its own
 * (`edu_inference_budget_voice.sql`).
 */
export function durableVoiceBudgetLedger(): VoiceBudgetLedger {
  return {
    read: async (learnerId: string, day: string): Promise<VoiceLedgerDay> =>
      withEdu(async (client: EduClient) => {
        const { rows } = await client.query<VoiceBudgetRow>(
          `select voice_chars, voice_usd
             from edu.inference_budget
            where learner_id = $1 and day = $2::date`,
          [learnerId, day],
        );
        const row = rows[0];
        return row === undefined
          ? { chars: 0, usd: 0 }
          : { chars: row.voice_chars, usd: Number(row.voice_usd) };
      }),

    /**
     * One atomic statement, exactly like `record` above and for its reason —
     * two lambdas debiting the same child must not hand out a free sentence
     * per collision. `turns` is NOT incremented: a spoken sentence is not a
     * tutoring turn, and charging one against the other would let the voice
     * budget end a child's lesson.
     */
    record: async (learnerId: string, day: string, chars: number, usd: number): Promise<void> => {
      await withEdu(async (client: EduClient) => {
        await client.query(
          `insert into edu.inference_budget (learner_id, day, voice_chars, voice_usd)
                values ($1, $2::date, $3, $4)
           on conflict (learner_id, day) do update
                   set voice_chars = edu.inference_budget.voice_chars + excluded.voice_chars,
                       voice_usd   = edu.inference_budget.voice_usd + excluded.voice_usd`,
          [learnerId, day, chars, usd],
        );
      });
    },
  };
}

/**
 * Deletes ledger days past their window. Returns rows deleted.
 *
 * The ledger is a record of when a child was working, keyed by their id, so it
 * gets swept like everything else keyed that way — a counter is not exempt from
 * doc 07 §4 merely because it holds no words. `expires_at` is thirty days after
 * the day it counts (the generated column), matching `TRANSCRIPT_TTL_DAYS`, so
 * no trace of a session outlives the session's own transcript.
 *
 * Takes the cutoff rather than reading the clock, so the retention sweep can
 * hold ONE cutoff across every store it touches — the same reason
 * `apps/web/app/api/retention/sweep/route.ts` reads `new Date()` once.
 */
export async function pruneExpiredBudgetDays(cutoff: Date): Promise<number> {
  return withEdu(async (client: EduClient) => {
    const { rowCount } = await client.query(
      'delete from edu.inference_budget where expires_at <= $1',
      [cutoff],
    );
    return rowCount ?? 0;
  });
}
