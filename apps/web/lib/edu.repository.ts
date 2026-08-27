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
  eraseTranscript,
  interestFact,
  isMisconceptionTag,
  masteryFact,
  misconceptionFact,
  reviewFact,
  scaffoldingFact,
  type DerivedFact,
  type Provenanced,
  type SessionTranscript,
} from '@acme/student-model';
import type {
  EraseFactAndBlockTag,
  EraseTranscriptCascade,
  EvidencedTurn,
  ForgetLearnerRecord,
  LoadBlockedTags,
  LoadEvidenceTurns,
  LoadPriorFacts,
  SaveFacts,
  SaveTranscript,
} from '@acme/app/server';
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
 * Every tag this learner's family has erased and forbidden.
 *
 * The read that makes `erasure.ts:withoutBlockedTags` reachable. It was
 * exported, unit-tested and had no production call site for one reason: there
 * was no table to read from, so `tutor.service.ts` declared the port and every
 * caller passed nothing. `edu_blocked_tags.sql` is the table; this is the read.
 *
 * `ctx.learnerId`, never a parameter — a blocked tag is a family's instruction
 * about their own child and a query that accepted the learner would let one
 * family's erasure filter another's model.
 *
 * NOT filtered on anything else. `edu.blocked_tags` has no expiry column on
 * purpose (the migration says why): an instruction that aged out would restore a
 * deleted belief on a schedule nobody was told about.
 */
export const loadEduBlockedTags: LoadBlockedTags = async (ctx) =>
  withEdu(async (client: EduClient) => {
    const { rows } = await client.query<{ tag: string }>(
      'select tag from edu.blocked_tags where learner_id = $1',
      [ctx.learnerId],
    );
    return rows.map((row) => row.tag);
  });

/**
 * One line of the student model, erased — the row deleted AND its tag blocked,
 * in one transaction.
 *
 * WHY A TRANSACTION AND NOT TWO STATEMENTS. The delete alone is the version of
 * this feature that already shipped and did not work: the fact goes, the next
 * distillation reads the same turns, and the same tag returns under the same
 * deterministic `fact_id`. A crash between the two statements reproduces that
 * exactly — a guardian who deleted a line and watches it come back — so the two
 * are committed together or neither is. `withEdu` hands out one connection, so
 * `begin`/`commit` here is a real transaction and not an optimistic pair.
 *
 * THE TAG COMES FROM `RETURNING`, not from the caller. A tag accepted as input
 * would let a request block a tag it had no fact for, which is a way to silently
 * suppress part of a child's model without deleting anything a guardian could
 * see. Reading it off the deleted row means the block can only ever be as wide
 * as the erasure that justified it.
 *
 * The delete is scoped by `learner_id` as well as `fact_id`. `fact_id` is
 * globally unique and already carries the learner as its first segment, so this
 * is redundant today and is here anyway: it is the predicate that keeps a
 * client-supplied id from reaching another family's row if that key convention
 * ever changes, and it costs nothing on a primary-key lookup.
 */
export const eraseEduFactAndBlockTag: EraseFactAndBlockTag = async (ctx, factId) =>
  withEdu(async (client: EduClient) => {
    await client.query('begin');
    try {
      const { rows } = await client.query<{ kind: string; tag: string | null }>(
        `delete from edu.knowledge_graph
          where fact_id = $1 and learner_id = $2
          returning kind::text as kind, tag`,
        [factId, ctx.learnerId],
      );

      const deleted = rows[0];
      if (deleted === undefined) {
        /*
          Committed rather than rolled back, and reported as `erased: false`
          rather than thrown. Nothing was written, so the two are equivalent to
          the database — but "the line is already gone" is the honest answer to a
          double-press or a retry, and turning it into an error would make S27
          tell a guardian an erasure failed on the one screen where being wrong
          about that is the whole problem.
        */
        await client.query('commit');
        return { erased: false, blockedTag: null };
      }

      /*
        Only interests and misconceptions are blockable, and the table's
        `blocked_tags_blockable_kind` CHECK is the enforcement — this condition
        is what keeps the correct case from hitting it. `erasure.ts`: mastery,
        review and scaffolding are records of work the child did, and blocking
        them would leave the tutor forbidden to notice a child improving.
      */
      const blockable = deleted.kind === 'interest' || deleted.kind === 'misconception';
      const blockedTag = blockable ? deleted.tag : null;

      if (blockedTag !== null) {
        await client.query(
          `insert into edu.blocked_tags (learner_id, tag, kind)
           values ($1, $2, $3::edu.fact_kind)
           on conflict (learner_id, tag) do nothing`,
          [ctx.learnerId, blockedTag, deleted.kind],
        );
      }

      await client.query('commit');
      return { erased: true, blockedTag };
    } catch (error) {
      /*
        Rolled back before rethrowing, because `withEdu` returns the connection
        to the shared pool in its own `finally`. A connection released inside an
        aborted transaction hands the next borrower a session where every
        statement fails `25P02` — one failed erasure would take out unrelated
        traffic until the pool recycled.
      */
      await client.query('rollback');
      throw error;
    }
  });

