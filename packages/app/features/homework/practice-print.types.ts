// The one call the preview screen makes to print, forked per platform.
// SOT: docs/work/pr-100/contract.md §Practice sets
// SOT-KEYWORDS: practice print share platform fork expo-print expo-sharing web route
import type { PracticeSetView } from './homework.types.ts';
import type { PracticeSheetMode } from './practice-sheet-html.ts';

/** `shared` when a share sheet or print window opened; `unavailable` when the device has no way to share. */
export type PracticePrintResult = 'shared' | 'unavailable';

export type PrintPracticeSet = (set: PracticeSetView, mode: PracticeSheetMode) => Promise<PracticePrintResult>;
