/**
 * `resolveQuestionLayout` — the pure layout resolver for the XR question
 * panel. Given a question's content blocks, its interaction and the
 * content window's size, it names the ONE layout the native content
 * surface should compose. Deliberately a pure function: the decision is
 * data in, data out — no Viro, no Rive, no store — so fixtures and tests
 * cover every path without a headset.
 *
 * The window is one rect and the hosted surface does its own flexbox —
 * "media-left + question-right" is a template choice inside the surface,
 * not panel geometry. What the resolver decides is WHICH template, plus
 * whether choices ride the Rive rail or the native list, and whether the
 * content paginates/scrolls.
 *
 * SOT: spec §Layout Resolver · question-content.ts · question-contract.ts
 * SOT-KEYWORDS: xr question layout resolver presentation template choices rail native
 */

import type { QuestionContentBlock } from './question-content.ts';
import { MAX_RIVE_CHOICES, type QuestionInteraction } from './question-contract.ts';

export type QuestionLayoutKind =
  | 'text-only'
  | 'text-choices'
  | 'media-left'
  | 'media-top'
  | 'passage-left'
  | 'diagram-focus'
  | 'image-grid'
  | 'table-focus'
  | 'equation-focus'
  | 'code-focus'
  | 'map-focus'
  | 'board-focus'
  | 'audio-focus'
  | 'timeline-focus';

export interface QuestionLayoutViewport {
  /** Content window size in surface dp — drives paging/scroll decisions. */
  readonly width: number;
  readonly height: number;
}

/** A rough line budget per block — enough for "will it fit" calls without
    measuring glyph runs (the hosted surface lays out honestly anyway). */
function blockLines(b: QuestionContentBlock): number {
  switch (b.type) {
    case 'text': return Math.max(1, Math.ceil(b.text.length / 60)) + 1;
    case 'heading': return 2;
    case 'list': return b.items.length + 1;
    case 'image': case 'map': return 12;
    case 'image-grid': return Math.ceil(b.items.length / (b.columns ?? 2)) * 6 + 2;
    case 'diagram': return 14;
    case 'equation': return 3;
    case 'table': return b.rows.length + 2;
    case 'code': return b.code.split('\n').length + 2;
    case 'quote': return Math.ceil(b.text.length / 60) + 2;
    case 'passage': return Math.ceil(b.text.length / 90) + 3;
    case 'timeline': return b.events.length * 2;
    case 'chart': return 10;
    case 'audio': return 4;
    case 'video': return 12;
    case 'document-region': return 10;
    case 'board': return 16;
  }
}

export interface QuestionLayout {
  readonly kind: QuestionLayoutKind;
  /** The Rive rail shows ≤6 choices; longer sets render natively. */
  readonly choiceSurface: 'rive' | 'native' | 'none';
  /** Content exceeds the window — the surface pages rather than shrinks. */
  readonly paged: boolean;
  /** The focus block the layout is built around, when there is one. */
  readonly focus: QuestionContentBlock['type'] | null;
}

export function resolveQuestionLayout(
  content: readonly QuestionContentBlock[],
  interaction: QuestionInteraction,
  choiceCount: number,
  viewport: QuestionLayoutViewport,
): QuestionLayout {
  const types = new Set(content.map((b) => b.type));

  /* The interaction is the strongest signal — a board-work question
     always gets the board surface, whatever the prompt text says. */
  if (interaction === 'board-work') {
    return { kind: 'board-focus', choiceSurface: 'none', paged: false, focus: 'board' };
  }

  const has = (t: QuestionContentBlock['type']) => types.has(t);
  const choiceSurface =
    interaction === 'multiple-choice' || interaction === 'true-false' || interaction === 'multi-select'
      ? choiceCount <= MAX_RIVE_CHOICES ? 'rive' : 'native'
      : 'none';

  /* Focus blocks each own a dedicated layout — first match wins, in the
     order the spec's subject compositions expect (media kinds before
     generic text). */
  const focusOrder: readonly QuestionContentBlock['type'][] = [
    'diagram', 'map', 'table', 'code', 'passage', 'timeline', 'chart',
    'video', 'audio', 'image-grid', 'image', 'equation', 'document-region', 'board',
  ];
  const focusType = focusOrder.find(has) ?? null;

  let kind: QuestionLayoutKind;
  switch (focusType) {
    case 'diagram': kind = 'diagram-focus'; break;
    case 'map': kind = 'map-focus'; break;
    case 'table': kind = 'table-focus'; break;
    case 'code': kind = 'code-focus'; break;
    case 'passage': kind = 'passage-left'; break;
    case 'timeline': case 'chart': kind = 'timeline-focus'; break;
    case 'video': case 'image': case 'document-region':
      kind = viewport.width >= viewport.height ? 'media-left' : 'media-top';
      break;
    case 'audio': kind = 'audio-focus'; break;
    case 'image-grid': kind = 'image-grid'; break;
    case 'equation': kind = 'equation-focus'; break;
    case 'board': kind = 'board-focus'; break;
    default:
      kind = choiceSurface === 'none' ? 'text-only' : 'text-choices';
  }

  /* Paging: the hosted texture has no scroll input — content past one
     window's line capacity must page, never shrink and never clip. */
  const budget = content.reduce((n, b) => n + blockLines(b), 0);
  const capacity = Math.max(1, Math.floor(viewport.height / 28));
  const paged = budget > capacity;

  return { kind, choiceSurface, paged, focus: focusType };
}
