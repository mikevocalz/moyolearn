import type { Diff, Snapshot, Store } from '@quickdrawjs/core';
import type { BoardDoc } from './board-doc.ts';

/**
 * Gives Forge's renderer binding a read-only view of the existing Yjs board.
 *
 * The source contains no editable QuickDraw Store, input router or undo stack.
 * Subscribe before reading the initial snapshot, as Forge's binding does, so a
 * change during renderer setup cannot be missed. The caller owns each listener's
 * cleanup; disposing a renderer must never destroy the shared document.
 *
 * Records pass through unchanged, including unsupported legacy records. Forge's
 * encoder/compiler or native parser validates them and chooses the fallback.
 * This adapter must not rewrite or discard data to make a renderer accept it.
 *
 * @see BoardDoc.onRecords
 */
export function createForgeBoardSource(doc: BoardDoc): Pick<Store, 'getSnapshot' | 'listen'> {
  return {
    // BoardDoc creates this envelope itself. It preserves unknown record kinds;
    // the renderer, rather than the persisted document, owns format validation.
    getSnapshot: () => doc.snapshot() as Snapshot,
    listen(listener, { source = 'all' } = {}) {
      return doc.onRecords((diff, origin) => {
        const changeSource = origin === 'local' ? 'user' : 'remote';
        if (source !== 'all' && source !== changeSource) return;
        // QuickDraw composeDiff/Forge's encoder require all three bags, while
        // BoardDoc omits empty bags. Updated records are already normalized to
        // added records by BoardDoc; removals retain their original values.
        const complete = {
          added: diff.added ?? {},
          updated: diff.updated ?? {},
          removed: diff.removed ?? {},
        } as Diff;
        listener(complete, changeSource);
      });
    },
  };
}
