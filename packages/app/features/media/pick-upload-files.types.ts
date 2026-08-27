// The one contract both pick-upload-files forks honour.
// SOT: docs/pack/30-upload-surfaces-spec.md §8.2
// SOT-KEYWORDS: pick upload files types picker fork media kinds multiple
import type { MediaKind } from './media.types.ts';
import type { CandidateFile } from './upload-surfaces.shared.ts';

export interface PickUploadOptions {
  kinds: readonly MediaKind[];
  /** Multi-select is the PICKER's job on native (doc 30 §8.2) — one call, many files. */
  multiple: boolean;
}

/** Resolves [] on cancel — a dismissed picker is not an error. */
export type PickUploadFiles = (options: PickUploadOptions) => Promise<CandidateFile[]>;
