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
import { MEMORY_FACTS, MEMORY_TRANSCRIPTS, type TranscriptLine } from './memory.data';

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
  confirmEraseTranscript: () => void;
  askForgetAll: () => void;
  confirmForgetAll: () => void;
}

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

  confirmEraseTranscript: () => {
    const { pendingTranscriptId, facts, transcripts } = get();
    if (pendingTranscriptId === null) return;
    set({
      facts: eraseTranscript(facts, pendingTranscriptId).facts,
      transcripts: transcripts.filter((t) => t.id !== pendingTranscriptId),
      pendingTranscriptId: null,
    });
  },

  askForgetAll: () => set({ forgetAllOpen: true }),
  confirmForgetAll: () => set({ facts: [], transcripts: [], forgetAllOpen: false }),
}));

/** What confirming would take. Drives the count in the dialog, per doc 07 §4. */
export const pendingCascade = (state: MemoryState): DerivedFact[] =>
  state.pendingTranscriptId === null
    ? []
    : cascadePreview(state.facts, state.pendingTranscriptId);
