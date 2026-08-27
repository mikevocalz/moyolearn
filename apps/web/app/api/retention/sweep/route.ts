// POST /api/retention/sweep — delete expired transcripts and the beliefs that
// only they support.
//
// `SessionTranscripts.ts` states the guarantee in its own header: "The sweep
// that acts on it is `expireTranscripts` in `@acme/student-model`, which deletes
// the row AND every derived fact the row is the sole source of." That sweep had
// no runtime. `expiresAt` was written at capture by `transcriptExpiry` and
// nothing ever read it, so a published retention window was a comment.
//
// The cascade algebra is NOT reimplemented here. `expireTranscripts` already
// decides which facts go, which lose one source and survive, and which are
// untouched; this route is the driver that loads the rows, hands them to it, and
// writes the answer back.
//
// Mirrors the media sweep exactly (`app/api/media/sweep/route.ts`): a POST
// behind a bearer secret, a GET cron door beside it, one shared implementation.
// SOT: packages/student-model/src/erasure.ts:expireTranscripts · packages/payload/src/collections/SessionTranscripts.ts · docs/design/seq-erasure-cascade.md
// SOT-KEYWORDS: retention sweep transcript expiry erasure cascade derived fact provenance cron version shadow children data
import { NextRequest, NextResponse } from 'next/server';
import { expireTranscripts } from '@acme/student-model';
import {
  loadExpiredTranscripts,
  loadFactsDerivedFrom,
  deleteFacts,
  deleteTranscripts,
  updateFactProvenance,
  sweepVersionShadows,
} from '@/lib/retention.repository';
import {
  loadExpiredEduTranscripts,
  loadEduFactsDerivedFrom,
  eraseEduFacts,
  updateEduFactProvenance,
  deleteEduTranscripts,
} from '@/lib/edu.repository';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  /*
    A shared secret, not a session — same reasoning as the media sweep. This runs
    from a scheduler with no user, and an open endpoint that deletes a child's
    learning history is not made safe by being hard to guess.
  */
  const secret = process.env.RETENTION_SWEEP_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  /*
    ONE cutoff, held for the whole sweep and used for both the query and the
    cascade. Re-reading the clock between the two would let a transcript cross
    its expiry mid-run and be deleted without its facts — and once the transcript
    row is gone nothing can find those facts again, which is an orphaned belief
    that outlives its source forever.
  */
  const cutoff = new Date();

  try {
    const transcripts = await loadExpiredTranscripts(cutoff);
    const facts = await loadFactsDerivedFrom(transcripts.map((transcript) => transcript.id));

    const cascade = expireTranscripts(transcripts, facts, cutoff);

    /*
      A fact survives the cascade in one of two states: untouched, or holding
      fewer sources than it did. Only the second needs a write, and the
      difference is a length comparison against what was loaded — `derivedFrom`
      only ever shrinks here, so a shorter list is a changed one.
    */
    const sourcesBefore = new Map(facts.map((fact) => [fact.id, fact.derivedFrom.length]));
    const reprovenanced = cascade.facts.filter(
      (fact) => (sourcesBefore.get(fact.id) ?? fact.derivedFrom.length) !== fact.derivedFrom.length,
    );

    /*
      Facts first, transcripts second.

      A failure between them leaves a child with fewer derived facts than
      transcripts, and the next run finishes the transcripts. Reversed, a failure
      would leave beliefs whose source is already deleted and whose provenance
      now points at nothing — unreachable by this sweep or any later one. Both
      orders can be interrupted; only one is interrupted in the direction the
      retention promise was made.
    */
    const erasedFacts = await deleteFacts(cascade.erasedFactIds);
    const updatedFacts = await updateFactProvenance(reprovenanced);
    const deletedTranscripts = await deleteTranscripts(
      transcripts.map((transcript) => transcript.id),
    );
    const shadowRows = await sweepVersionShadows();

    /*
      The SAME sweep against the `edu` schema (doc 12 §4's educational store).

      Two stores, one cascade: `expireTranscripts` is called a second time rather
      than the two row sets being merged, because a transcript id is only unique
      within its own store and a merged run could let one store's transcript
      strip provenance off the other store's fact. Same algebra, same cutoff,
      same fact-before-transcript order, separate universes.

      `edu.embeddings` is not swept explicitly and must not be: its rows hang off
      `edu.transcripts` by a foreign key declared ON DELETE CASCADE, so
      `deleteEduTranscripts` already takes them. A loop here would be a second,
      forgettable copy of a guarantee the database is making.
    */
    const eduTranscripts = await loadExpiredEduTranscripts(cutoff);
    const eduFacts = await loadEduFactsDerivedFrom(
      eduTranscripts.map((transcript) => transcript.id),
    );
    const eduCascade = expireTranscripts(eduTranscripts, eduFacts, cutoff);
    const eduSourcesBefore = new Map(eduFacts.map((fact) => [fact.id, fact.derivedFrom.length]));
    const eduReprovenanced = eduCascade.facts.filter(
      (fact) =>
        (eduSourcesBefore.get(fact.id) ?? fact.derivedFrom.length) !== fact.derivedFrom.length,
    );

    const eduErasedFacts = await eraseEduFacts(eduCascade.erasedFactIds);
    const eduUpdatedFacts = await updateEduFactProvenance(eduReprovenanced);
    const eduDeletedTranscripts = await deleteEduTranscripts(
      eduTranscripts.map((transcript) => transcript.id),
    );

    return NextResponse.json({
      ok: true,
      expiredTranscripts: transcripts.length,
      // Named counts rather than one total: "3 deleted" cannot tell a reader
      // whether the cascade ran at all or whether it ran and found nothing.
      deletedTranscripts,
      erasedFacts,
      updatedFacts,
      shadowRows,
      // Reported under their own names rather than summed into the counts above.
      // A response that says "4 facts erased" without saying which store cannot
      // answer the question the separation exists to make answerable.
      eduExpiredTranscripts: eduTranscripts.length,
      eduDeletedTranscripts,
      eduErasedFacts,
      eduUpdatedFacts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sweep failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
