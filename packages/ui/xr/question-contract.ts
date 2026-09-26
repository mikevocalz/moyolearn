/**
 * The XR question contract — what a `LearningQuestion` panel receives.
 *
 * REUSE: `evidence` is the `ProblemEvidence` pair capture already mints
 * (`problem-storage.shared.ts`); evaluation kinds map onto the repo's real
 * paths — `server-objective` = `/api/tutor/evaluate`, `coach-review` =
 * tutor turn, `teacher-review` = queued for a person, `ungraded` = no
 * correctness claimed. Nothing here invents a second grading route, and
 * no answer key ever crosses into this type: Rive shows, services decide.
 *
 * Locale is three independent axes per doc 16 — `uiLocale` (chrome copy),
 * `questionLocale` (the question's own language) and `sourceLocale` (the
 * homework the question came from, which is never overwritten by a
 * translation). `tutorLocale` is the safety-gated coach voice.
 *
 * SOT: spec §3 (moyo-xr-rive-dynamic-questions-prompt) · question-content.ts ·
 *      packages/app/features/capture/problem-storage.shared.ts
 * SOT-KEYWORDS: xr learning question contract subject interaction evidence evaluation locale
 */

import type { QuestionContentBlock, QuestionMediaSource } from './question-content.ts';

export type LearningSubject =
  | 'math'
  | 'science'
  | 'english-language-arts'
  | 'reading'
  | 'writing'
  | 'social-studies'
  | 'history'
  | 'geography'
  | 'computer-science'
  | 'world-language'
  | 'other';

/**
 * How the learner answers. The six-slot Rive choice rail is the bounded
 * presentation for `multiple-choice`/`multi-select`/`true-false`;
 * interactions that need a richer surface (board, voice, composer,
 * diagram labels) route to their own content-window renderer and declare
 * it through `interaction` — the resolver is what reads this, not Rive.
 */
export type QuestionInteraction =
  | 'multiple-choice'
  | 'multi-select'
  | 'short-text'
  | 'long-text'
  | 'numeric'
  | 'expression'
  | 'true-false'
  | 'ordering'
  | 'matching'
  | 'diagram-label'
  | 'board-work'
  | 'voice'
  | 'tutor-conversation';

export interface QuestionChoice {
  readonly id: string;
  readonly label: string;
  readonly media?: QuestionMediaSource;
}

/**
 * The evaluation route is data on the question, not a switch inside the
 * panel — an XR session can never turn a coach-review question into a
 * graded one by asking twice.
 */
export type QuestionEvaluation =
  | { readonly kind: 'server-objective' }
  | { readonly kind: 'coach-review' }
  | { readonly kind: 'teacher-review' }
  | { readonly kind: 'ungraded' };

export interface XrLearningQuestion {
  readonly id: string;
  readonly revision?: string;
  readonly subject: LearningSubject;
  /** Display label already localized by the caller — Rive never localizes. */
  readonly subjectLabel: string;
  readonly skillId?: string;
  readonly skillLabel?: string;
  readonly uiLocale: string;
  readonly questionLocale: string;
  readonly sourceLocale?: string;
  readonly tutorLocale?: string;
  readonly textDirection: 'ltr' | 'rtl' | 'auto';
  readonly prompt: string;
  readonly supportingText?: string;
  /** Composed content — see `QuestionContentBlock`. May be empty for a
      pure prompt+choices question. */
  readonly content: readonly QuestionContentBlock[];
  readonly interaction: QuestionInteraction;
  /** Bounded presentation: the Rive rail shows at most MAX_RIVE_CHOICES;
      a longer list resolves to a native content renderer instead. */
  readonly choices?: readonly QuestionChoice[];
  readonly media?: readonly QuestionMediaSource[];
  readonly progress?: { readonly index: number; readonly total?: number };
  readonly hint?: { readonly available: boolean; readonly text?: string };
  readonly evidence?: { readonly questionId: string; readonly revision: string };
  readonly source: 'practice' | 'homework' | 'assignment' | 'teacher' | 'tutor' | 'capture' | 'other';
  readonly evaluation: QuestionEvaluation;
}

/** The Rive choice rail is a fixed artboard — six slots is the contract. */
export const MAX_RIVE_CHOICES = 6 as const;

export type XrQuestionPhase =
  | 'loading-initial'
  | 'entering'
  | 'idle'
  | 'submitting'
  | 'feedback'
  | 'exiting'
  | 'loading-next'
  | 'error';

export type XrQuestionOutcome = 'correct' | 'incorrect' | 'ungraded';

export interface XrQuestionFeedback {
  readonly outcome: XrQuestionOutcome;
  readonly title: string;
  readonly body: string;
}

/**
 * The in-flight answer draft. Choice ids for the rail; text/numeric/
 * expression fields for the native composers; `diagram`/`ordering` carry
 * semantic ids — never coordinates, never a committed answer.
 */
export type XrAnswerDraft =
  | { readonly kind: 'none' }
  | { readonly kind: 'choices'; readonly selectedIds: readonly string[] }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'expression'; readonly expression: string }
  | { readonly kind: 'labels'; readonly placements: readonly { labelId: string; targetId: string }[] }
  | { readonly kind: 'ordering'; readonly order: readonly string[] }
  | { readonly kind: 'board'; readonly boardId: string }
  | { readonly kind: 'voice'; readonly transcript: string };
