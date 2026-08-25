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
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 §S27
// SOT-KEYWORDS: memory s27 store erasure cascade zustand guardian delete

import { create } from 'zustand';
import { cascadePreview, eraseFact, eraseTranscript, type DerivedFact } from '@acme/student-model/pure';
import { MEMORY_FACTS, MEMORY_TRANSCRIPTS, type TranscriptLine } from './memory.data';

interface MemoryState {
  facts: DerivedFact[];
  transcripts: TranscriptLine[];
  /** The transcript awaiting confirmation; null when the dialog is closed. */
  pendingTranscriptId: string | null;
  forgetAllOpen: boolean;

  eraseLine: (factId: string) => void;
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

  eraseLine: (factId) => set((state) => ({ facts: eraseFact(state.facts, factId).facts })),

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
