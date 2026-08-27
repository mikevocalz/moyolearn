'use client';
// S27 erasure state — the eraser, and the fact that it works.
//
// Doc 07 §S27: "every line is literally erasable, and the eraser works." So the
// cascade predicates come from `@acme/student-model/pure` rather than being
// re-implemented here. A screen that computes its own version of "what does this
// delete" is a screen that can promise one thing and have the server do another,
// which on this particular screen is the whole failure.
//
// There is no undo. An undo on an erasure screen is a retention window the
// guardian did not agree to, dressed as a courtesy — so the destructive action
// confirms first (see the dialog in the content file) and then it is done.
//
// THE ERASER REACHES THE SERVER. It did not: `eraseLine` filtered a local array
// and stopped, so the line vanished, the database never heard about it, and a
// reload restored it. The store now calls `POST /api/memory/erase`, which
// deletes the fact from `edu.knowledge_graph` and records its tag in
// `edu.blocked_tags` so the next distillation cannot derive it back.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 §S27 · apps/web/app/api/memory/erase/route.ts
// SOT-KEYWORDS: memory s27 store erasure cascade zustand guardian delete optimistic reconcile blocked tag

import { create } from 'zustand';
import { cascadePreview, eraseFact, eraseTranscript, type DerivedFact } from '@acme/student-model/pure';
import { MEMORY_FACTS, MEMORY_TRANSCRIPTS, type TranscriptLine } from './memory.data.ts';

/**
 * The same three-way env read every client module in this tree does, copied for
 * the reason `ai-activity.store.ts` gives about its own copy: importing another
 * feature's store to borrow a base URL mounts that feature's state on this
 * screen.
 */
const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.EXPO_PUBLIC_APP_URL ??
  'http://localhost:3001';

/**
 * Puts a fact back where it was after a failed erasure.
 *
 * Re-inserted at its ORIGINAL INDEX in the CURRENT list rather than by restoring
 * a snapshot of the whole array. A snapshot would undo any other erasure that
 * settled while this request was in flight — a guardian deleting three lines
 * quickly would watch two of them return because the first one failed.
 */
const reinstate = (facts: readonly DerivedFact[], fact: DerivedFact, index: number): DerivedFact[] =>
  facts.some((existing) => existing.id === fact.id)
    ? [...facts]
    : [...facts.slice(0, index), fact, ...facts.slice(index)];

interface MemoryState {
  facts: DerivedFact[];
  transcripts: TranscriptLine[];
  /** The transcript awaiting confirmation; null when the dialog is closed. */
  pendingTranscriptId: string | null;
  forgetAllOpen: boolean;
  /**
   * Set when an erasure did not reach the server and the line has been put back.
   * Null the rest of the time.
   *
   * It exists because the alternative on this particular screen is the failure
   * the whole feature is about: a guardian shown a line as erased when it is
   * not. Restoring the row silently would be the same lie told more quietly.
   */
  eraseError: string | null;

  eraseLine: (factId: string) => Promise<void>;
  askEraseTranscript: (transcriptId: string) => void;
  cancelErase: () => void;
  confirmEraseTranscript: () => Promise<void>;
  askForgetAll: () => void;
  confirmForgetAll: () => Promise<void>;
}

/**
 * What `/api/memory/forget-all` says about the child's uploaded files.
 *
 * Mirrors `ErasedMedia` in `memory.service.ts` and is declared here rather than
 * imported, because that module begins with `import 'server-only'` and this one
 * runs in a browser and on a phone. Narrowed from the parsed body by
 * `mediaIncomplete` below rather than asserted, so a response shape that stops
 * matching reads as "we cannot vouch for the files" instead of throwing on a
 * screen whose whole job is to be truthful about deletion.
 */
interface ForgetAllResponse {
  media?: {
    scoped?: boolean;
    deleted?: number;
    failed?: readonly string[];
    /** Present only on the refusal branch, and shown to the guardian verbatim. */
    reason?: string;
  };
}

/**
 * True when the record went and the FILES did not — a 200 the guardian still has
 * to be told about.
 *
 * `scoped: false` is the school-account case (`presign.rules.ts` explains why
 * there is no per-child prefix there); a non-empty `failed` is Bunny refusing.
 * Either way "forget everything" is not yet true, and this screen may not report
 * a deletion it cannot vouch for.
 */
const mediaIncomplete = (body: ForgetAllResponse): boolean => {
  const media = body.media;
  if (media === undefined) return true;
  if (media.scoped !== true) return true;
  return (media.failed?.length ?? 0) > 0;
};

