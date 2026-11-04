import type { ProblemStorage } from '../capture/problem-storage.shared.ts';
import { BOARD_KEY } from '../capture/problem-storage.shared.ts';
import { createBoardDoc, decodeBoardUpdate, encodeBoardUpdate, type BoardDoc } from './board-doc.ts';

// A successful read/write has already validated these exact bytes. Autosave
// need not reconstruct a second temporary document for its own previous write.
const validatedValues = new WeakMap<ProblemStorage, string>();

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decodeSavedBoard(raw: string): { update: Uint8Array; legacy: boolean } {
  const stored: unknown = JSON.parse(raw);
  const probe = createBoardDoc();
  try {
    if (typeof stored === 'string' && stored.length > 0) {
      const update = decodeBoardUpdate(stored);
      // Valid base64 is not necessarily a valid Yjs update. Parse in a temporary
      // document so a partial failure cannot mutate the learner's live board.
      probe.merge(update, 'restore');
      return { update, legacy: false };
    }
    if (object(stored) && object(stored.document) && object(stored.document.store)) {
      // The previous format was a QuickDraw snapshot. Keep unknown records;
      // renderer support must not decide which saved data survives migration.
      probe.applyDiff({ added: stored.document.store }, 'restore');
      return { update: probe.encode(), legacy: true };
    }
    throw new Error('Saved board is neither a Yjs update nor a legacy snapshot');
  } finally {
    probe.destroy();
  }
}

function preserveOriginal(storage: ProblemStorage, raw: string): void {
  for (let index = 0; ; index += 1) {
    const key = `${BOARD_KEY}:recovery${index === 0 ? '' : `:${index}`}`;
    const previous = storage.getString(key);
    if (previous === raw) return;
    if (previous === undefined) {
      // This must complete before a writer replaces BOARD_KEY. If storage is
      // full or unavailable, the original slot stays intact and the write fails.
      storage.set(key, raw);
      return;
    }
  }
}

/**
 * Reads a saved board without letting damaged bytes reach the live document.
 *
 * Corrupt values and the legacy JSON snapshot are copied verbatim to a recovery
 * key before any migration. Reading never removes or rewrites the original slot.
 * Returns null for a missing or corrupt board. Storage failures still throw so
 * callers cannot mistake a failed preservation step for a successful recovery.
 * @see writeSavedForgeBoard
 */
export function readSavedForgeBoard(storage: ProblemStorage): Uint8Array | null {
  const raw = storage.getString(BOARD_KEY);
  if (raw === undefined || raw.length === 0) return null;
  let decoded: ReturnType<typeof decodeSavedBoard>;
  try {
    decoded = decodeSavedBoard(raw);
  } catch {
    preserveOriginal(storage, raw);
    return null;
  }
  if (decoded.legacy) preserveOriginal(storage, raw);
  else validatedValues.set(storage, raw);
  return decoded.update;
}

/**
 * Saves the authoritative Yjs board while retaining any old, unreadable value.
 * A failed recovery-key write leaves the original saved value unchanged.
 * @see readSavedForgeBoard
 */
export function writeSavedForgeBoard(storage: ProblemStorage, doc: BoardDoc): void {
  const raw = storage.getString(BOARD_KEY);
  if (raw !== undefined && raw.length > 0 && validatedValues.get(storage) !== raw) {
    let preserve = false;
    try {
      preserve = decodeSavedBoard(raw).legacy;
    } catch {
      preserve = true;
    }
    if (preserve) preserveOriginal(storage, raw);
  }
  const encoded = JSON.stringify(encodeBoardUpdate(doc.encode()));
  storage.set(BOARD_KEY, encoded);
  validatedValues.set(storage, encoded);
}
