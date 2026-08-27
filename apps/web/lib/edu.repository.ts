// Educational-store repository — the only code that reads or writes `edu`.
//
// Doc 12 §3: "separation is enforced by the repository layer and the no-read-path
// build check, not by running three databases we don't need yet." This file is
// the repository half of that sentence; `tooling/check-store-separation.mjs` is
// the check half, and it names this file as the sole permitted importer of
// `edu.client` and the sole permitted author of `edu.*` SQL outside migrations.
//
// Split from `retention.repository.ts` rather than added to it for the reason
// that file gives about itself: it speaks Payload, and Payload does not know the
// `edu` schema exists. Same sweep, two stores, two repositories — which is the
// shape doc 12 §4 asks for when it says the erasure cascade spans all three.
//
// SCOPE, stated so nobody reads more into it: this is the RETENTION and ERASURE
// surface. The tutoring write path still lands in `payload.session_transcripts`
// and `payload.student_model_facts` (`student-model.repository.ts`), so `edu`
// holds no production rows yet. Moving that write path is its own change with
// its own cutover; what is finished here is that when a row DOES exist in `edu`,
// the sweep already deletes it, and the build check already refuses to let a
// feature reach past this file to touch it.
// SOT: docs/pack/12-systems-design-prompt.md §3 §4 · packages/student-model/src/erasure.ts · packages/payload/migrations/edu_schema.sql
// SOT-KEYWORDS: edu repository educational store retention sweep erasure cascade provenance derived fact transcript separation
import 'server-only';
import {
  interestFact,
  isMisconceptionTag,
  masteryFact,
  misconceptionFact,
  reviewFact,
  scaffoldingFact,
  type DerivedFact,
  type SessionTranscript,
} from '@acme/student-model';
import { withEdu, type EduClient } from './edu.client';

/**
 * `edu.knowledge_graph` as a row.
 *
 * Every variant field is nullable here because the DATABASE decides which are
 * populated — `knowledge_graph_variant_shape` is the SQL spelling of the
 * discriminated union, so a row that reaches this type has already been proved
 * consistent by the CHECK. `factFromRow` therefore narrows on `kind` alone and
 * never has to invent a fallback for a combination the schema cannot store.
 */
interface FactRow {
  fact_id: string;
  learner_id: string;
  kind: string;
  skill_id: string | null;
  skill_title: string | null;
  tag: string | null;
  p: string | null;
  attempts: number | null;
  due_at: Date | null;
  interval_days: number | null;
  hint_depth: string | null;
  active: boolean | null;
  guardian_approved: boolean | null;
  derived_from: string[];
  observed_at: Date;
  expires_at: Date;
}

interface TranscriptRow {
  session_id: string;
  learner_id: string;
  captured_at: Date;
  expires_at: Date;
}

/**
 * `pg` returns `numeric` as a string so a value wider than a double survives the
 * trip. `p` and `hint_depth` are both narrow enough to be safe, but parsing here
 * rather than trusting `pg` to have done it keeps the decision visible.
 */
const num = (value: string | null): number => (value === null ? 0 : Number(value));

/**
 * Rebuilds a `DerivedFact` by calling the SAME constructor that authored it.
 *
 * This is what pays for `edu.knowledge_graph` having no `sentence` column. The
 * sentence is a pure function of the structured values (`facts.ts` builds it at
 * construction and says so), so regenerating it here keeps one author of that
 * string and leaves the table with nowhere to put a second, editable copy — the
 * copy a careless writer would eventually fill with something a child said.
 *
 * The same applies to `expiresAt`: the constructors recompute it from
 * `observedAt` and the TTL constant, and `knowledge_graph_ttl_window` is what
 * guarantees the stored value agrees. Two derivations, one answer, and the CHECK
 * is what keeps them from drifting.
 *
 * Returns `null` only for a `kind` this build does not know — a row written by a
 * newer deployment during a rollout. Dropping it beats guessing at it: a fact
 * this code cannot represent is one it also cannot state to a parent.
 */
function factFromRow(row: FactRow): DerivedFact | null {
  const common = {
    id: row.fact_id,
    learnerId: row.learner_id,
    derivedFrom: row.derived_from,
    observedAt: row.observed_at,
  };

  if (row.kind === 'mastery') {
    return masteryFact({
      ...common,
      skillId: row.skill_id ?? '',
      skillTitle: row.skill_title ?? '',
      p: num(row.p),
      attempts: row.attempts ?? 0,
    });
  }

  if (row.kind === 'misconception') {
    // The taxonomy CHECK on the table already refuses an unknown tag, so this
    // guard should be unreachable. It is here because `misconceptionFact`
    // indexes `MISCONCEPTIONS` directly, and a row written before a tag was
    // retired from the taxonomy would otherwise index off the end of it.
    return row.tag !== null && isMisconceptionTag(row.tag)
      ? misconceptionFact({ ...common, tag: row.tag, active: row.active ?? false })
      : null;
  }

  if (row.kind === 'review') {
    return reviewFact({
      ...common,
      skillId: row.skill_id ?? '',
      skillTitle: row.skill_title ?? '',
      dueAt: (row.due_at ?? row.observed_at).toISOString(),
      intervalDays: row.interval_days ?? 1,
    });
  }

  if (row.kind === 'interest') {
    return interestFact({
      ...common,
      tag: row.tag ?? '',
      guardianApproved: row.guardian_approved ?? false,
    });
  }

  if (row.kind === 'scaffolding') {
    return scaffoldingFact({
      ...common,
      skillId: row.skill_id ?? '',
      skillTitle: row.skill_title ?? '',
      hintDepth: num(row.hint_depth),
    });
  }

  return null;
}

