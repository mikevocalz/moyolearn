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
// SCOPE: the WHOLE educational store — the tutoring write path and the retention
// sweep, in that order below. It used to be the sweep alone, and said so: the
// tutoring path wrote `payload.session_transcripts` and
// `payload.student_model_facts`, so `edu` was built, privileged, swept, gated —
// and empty. Doc 12 §4's separation was documented and not in effect. The write
// path moved here with `edu_backfill_from_payload.sql`, which copied the rows
// that already existed; those two things together are what put the separation
// into effect rather than into a diagram.
//
// The `payload` collections still exist and are still swept
// (`retention.repository.ts`), for the reasons the backfill migration states at
// its foot. Nothing writes them any more.
// SOT: docs/pack/12-systems-design-prompt.md §3 §4 · packages/student-model/src/erasure.ts · packages/payload/migrations/edu_schema.sql · packages/payload/migrations/edu_backfill_from_payload.sql
// SOT-KEYWORDS: edu repository educational store tutoring write path transcripts knowledge graph retention sweep erasure cascade provenance derived fact separation
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
import type { LoadPriorFacts, SaveFacts, SaveTranscript } from '@acme/app/server';
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
 * The projection every fact read in this file uses, written once.
 *
 * `derived_from::text[]` is the load-bearing part: the column's declared type is
 * `edu.opaque_id[]`, an array OF A DOMAIN, and `pg` ships no type parser for that
 * OID — without the cast the driver returns the raw literal `{a,b}` as a string
 * and the first consumer to call `.filter` on a provenance list throws. Two
 * readers wanted the same sixteen columns and the same cast, and a second copy
 * is where one of them eventually loses it.
 */
const FACT_PROJECTION = `fact_id, learner_id, kind, skill_id, skill_title, tag, p, attempts,
       due_at, interval_days, hint_depth, active, guardian_approved,
       derived_from::text[] as derived_from, observed_at, expires_at`;

/**
 * The learner's whole model, for the tutoring read path.
 *
 * `ctx.learnerId` and never a parameter — CLAUDE.md §The block: identity comes
 * from the protected boundary, so a caller cannot ask this for somebody else's
 * child by passing a different string.
 *
 * NOT filtered on `expires_at`. `isExpired` in `facts.ts` is the reader's gate
 * and `distill` needs the prior fact even when it has aged out — dropping it
 * here would make the next session read a missing prior as a fresh start and
 * reset a mastery estimate the sweep had not yet removed. The sweep is what
 * deletes; a read that also deleted-by-omission would be a second policy.
 */
export const loadEduPriorFacts: LoadPriorFacts = async (ctx) =>
  withEdu(async (client: EduClient) => {
    const { rows } = await client.query<FactRow>(
      `select ${FACT_PROJECTION}
         from edu.knowledge_graph
        where learner_id = $1`,
      [ctx.learnerId],
    );
    return rows.map(factFromRow).filter((fact): fact is DerivedFact => fact !== null);
  });

/**
 * One session transcript, landed in the educational store.
 *
 * `learnerAuthId` on the incoming shape is already `ctx.learnerId` — the service
 * builds it there — so it is written verbatim rather than re-read from `ctx`,
 * which would silently repair a mismatch instead of letting the two disagree
 * loudly if the service ever stopped binding them.
 *
 * `turns` is the only jsonb column `edu` has, and `transcripts_turns_shape` is
 * why it is allowed to exist: the constraint whitelists `SessionTurn`'s keys, so
 * a turn that carried what the child SAID is rejected by the database rather
 * than by a reviewer. Nothing is stripped here on the way in — stripping would
 * make the constraint unreachable and therefore untested.
 */
export const saveEduTranscript: SaveTranscript = async (_ctx, transcript) => {
  await withEdu(async (client: EduClient) => {
    await client.query(
      /*
        `on conflict do nothing`, not `do update`. A transcript is a capture, not
        a document — `SessionTranscripts.ts` says the collection is immutable for
        the same reason — so a repeated `sessionId` is a retry of a write that
        already succeeded, and the honest response is to leave the first one
        alone rather than to overwrite a record of what happened.
      */
      `insert into edu.transcripts
         (session_id, learner_id, captured_at, expires_at, turns)
       values ($1, $2, $3, $4, $5::jsonb)
       on conflict (session_id) do nothing`,
      [
        transcript.sessionId,
        transcript.learnerAuthId,
        transcript.capturedAt,
        transcript.expiresAt,
        JSON.stringify(transcript.turns),
      ],
    );
  });
};