/**
 * One session, erased — the transcript, its vectors, and every belief it was the
 * sole source of — in one transaction.
 *
 * THE CASCADE IS NOT DECIDED HERE. `eraseTranscript` in `@acme/student-model` is
 * the same function the TTL sweep runs and the same one S27's dialog previews
 * through `cascadePreview`; a second implementation in this file is how a
 * guardian is shown "3 of 6 notes go with it" and has a different three deleted.
 * It is called over a two-column PROJECTION rather than over rebuilt
 * `DerivedFact`s on purpose — see `Provenanced`: `factFromRow` drops a row this
 * build cannot represent, and a row dropped here is a belief that outlives the
 * only session that justified it.
 *
 * `for update` ON THE READ, and the whole thing in one transaction, because the
 * cascade is a decision computed from rows and then written back. A distillation
 * committing between the two would re-provenance a fact onto the transcript this
 * transaction is about to delete, and the fact would survive pointing at nothing
 * — the orphaned belief `knowledge_graph_has_provenance` exists to make
 * impossible. The lock makes the read-decide-write atomic rather than optimistic.
 *
 * NOTHING IS BLOCKED. `edu.blocked_tags` is written by the single-line eraser,
 * where the guardian named the belief itself. A tag on a fact that merely lost
 * one of its sources may be supported by sessions the family kept, and recording
 * a block from a request to delete one evening would forbid a topic nobody asked
 * to forbid — `erasure.ts`'s "a deleted interest stays deleted" is about a
 * deleted interest, not about a deleted Tuesday.
 *
 * `edu.embeddings` is not touched and must not be: `embeddings_owner_shape`
 * makes `transcript_id` NOT NULL for every learner-scoped vector and the foreign
 * key is ON DELETE CASCADE, so the transcript delete takes them. The retention
 * sweep says the same thing about itself for the same reason.
 */
export const eraseEduTranscriptCascade: EraseTranscriptCascade = async (ctx, transcriptId) =>
  withEdu(async (client: EduClient) => {
    await client.query('begin');
    try {
      const { rows } = await client.query<{ fact_id: string; derived_from: string[] }>(
        /*
          `$2::edu.opaque_id[]` on the PARAMETER and `derived_from::text[]` in the
          projection — the two casts go in opposite directions and both are
          load-bearing. `loadEduFactsDerivedFrom` explains each at length; the
          short version is that casting the column instead would cost the GIN
          index, and not casting the projection hands `pg` a domain array OID it
          has no parser for and returns `{a,b}` as a string.
        */
        `select fact_id, derived_from::text[] as derived_from
           from edu.knowledge_graph
          where learner_id = $1 and derived_from && $2::edu.opaque_id[]
          for update`,
        [ctx.learnerId, [transcriptId]],
      );

      const facts: Provenanced[] = rows.map((row) => ({
        id: row.fact_id,
        derivedFrom: row.derived_from,
      }));
      const cascade = eraseTranscript(facts, transcriptId);

      if (cascade.erasedFactIds.length > 0) {
        await client.query(
          'delete from edu.knowledge_graph where fact_id = any($1) and learner_id = $2',
          [cascade.erasedFactIds, ctx.learnerId],
        );
      }

      /*
        Only the facts whose provenance actually shrank are rewritten, and the
        difference is a length comparison — `derivedFrom` only ever loses entries
        here, so a shorter list is a changed one. The sweep route computes the
        same set the same way.
      */
      const sourcesBefore = new Map(facts.map((fact) => [fact.id, fact.derivedFrom.length]));
      const trimmed = cascade.facts.filter(
        (fact) => sourcesBefore.get(fact.id) !== fact.derivedFrom.length,
      );
      for (const fact of trimmed) {
        await client.query(
          'update edu.knowledge_graph set derived_from = $2 where fact_id = $1 and learner_id = $3',
          [fact.id, fact.derivedFrom, ctx.learnerId],
        );
      }

      const { rowCount } = await client.query(
        'delete from edu.transcripts where session_id = $1 and learner_id = $2',
        [transcriptId, ctx.learnerId],
      );

      await client.query('commit');
      /*
        `erased: false` when the id named no session of this learner's, committed
        rather than thrown — the same answer `eraseEduFactAndBlockTag` gives to a
        double-press, and for the same reason: the session is gone, which is what
        was asked for, and an error would make S27 restore a row that no longer
        exists.
      */
      return {
        erased: (rowCount ?? 0) > 0,
        erasedFactIds: cascade.erasedFactIds,
        trimmedFactIds: trimmed.map((fact) => fact.id),
      };
    } catch (error) {
      // Rolled back before rethrowing — `withEdu` releases into a shared pool,
      // and a connection freed inside an aborted transaction fails `25P02` for
      // its next borrower. Same reasoning as `eraseEduFactAndBlockTag`.
      await client.query('rollback');
      throw error;
    }
  });

