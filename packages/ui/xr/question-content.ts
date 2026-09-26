/**
 * The typed content-block model a question's `content` array composes —
 * the seam between "what the question carries" and "how the XR content
 * window presents it". Blocks are data, never layout: `question-layout.ts`
 * picks the arrangement; `QuestionContentView` (native surface) renders
 * the blocks themselves.
 *
 * REUSE, NOT PARALLELISM: `QuestionMediaSource` mirrors the fields the
 * media/capture pipeline already produces (`TutorAttachment`-shaped —
 * `packages/ui/tutor-attachment.ts`), and structured math rides the
 * repo's bounded MathJSON allowlist (`packages/student-model` exports
 * `MathJsonExpression`). A question never embeds pixels or raw markup —
 * sources are URIs/keys so textures stay budgeted (spec §Images).
 *
 * SOT: docs/pack/24-homework-capture-spec.md · spec §3 (moyo-xr-rive-dynamic-questions-prompt)
 * SOT-KEYWORDS: xr question content block media math table diagram passage contract structured
 */

import type { MathJsonExpression } from '@cortex-js/compute-engine';

/** Mirrors `MediaKind` + the attachment fields capture already stores. */
export interface QuestionMediaSource {
  readonly kind: 'image' | 'audio' | 'video' | 'document';
  /** Resolved URL or storage key — never inline bytes. */
  readonly uri: string;
  readonly mimeType?: string;
  /** Accessible description — required on image/diagram/map/video surfaces. */
  readonly alt?: string;
  readonly caption?: string;
  readonly transcript?: string;
  /** Pixel size when known — aspect preservation depends on it. */
  readonly width?: number;
  readonly height?: number;
}

export interface DiagramLabel {
  /** Semantic ID the answer references — never a screen coordinate. */
  readonly id: string;
  readonly text: string;
}

export interface TableColumn {
  readonly key: string;
  readonly header?: string;
  readonly unit?: string;
}
export interface TableCell {
  readonly text: string;
  /** Driver for highlighted/selectable cells. */
  readonly id?: string;
}
export type TableRow = readonly TableCell[];

export interface TimelineEvent {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
}

export interface MapMarker {
  readonly id: string;
  readonly label: string;
  /** Semantic anchor text the authored map provides — not px coords. */
  readonly anchor?: string;
}

export interface StructuredChart {
  readonly kind: 'bar' | 'line' | 'pie' | 'scatter';
  readonly title?: string;
  /** Series labels + values — a textual summary is derivable from this. */
  readonly series: readonly { label: string; values: readonly number[] }[];
  readonly categories?: readonly string[];
}

/**
 * The block union. `document-region` is the homework-evidence handoff: it
 * carries an evidence region reference, NOT re-OCR'd pixels — capture
 * stays the owner of the source image and its uncertainty.
 */
export type QuestionContentBlock =
  | { readonly type: 'text'; readonly text: string; readonly emphasis?: 'normal' | 'strong' | 'callout' }
  | { readonly type: 'heading'; readonly text: string }
  | { readonly type: 'list'; readonly style: 'bullet' | 'numbered'; readonly items: readonly string[] }
  | { readonly type: 'image'; readonly source: QuestionMediaSource }
  | { readonly type: 'image-grid'; readonly items: readonly QuestionMediaSource[]; readonly columns?: number }
  | { readonly type: 'diagram'; readonly source: QuestionMediaSource; readonly labels?: readonly DiagramLabel[] }
  | { readonly type: 'equation'; readonly expression: MathJsonExpression }
  | { readonly type: 'table'; readonly columns: readonly TableColumn[]; readonly rows: readonly TableRow[] }
  | { readonly type: 'code'; readonly language?: string; readonly code: string }
  | { readonly type: 'quote'; readonly text: string; readonly attribution?: string }
  | { readonly type: 'passage'; readonly text: string; readonly title?: string }
  | { readonly type: 'timeline'; readonly events: readonly TimelineEvent[] }
  | { readonly type: 'map'; readonly source: QuestionMediaSource; readonly markers?: readonly MapMarker[] }
  | { readonly type: 'chart'; readonly chart: StructuredChart }
  | { readonly type: 'audio'; readonly source: QuestionMediaSource }
  | { readonly type: 'video'; readonly source: QuestionMediaSource }
  | { readonly type: 'document-region'; readonly evidenceRegionId: string }
  | { readonly type: 'board'; readonly boardId?: string };

export type QuestionContentBlockType = QuestionContentBlock['type'];
