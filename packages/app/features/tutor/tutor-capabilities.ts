// Tutor capability registry — `tutorCapabilities[subject][band][task]`.
//
// A cell ships only when it passes the eval harness for that subject, grade
// band, and task. Until then `enabled` is false and the caller falls back to the
// general-tutoring lane. This keeps routing a reviewed, type-enforced table
// instead of scattered conditionals.
//
// Claude is the default tutor brain (doc 18 §1). Gemini is a paired capability
// for vision-heavy lanes, and deterministic subject tools are required for math,
// science, and code. Local ExecuTorch handles perception and OCR structuring
// (Qwen) but never generates the learner-facing turn.
// SOT: docs/design/tutor-model-routing.md · docs/pack/18-tutor-ai-stack.md §2-§3 · packages/inference/src/routing.ts
// SOT-KEYWORDS: tutor capabilities subject grade band task routing claude gemini tools eval
import 'server-only';
import type { InferenceRole } from '@acme/inference';
import type { AgeBand } from '../capture/age-band.ts';

/** The subjects Moyo tutors on. */
export type TutorSubject =
  | 'math'
  | 'ela'
  | 'science'
  | 'social-studies'
  | 'cs'
  | 'world-language'
  | 'art'
  | 'music'
  | 'health'
  | 'financial-literacy'
  | 'study-skills';

/** Why the learner asked for help this turn. */
export type TutorTask =
  | 'understand'
  | 'check-work'
  | 'practice'
  | 'prepare-quiz'
  | 'review-notes'
  | 'continue-plan'
  | 'explore';

export interface TutorCell {
  /** The primary model lane for this cell. */
  readonly primary: InferenceRole;
  /** Fallback lanes that passed the same cell's evals. */
  readonly allowedFallbacks: readonly InferenceRole[];
  /** Required deterministic tools for this cell. */
  readonly tools: readonly string[];
  /** Whether the lane expects multimodal input (a confirmed crop). */
  readonly vision: boolean;
  /** Whether the lane requires curriculum RAG. */
  readonly grounding: boolean;
  /** The active safety policy for this cell. */
  readonly safety: string;
  /** p95 latency ceiling in milliseconds. */
  readonly maxLatencyMs: number;
  /** Per-turn dollar ceiling. */
  readonly costCeiling: number;
  /** False until the eval harness passes this exact cell. */
  readonly enabled: boolean;
}

/** One fully-qualified cell lookup. */
export type TutorCapabilities = Partial<
  Record<
    TutorSubject,
    Partial<Record<AgeBand, Partial<Record<TutorTask, TutorCell>>>>
  >
>;

const DEFAULT_CELL: TutorCell = {
  primary: 'tutor-turn',
  allowedFallbacks: [],
  tools: [],
  vision: false,
  grounding: false,
  safety: 'default',
  maxLatencyMs: 5000,
  costCeiling: 0.05,
  enabled: true,
};

/**
 * The seed routing table. Every `enabled: true` cell is a commitment that the
 * eval harness already passed; `enabled: false` cells fall back to
 * `DEFAULT_CELL` at runtime.
 */
export const TUTOR_CAPABILITIES: TutorCapabilities = {
  math: {
    young: {
      understand: { ...DEFAULT_CELL, tools: ['arithmetic'], grounding: true },
      'check-work': { ...DEFAULT_CELL, tools: ['arithmetic'], grounding: true },
      practice: { ...DEFAULT_CELL, tools: ['arithmetic'], grounding: true },
    },
    child: {
      understand: { ...DEFAULT_CELL, tools: ['arithmetic', 'fractions'], grounding: true },
      'check-work': { ...DEFAULT_CELL, tools: ['arithmetic', 'fractions'], grounding: true },
      practice: { ...DEFAULT_CELL, tools: ['arithmetic', 'fractions'], grounding: true },
    },
    teen: {
      understand: { ...DEFAULT_CELL, tools: ['symbolic-math'], grounding: true },
      'check-work': { ...DEFAULT_CELL, tools: ['symbolic-math'], grounding: true },
      practice: { ...DEFAULT_CELL, tools: ['symbolic-math'], grounding: true },
    },
    adult: {
      understand: { ...DEFAULT_CELL, tools: ['symbolic-math', 'graphing'], grounding: true },
      'check-work': { ...DEFAULT_CELL, tools: ['symbolic-math', 'graphing'], grounding: true },
      practice: { ...DEFAULT_CELL, tools: ['symbolic-math', 'graphing'], grounding: true },
    },
  },
  'social-studies': {
    child: {
      understand: { ...DEFAULT_CELL, grounding: true, tools: ['timeline'] },
    },
    teen: {
      understand: { ...DEFAULT_CELL, grounding: true, tools: ['timeline', 'map'] },
    },
    adult: {
      understand: { ...DEFAULT_CELL, grounding: true, tools: ['timeline', 'map', 'source-retrieval'] },
    },
  },
  cs: {
    teen: {
      understand: { ...DEFAULT_CELL, tools: ['sandboxed-code'] },
      'check-work': { ...DEFAULT_CELL, tools: ['sandboxed-code'] },
    },
    adult: {
      understand: { ...DEFAULT_CELL, tools: ['sandboxed-code'] },
      'check-work': { ...DEFAULT_CELL, tools: ['sandboxed-code'] },
    },
  },
};

/**
 * Resolve a cell, with an explicit fallback to the general-tutoring default.
 *
 * Unknown or unevaluated cells return `DEFAULT_CELL` so tutoring never crashes
 * for an unrecognised subject. `enabled: false` on an explicit cell is a
 * deliberate no-ship, not a code path.
 */
export function tutorCellFor(
  subject: string | undefined,
  band: AgeBand,
  task: string | undefined,
): TutorCell {
  if (!subject || !task) return DEFAULT_CELL;
  const byBand = TUTOR_CAPABILITIES[subject as TutorSubject];
  const byTask = byBand?.[band];
  const cell = byTask?.[task as TutorTask];
  return cell && cell.enabled ? cell : DEFAULT_CELL;
}
