import type { WhiteboardHandle, WhiteboardSnapshot } from '@acme/ui';
import type { ProblemStorage } from '@acme/app/features/capture/problem-storage.shared.ts';
import { createBoardDoc } from '@acme/app/features/tutor/board-doc.ts';
import { readSavedForgeBoard } from '@acme/app/features/tutor/forge-board-storage.ts';

/** Separate MMKV file; this engineering fixture never opens learner storage. */
export const FORGE_PROBE_STORAGE_ID = 'moyo-forge-validation';

/** Reopen through the same validated persistence reader used by production. */
export function restoreProbeDocument(storage: ProblemStorage) {
  const doc = createBoardDoc();
  try {
    const saved = readSavedForgeBoard(storage);
    if (saved !== null) doc.merge(saved, 'restore');
    return { doc, restored: saved !== null };
  } catch (error) {
    doc.destroy();
    throw error;
  }
}

/** The real authoritative document's record count, rather than an input counter. */
export function probeMarkCount(snapshot: WhiteboardSnapshot): number {
  const value = snapshot as { document: { store: Record<string, unknown> } };
  return Object.keys(value.document.store).length;
}

/** Synthetic pressure samples exercise the existing injection seam, not pen hardware. */
export function injectProbeStroke(board: Pick<WhiteboardHandle, 'injectPointer'>): void {
  board.injectPointer({ phase: 'begin', x: 80, y: 80, pressure: 0 });
  board.injectPointer({ phase: 'move', x: 120, y: 100, pressure: 0.25 });
  board.injectPointer({ phase: 'move', x: 165, y: 135, pressure: 0.75 });
  board.injectPointer({ phase: 'move', x: 200, y: 150, pressure: 1 });
  board.injectPointer({ phase: 'end', x: 220, y: 160, pressure: 0 });
}