export const useMemoryStore = create<MemoryState>((set, get) => ({
  facts: MEMORY_FACTS,
  transcripts: MEMORY_TRANSCRIPTS,
  pendingTranscriptId: null,
  forgetAllOpen: false,
  eraseError: null,

  /**
   * Optimistic, then reconciled — and the reconciliation is the point.
   *
   * The row goes immediately, because a delete a guardian has to wait on reads
   * as hesitation on the one screen designed not to hesitate. But if the request
   * does not land, the row comes BACK and says so: doc 07 §S27's promise is that
   * the eraser works, and a screen that keeps showing a line as erased after the
   * server refused is telling a parent something false about their child's
   * record.
   *
   * A network failure and a 500 are the same event here — "we could not delete
   * it" — so they share a branch. `erased: false` from the route is NOT that
   * event: it means the line was already gone, which is the outcome asked for.
   */
  eraseLine: async (factId) => {
    const before = get().facts;
    const index = before.findIndex((fact) => fact.id === factId);
    const fact = before[index];
    if (fact === undefined) return;

    set({ facts: eraseFact(before, factId).facts, eraseError: null });

    try {
      const response = await fetch(`${API_URL}/api/memory/erase`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ factId }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch {
      set((state) => ({
        facts: reinstate(state.facts, fact, index),
        eraseError: 'That line could not be deleted just now. It is still here — try again.',
      }));
    }
  },

  askEraseTranscript: (transcriptId) => set({ pendingTranscriptId: transcriptId }),
  cancelErase: () => set({ pendingTranscriptId: null, forgetAllOpen: false }),

  /**
   * The session, and the beliefs it alone supported — optimistic, then
   * reconciled, exactly as `eraseLine` above.
   *
   * The cascade is `eraseTranscript` from `@acme/student-model/pure`, which is
   * the same function `apps/web/lib/edu.repository.ts:eraseEduTranscriptCascade`
   * runs against the rows, and the same one `cascadePreview` counted in the
   * dialog the guardian just read. Three call sites, one definition of what a
   * session takes with it — a local re-implementation is how a screen promises
   * "3 notes go with it" and a different three are deleted.
   *
   * REINSTATEMENT RESTORES THE WHOLE PRE-ERASURE STATE here, and this is the one
   * place that is right. `eraseLine` re-inserts a single fact at its index
   * precisely so a failure cannot undo other erasures that settled in flight; a
   * cascade has no single index — it removed a session and an unknown set of
   * facts from several groups — and putting those back individually would be a
   * second implementation of the cascade, run backwards. The dialog closes on
   * confirm, so no second cascade can start while this one is in the air.
   */
  confirmEraseTranscript: async () => {
    const { pendingTranscriptId, facts, transcripts } = get();
    if (pendingTranscriptId === null) return;

    set({
      facts: eraseTranscript(facts, pendingTranscriptId).facts,
      transcripts: transcripts.filter((t) => t.id !== pendingTranscriptId),
      pendingTranscriptId: null,
      eraseError: null,
    });

    try {
      const response = await fetch(`${API_URL}/api/memory/erase-transcript`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcriptId: pendingTranscriptId }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch {
      set({
        facts,
        transcripts,
        eraseError:
          'That session could not be deleted just now. It is still here — try again.',
      });
    }
  },

  askForgetAll: () => set({ forgetAllOpen: true }),

  /**
   * Everything — and the only action on this screen that can succeed and still
   * owe the guardian a sentence.
   *
   * `/api/memory/forget-all` empties the educational store transactionally and
   * then deletes the child's uploaded files. The second half can refuse: on a
   * school account there is no prefix that selects one child's objects
   * (`presign.rules.ts:learnerMediaScope`), and Bunny can simply be down. The
   * record is gone either way — it is not put back, because it really was
   * deleted — but the screen says what was left, since a guardian told
   * "everything is deleted" while their child's voice recordings survive is this
   * feature's failure wearing a success message.
   *
   * A refusal of the whole request restores both lists. The empty screen is the
   * lie `confirmForgetAll` used to tell unconditionally.
   */
  confirmForgetAll: async () => {
    const { facts, transcripts } = get();
    set({ facts: [], transcripts: [], forgetAllOpen: false, eraseError: null });

    try {
      const response = await fetch(`${API_URL}/api/memory/forget-all`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      /*
        A body that will not parse is treated as an unverifiable media outcome,
        not as a failure: the 200 means the transaction committed, so restoring
        the rows would put a model back on screen that no longer exists.
      */
      const body: ForgetAllResponse = await response
        .json()
        .then((parsed: ForgetAllResponse) => parsed)
        .catch(() => ({}));

      if (mediaIncomplete(body)) {
        set({
          eraseError:
            body.media?.scoped === false && typeof body.media.reason === 'string'
              ? `Everything Natalie remembered is deleted. ${body.media.reason}`
              : 'Everything Natalie remembered is deleted. Some of Maya’s uploaded photos or recordings could not be removed just now — they will be deleted automatically within seven days.',
        });
      }
    } catch {
      set({
        facts,
        transcripts,
        eraseError: 'Nothing could be deleted just now. It is all still here — try again.',
      });
    }
  },
}));

/** What confirming would take. Drives the count in the dialog, per doc 07 §4. */
export const pendingCascade = (state: MemoryState): DerivedFact[] =>
  state.pendingTranscriptId === null
    ? []
    : cascadePreview(state.facts, state.pendingTranscriptId);
