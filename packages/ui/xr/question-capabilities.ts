/**
 * Subject capabilities — what the XR question panel may claim to support,
 * per subject. The spec's rule is "do not claim a subject, language, or
 * interaction until its fixture passes", and this table is where that
 * claim is written down: an interaction absent from a subject's set is
 * not a missing feature, it is a declined promise — the host surfaces it
 * as such rather than rendering it broken.
 *
 * `native-fallback` marks interactions the panel accepts by routing the
 * answer to a surface outside the rail (composer, board, voice) rather
 * than grading it — they show, they submit `ungraded`, they never fake
 * a verdict.
 *
 * SOT: spec §subjects/interactions · question-contract.ts · question-fixtures.ts
 * SOT-KEYWORDS: xr question subject capabilities interactions support fallback honest
 */

import type { LearningSubject, QuestionInteraction } from './question-contract.ts';

export interface SubjectCapabilities {
  /** Fully presentable + answerable in the panel. */
  readonly interactions: readonly QuestionInteraction[];
  /** Rendered and recorded, resolved `ungraded` — never a fake verdict. */
  readonly fallback: readonly QuestionInteraction[];
}

const RAIL: readonly QuestionInteraction[] = [
  'multiple-choice', 'true-false', 'multi-select',
];
const TEXT: readonly QuestionInteraction[] = ['short-text', 'long-text'];
const COMPOSER: readonly QuestionInteraction[] = ['numeric', 'expression'];
const STRUCTURED: readonly QuestionInteraction[] = ['ordering', 'matching', 'diagram-label'];
const RICH: readonly QuestionInteraction[] = ['board-work', 'voice', 'tutor-conversation'];

export const SUBJECT_CAPABILITIES: Record<LearningSubject, SubjectCapabilities> = {
  math: { interactions: [...RAIL, ...COMPOSER, ...STRUCTURED], fallback: ['board-work', 'voice', 'long-text'] },
  science: { interactions: [...RAIL, ...TEXT, 'diagram-label'], fallback: [...RICH] },
  'english-language-arts': { interactions: [...RAIL, ...TEXT], fallback: [...RICH] },
  reading: { interactions: [...RAIL, ...TEXT], fallback: [...RICH] },
  writing: { interactions: [...RAIL, ...TEXT], fallback: [...RICH] },
  'social-studies': { interactions: [...RAIL, ...TEXT], fallback: [...RICH] },
  history: { interactions: [...RAIL, ...TEXT, 'ordering'], fallback: [...RICH] },
  geography: { interactions: [...RAIL, ...TEXT, 'diagram-label'], fallback: [...RICH] },
  'computer-science': { interactions: [...RAIL, ...TEXT, 'ordering'], fallback: [...RICH] },
  'world-language': { interactions: [...RAIL, 'short-text', 'voice'], fallback: [...RICH] },
  other: { interactions: [...RAIL, ...TEXT], fallback: [...RICH] },
};

/** Whether the panel presents this interaction for this subject — either
    fully or as an honest fallback. */
export function interactionSupported(
  subject: LearningSubject,
  interaction: QuestionInteraction,
): 'full' | 'fallback' | 'unsupported' {
  const caps = SUBJECT_CAPABILITIES[subject];
  if (caps.interactions.includes(interaction)) return 'full';
  if (caps.fallback.includes(interaction)) return 'fallback';
  return 'unsupported';
}