/**
 * Every transcript in the educational store whose window has closed by `cutoff`.
 *
 * `turns` comes back EMPTY, for the reason `retention.repository.ts` gives about
 * its own loader: the cascade is defined on provenance and `expireTranscripts`
 * never reads a turn, so decoding the JSON column here would be an unchecked
 * assertion about a shape this file has no reason to inspect.
 */
export async function loadExpiredEduTranscripts(cutoff: Date): Promise<SessionTranscript[]> {
  return withEdu(async (client: EduClient) => {
    const { rows } = await client.query<TranscriptRow>(
      `select session_id, learner_id, captured_at, expires_at
         from edu.transcripts
        where expires_at <= $1`,
      [cutoff],
    );
    return rows.map((row) => ({
      id: row.session_id,
      learnerId: row.learner_id,
      capturedAt: row.captured_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      turns: [],
    }));
  });
}

/**
 * Every fact naming any of `transcriptIds` in its provenance.
 *
 * `derived_from && $1` — array overlap, served by the GIN index the migration
 * builds. The alternative, loading the learner's whole graph and filtering in
 * JS, is the version of this that gets slow exactly when a family has been using
 * the product longest.
 */
export async function loadEduFactsDerivedFrom(
  transcriptIds: readonly string[],
): Promise<DerivedFact[]> {
  if (transcriptIds.length === 0) return [];
  return withEdu(async (client: EduClient) => {
    const { rows } = await client.query<FactRow>(
      /*
        Two different casts, for two different reasons, and neither is optional.

        `derived_from::text[]` in the SELECT list: the column's declared type is
        `edu.opaque_id[]`, an array OF A DOMAIN, and `pg` ships no type parser for
        that OID — without the cast the driver returns the raw literal `{a,b}` as
        a string and the first consumer to call `.filter` on a provenance list
        throws. Casting in the projection only; it touches no predicate.

        `$1::edu.opaque_id[]` in the predicate, NOT `derived_from::text[] && $1`:
        Postgres has no `edu.opaque_id[] && text[]` operator, and casting the
        COLUMN to reach one would make the predicate an expression the GIN index
        cannot serve — turning every erasure into a sequential scan of the whole
        graph. Casting the parameter instead keeps the bitmap index scan.
      */
      `select fact_id, learner_id, kind, skill_id, skill_title, tag, p, attempts,
              due_at, interval_days, hint_depth, active, guardian_approved,
              derived_from::text[] as derived_from, observed_at, expires_at
         from edu.knowledge_graph
        where derived_from && $1::edu.opaque_id[]`,
      [transcriptIds],
    );
    return rows
      .map(factFromRow)
      .filter((fact): fact is DerivedFact => fact !== null);
  });
}

/** Facts the cascade decided have no surviving source. Returns rows deleted. */
export async function eraseEduFacts(factIds: readonly string[]): Promise<number> {
  if (factIds.length === 0) return 0;
  return withEdu(async (client: EduClient) => {
    const { rowCount } = await client.query(
      'delete from edu.knowledge_graph where fact_id = any($1)',
      [factIds],
    );
    return rowCount ?? 0;
  });
}

/**
 * Facts that lost a source but kept at least one.
 *
 * A single statement per fact and no `delete`+`insert` pair, because
 * `knowledge_graph_has_provenance` makes the intermediate empty-array state
 * illegal — the constraint that encodes `erasure.ts`'s "a fact left with no
 * provenance is DELETED, never kept as an orphan" also rules out writing one
 * transiently. Nothing here can leave a fact briefly unprovenanced for a
 * concurrent reader to see.
 */
export async function updateEduFactProvenance(facts: readonly DerivedFact[]): Promise<number> {
  if (facts.length === 0) return 0;
  return withEdu(async (client: EduClient) => {
    let updated = 0;
    for (const fact of facts) {
      const { rowCount } = await client.query(
        'update edu.knowledge_graph set derived_from = $2 where fact_id = $1',
        [fact.id, fact.derivedFrom],
      );
      updated += rowCount ?? 0;
    }
    return updated;
  });
}

/**
 * Deletes transcripts by id, and — by foreign key, not by remembering to —
 * every `edu.embeddings` row hanging off them. Doc 19 §5.5: "an embedding of
 * learner content IS learner content."
 *
 * Takes the ids the cascade actually ran on rather than re-asking for
 * `expires_at <= now()`. Re-asking would let a transcript cross its expiry
 * mid-sweep and be deleted without its facts, and once the row is gone nothing
 * can find those facts again.
 */
export async function deleteEduTranscripts(sessionIds: readonly string[]): Promise<number> {
  if (sessionIds.length === 0) return 0;
  return withEdu(async (client: EduClient) => {
    const { rowCount } = await client.query(
      'delete from edu.transcripts where session_id = any($1)',
      [sessionIds],
    );
    return rowCount ?? 0;
  });
}
