/**
 * Media readiness for the yellow entrance loader — which blocks GATE the
 * entrance and which may stream in behind it.
 *
 * The contract from the spec (§Media Loading): critical content gates the
 * EntranceLoading phase; secondary content may finish after entrance and
 * arrives as placeholders inside the content window. A block is critical
 * when the question is not answerable without it — the diagram in a
 * diagram-label question, the image in a compare question. Audio/video
 * never gate (they are play-on-demand), and image-grid items past the
 * first four page anyway.
 *
 * Pure data in, list of sources out — the host resolves the actual loads
 * and reports readiness; this file only decides what counts.
 *
 * SOT: spec §Media Loading · question-content.ts · question-layout.ts
 * SOT-KEYWORDS: xr question readiness critical media entrance gate skeleton loading
 */

import type { QuestionContentBlock, QuestionMediaSource } from './question-content.ts';
import type { XrLearningQuestion } from './question-contract.ts';

const CRITICAL_TYPES: ReadonlySet<QuestionContentBlock['type']> = new Set([
  'image', 'diagram', 'map', 'document-region',
]);

const sourceOf = (b: QuestionContentBlock): QuestionMediaSource | null =>
  'source' in b ? b.source : null;

/**
 * The sources the entrance waits on. `image-grid` contributes its first
 * `columns` items — the first page of the grid is the answerable unit;
 * later pages skeleton in.
 */
export function criticalMediaOf(question: XrLearningQuestion): readonly QuestionMediaSource[] {
  const out: QuestionMediaSource[] = [];
  for (const block of question.content) {
    if (CRITICAL_TYPES.has(block.type)) {
      const src = sourceOf(block);
      if (src) out.push(src);
    } else if (block.type === 'image-grid') {
      const firstPage = block.columns ?? 4;
      out.push(...block.items.slice(0, firstPage));
    }
  }
  return out;
}

/** Everything media-shaped that is not critical — loads behind entrance. */
export function secondaryMediaOf(question: XrLearningQuestion): readonly QuestionMediaSource[] {
  const critical = new Set(criticalMediaOf(question));
  const out: QuestionMediaSource[] = [];
  for (const block of question.content) {
    if (block.type === 'image-grid') {
      const firstPage = block.columns ?? 4;
      out.push(...block.items.slice(firstPage));
    } else if (block.type === 'audio' || block.type === 'video') {
      const src = sourceOf(block);
      if (src && !critical.has(src)) out.push(src);
    }
  }
  /* Top-level `media` the content blocks did not already claim is
     secondary by definition — the question renders without it. */
  for (const m of question.media ?? []) {
    if (!critical.has(m)) out.push(m);
  }
  return out;
}