/**
 * `skillId` → the human title, taken from whatever fact in the SAME batch has
 * one.
 *
 * `ScaffoldingFact` does not carry `skillTitle`: `scaffoldingFact` takes it,
 * spends it on the sentence and drops it. `knowledge_graph_variant_shape`
 * nonetheless requires `skill_title` for a scaffolding row, because the table
 * stores what the CONSTRUCTOR consumes so the row can be rebuilt through the one
 * function allowed to author that sentence (`edu_schema.sql` says this at
 * length). The title is not invented: `distill` emits mastery, review and
 * scaffolding together for every storable turn, and the first two carry it, so
 * the batch always holds the answer.
 *
 * The fallback to `skillId` covers the one case the batch cannot answer — a
 * scaffolding fact surviving from a prior model whose skill saw no turn this
 * session. In this product the two are the same string (`tutor.service.ts` sets
 * `skillId: skillTitle` from one `inferSkillTitle` call), so the fallback is
 * exact today and is a legible degradation rather than a guess if they diverge.
 */
function skillTitleIndex(facts: readonly DerivedFact[]): Map<string, string> {
  const titles = new Map<string, string>();
  for (const fact of facts) {
    if (fact.kind === 'mastery' || fact.kind === 'review') titles.set(fact.skillId, fact.skillTitle);
  }
  return titles;
}

/**
 * One `DerivedFact` as the sixteen values `edu.knowledge_graph` takes.
 *
 * Written as an exhaustive switch over the union rather than as a spread of
 * whatever the fact happens to hold, because the destination is a discriminated
 * union too — `knowledge_graph_variant_shape` requires every column belonging to
 * another variant to be NULL, so "not applicable" has to be stated, not omitted.
 * A fact kind added to `facts.ts` without a branch here fails to compile.
 */
function factColumns(
  fact: DerivedFact,
  titles: Map<string, string>,
): readonly (string | number | boolean | null | readonly string[])[] {
  const common = [fact.id, fact.learnerId, fact.kind] as const;
  const provenance = [fact.derivedFrom, fact.observedAt, fact.expiresAt] as const;
  // skill_id, skill_title, tag, p, attempts, due_at, interval_days, hint_depth,
  // active, guardian_approved — in the column order of the statement below.
  const variant: (string | number | boolean | null)[] =
    fact.kind === 'mastery'
      ? [fact.skillId, fact.skillTitle, null, fact.p, fact.attempts, null, null, null, null, null]
      : fact.kind === 'review'
        ? [fact.skillId, fact.skillTitle, null, null, null, fact.dueAt, fact.intervalDays, null, null, null]
        : fact.kind === 'scaffolding'
          ? [
              fact.skillId,
              titles.get(fact.skillId) ?? fact.skillId,
              null, null, null, null, null,
              fact.hintDepth,
              null, null,
            ]
          : fact.kind === 'misconception'
            ? [fact.skillId, null, fact.tag, null, null, null, null, null, fact.active, null]
            : [null, null, fact.tag, null, null, null, null, null, null, fact.guardianApproved];
  return [...common, ...variant, ...provenance];
}

/**
 * The distilled model, written back.
 *
 * UPSERT, because `distill` keys a fact deterministically per learner+kind+skill
 * and returns the WHOLE model rather than a patch — so every call restates every
 * belief, and the row is a current belief rather than an entry in an observation
 * log. The `payload` version of this did a `find` then a `create`-or-`update`
 * per fact, three round trips where the primary key already answers the
 * question.
 *
 * `sentence` and `strategy` have nowhere to go and are dropped: the constructors
 * in `facts.ts` rebuild both from the structured values on the way out, and a
 * column for either would be a second, editable copy of prose about a child.
 *
 * A statement per fact rather than one multi-row insert. The values differ per
 * row, the batch is the size of a learner's model, and a failure that names the
 * fact it happened on is worth more here than a round trip: a fact the schema
 * refuses is a fact the distiller should not have produced, and swallowing it
 * would leave the store's guarantee unverifiable.
 */
export const saveEduFacts: SaveFacts = async (_ctx, facts) => {
  if (facts.length === 0) return;
  const titles = skillTitleIndex(facts);
  await withEdu(async (client: EduClient) => {
    for (const fact of facts) {
      await client.query(
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
           kind = excluded.kind,
           skill_id = excluded.skill_id,
           skill_title = excluded.skill_title,
           tag = excluded.tag,
           p = excluded.p,
           attempts = excluded.attempts,
           due_at = excluded.due_at,
           interval_days = excluded.interval_days,
           hint_depth = excluded.hint_depth,
           active = excluded.active,
           guardian_approved = excluded.guardian_approved,
           derived_from = excluded.derived_from,
           observed_at = excluded.observed_at,
           expires_at = excluded.expires_at`,
        factColumns(fact, titles),
      );
    }
  });
};

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
        `$1::edu.opaque_id[]` in the predicate, NOT `derived_from::text[] && $1`:
        Postgres has no `edu.opaque_id[] && text[]` operator, and casting the
        COLUMN to reach one would make the predicate an expression the GIN index
        cannot serve — turning every erasure into a sequential scan of the whole
        graph. Casting the parameter instead keeps the bitmap index scan. The
        cast in the projection is the other direction and is explained on
        `FACT_PROJECTION`.
      */
      `select ${FACT_PROJECTION}
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