/**
 * Everything the educational store holds about one learner, gone, in one
 * transaction.
 *
 * `where learner_id = $1` on every statement and `ctx.learnerId` as the only
 * source of that value. This is the operation in the product whose blast radius
 * is other people's children if a predicate is ever dropped, which is why the
 * integration test seeds a second learner and asserts every one of their rows
 * intact rather than only counting this learner's to zero.
 *
 * ONE TRANSACTION, not four statements. A crash between them leaves a guardian
 * who pressed "forget everything" with a partly-erased record and a screen that
 * already told them it was empty — and no second pass, because the client has
 * nothing left to retry from.
 *
 * BLOCKED TAGS GO TOO, and this is the one place they are cleared. Erasing a
 * single line RECORDS a block; erasing everything REMOVES them, because after
 * this statement there is no transcript left to re-derive anything from, so the
 * rows can no longer be protecting against the thing they were written for. What
 * they would still do is suppress a tag in sessions that have not happened yet,
 * enforced by an instruction referring to a fact nobody can look up any more —
 * a family who asked us to forget everything would have left behind a standing
 * note about their child, which is the opposite of what they pressed. S27's own
 * dialog says "Natalie starts over knowing nothing", and a surviving blocklist
 * is knowing something.
 *
 * `edu.embeddings` is absent for the reason above: the FK takes the vectors when
 * the transcripts go, and the test asserts it so a relaxed constraint goes red
 * here instead of leaving a child's embeddings behind quietly.
 */
export const forgetEduLearnerRecord: ForgetLearnerRecord = async (ctx) =>
  withEdu(async (client: EduClient) => {
    await client.query('begin');
    try {
      const tags = await client.query('delete from edu.blocked_tags where learner_id = $1', [
        ctx.learnerId,
      ]);
      const facts = await client.query('delete from edu.knowledge_graph where learner_id = $1', [
        ctx.learnerId,
      ]);
      // Facts before transcripts, the order the sweep route argues for: both can
      // be interrupted, and only this one is interrupted in the direction the
      // retention promise was made.
      const transcripts = await client.query('delete from edu.transcripts where learner_id = $1', [
        ctx.learnerId,
      ]);

      await client.query('commit');
      return {
        transcripts: transcripts.rowCount ?? 0,
        facts: facts.rowCount ?? 0,
        blockedTags: tags.rowCount ?? 0,
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
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

/**
 * Doc 34 §4 step 1's graded evidence stream: every storable-or-not turn this
 * learner produced inside one tutoring session's wall-clock window.
 *
 * WINDOWED BY LEARNER + `captured_at`, and that is a documented join, not a
 * shortcut: the evaluate path writes each turn as its own `edu.transcripts`
 * row under a fresh UUID (`tutor.service.ts` mints one per turn), so "the
 * session's turns" exists nowhere as a key. The tutoring session's open/close
 * timestamps are the honest scope — a turn graded while the session was open
 * belongs to it, and the summary pipeline is the only reader that asks.
 *
 * `turns` IS decoded here, unlike `loadExpiredEduTranscripts` above, because
 * this caller genuinely reads them. The DB CHECK `transcripts_turns_shape`
 * whitelists `SessionTurn`'s keys, so the narrowing trusts the discriminants
 * and drops any element that still fails it — one lost turn, never a lost
 * report.
 */
export const loadEduTurnsInWindow: LoadEvidenceTurns = async (ctx, fromIso, toIso) => {
  interface TurnsRow {
    session_id: string;
    turns: unknown[];
  }
  return withEdu(async (client: EduClient) => {
    const { rows } = await client.query<TurnsRow>(
      `select session_id, turns
         from edu.transcripts
        where learner_id = $1
          and captured_at >= $2
          and captured_at <= $3
        order by captured_at`,
      [ctx.learnerId, new Date(fromIso), new Date(toIso)],
    );

    const evidenced: EvidencedTurn[] = [];
    for (const row of rows) {
      if (!Array.isArray(row.turns)) continue;
      row.turns.forEach((value, index) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return;
        const turn = value as {
          skillId?: string;
          skillTitle?: string;
          correct?: boolean;
          hintDepth?: number;
          storable?: boolean;
        };
        if (
          typeof turn.skillId !== 'string' ||
          typeof turn.skillTitle !== 'string' ||
          typeof turn.correct !== 'boolean' ||
          typeof turn.hintDepth !== 'number' ||
          typeof turn.storable !== 'boolean'
        ) {
          return;
        }
        evidenced.push({
          transcriptId: row.session_id,
          index,
          skillId: turn.skillId,
          skillTitle: turn.skillTitle,
          correct: turn.correct,
          hintDepth: turn.hintDepth,
          storable: turn.storable,
        });
      });
    }
    return evidenced;
  });
};
