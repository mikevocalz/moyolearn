// The hosted content surface's props, in the platform-neutral file — same
// split as every other `Xr*` pair: a type-only re-export is erased at build
// but still resolved by a bundler, so the shapes live where no renderer does.
// SOT: packages/ui/xr/QuestionContent.native.tsx
// SOT-KEYWORDS: xr question content surface props media resolver layout paging

import type { QuestionContentBlock, QuestionMediaSource } from './question-content.ts';
import type { XrLearningQuestion } from './question-contract.ts';
import type { QuestionLayout } from './question-layout.ts';

/**
 * How a media URI becomes something RN `Image` can draw. The fixture scheme
 * (`fixture:name`) resolves to bundled assets; real questions carry storage
 * URIs. Returning `null` is honest — the block renders its skeleton + alt
 * treatment rather than a stretched or broken image.
 */
export type QuestionMediaResolver = (source: QuestionMediaSource) => { uri: string } | null;

export interface QuestionContentProps {
  question: XrLearningQuestion;
  /** The resolver's verdict — this surface renders what it is told, it does
      not second-guess the layout. */
  layout: QuestionLayout;
  /** Media resolver — the host owns URI → drawable mapping. */
  resolveMedia?: QuestionMediaResolver;
  /** Which page of a `paged` layout is showing — the flow store owns it. */
  page?: number;
  /** The surface learned how many pages the content takes; the store
      records it so a page command knows the bound. */
  onPageCount?: (pages: number) => void;
  /** A critical media block finished loading or failed — the entrance gate
      counts these. `id` is the block's own index in `question.content`. */
  onMediaSettled?: (index: number, ok: boolean) => void;
}
