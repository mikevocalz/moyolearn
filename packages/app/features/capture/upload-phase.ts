// uploadPhaseKey — pure phase resolution for the capture upload/process step.
//
// Exists because the phase used to be derived inline and had a hole: a batch
// with failures while ONLINE matched no branch and fell through to
// 'Preparing' forever — a child watching a lie. The failure states are now
// explicit: offline failures wait for the connection, settled online failures
// become a calm, retryable 'error'. Pure so the truth table is testable
// without a store or a screen.
// SOT: docs/pack/24-homework-capture-spec.md §1 stage 6 · docs/pack/30-upload-surfaces-spec.md §4
// SOT-KEYWORDS: upload phase preparing uploading processing ready waiting error failed retry capture

import type { TransferStatus } from '../media/upload-surfaces.shared.ts';

export type UploadPhaseKey =
  | 'preparing'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'waiting'
  | 'error';

/**
 * @param statuses the tray statuses of this batch's rows (may lag `expected`
 *   while the mirror catches up — missing rows count as still preparing)
 * @param expected how many items the batch enqueued
 */
export function uploadPhaseKey(
  statuses: readonly TransferStatus[],
  expected: number,
  online: boolean,
): UploadPhaseKey {
  const done = statuses.filter((s) => s === 'done').length;
  const failed = statuses.filter((s) => s === 'failed').length;

  if (expected > 0 && done >= expected) return 'ready';
  if (failed > 0 && !online) return 'waiting';
  // Settled with failures: nothing is still moving, so say so and offer retry.
  if (failed > 0 && done + failed >= expected) return 'error';
  if (statuses.includes('processing')) return 'processing';
  if (statuses.includes('uploading')) return 'uploading';
  return 'preparing';
}
