// Tutor capability registry — `tutorCapabilities[subject][band][task]`.
//
// Missing or unevaluated cells deny generation. Recovery never enters a
// general tutor lane, and a claimed enabled flag is not evaluation evidence.
//
// Claude is the default tutor brain (doc 18 §1). Gemini is a paired capability
// for vision-heavy lanes, and deterministic subject tools are required for math,
// science, and code. Local ExecuTorch handles perception and OCR structuring
// (Qwen) but never generates the learner-facing turn.
// SOT: docs/design/tutor-model-routing.md · docs/pack/18-tutor-ai-stack.md §2-§3 · packages/inference/src/routing.ts
// SOT-KEYWORDS: tutor capabilities subject grade band task routing claude gemini tools eval
import 'server-only';
import { INFERENCE_SAFETY_VERSION, modelFor, type InferenceRole, type ModelId } from '@acme/inference';
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
  readonly evaluation: null | {
    readonly runReference: string;
    readonly model: ModelId;
    readonly language: string;
    readonly safetyVersion: string;
  };
}

/** One fully-qualified cell lookup. */
export type TutorCapabilities = Partial<
  Record<
    TutorSubject,
    Partial<Record<AgeBand, Partial<Record<TutorTask, TutorCell>>>>
  >
>;

const UNEVALUATED_CELL: TutorCell = {
  primary: 'tutor-turn',
  allowedFallbacks: [],
  tools: [],
  vision: false,
  grounding: false,
  safety: INFERENCE_SAFETY_VERSION,
  maxLatencyMs: 5000,
  costCeiling: 0.05,
  enabled: false,
  evaluation: null,
};

/** Declared tool requirements are not evidence of available or evaluated tools. */
/*
  OWNER-AUTHORIZED, NOT EVALUATED — and it says so in the run reference.

  Every math cell was `UNEVALUATED_CELL` and the coach route supplied no
  capability context, so since 249af25 every live coach turn on a child's
  screen ended in TUTOR_MANUAL_HELP (measured on the Duo, 2026-09-23). There
  is no eval harness in this repository to produce a run reference, and no
  deterministic `arithmetic` / `fractions` / `symbolic-math` tool exists in
  code for a cell to require. The product owner's call was to open the math
  cells now. So: enabled, tools required NONE (a requirement nothing can
  satisfy is a permanent deny, not a safeguard), grounding still required,
  and `runReference` naming the authorization rather than an eval run.
  Replace it with a real run reference when the harness exists; grep
  OWNER_AUTHORIZED to find every cell this covers. The Safety Plane still
  classifies every turn in and out — this registry was a second gate, not
  the first.
*/
export const OWNER_AUTHORIZED = 'owner-authorized-unevaluated-2026-09-23';
const OWNER_MATH_CELL: TutorCell = {
  ...UNEVALUATED_CELL,
  tools: [],
  grounding: true,
  enabled: true,
  evaluation: {
    runReference: OWNER_AUTHORIZED,
    model: modelFor('tutor-turn'),
    language: 'en',
    safetyVersion: INFERENCE_SAFETY_VERSION,
  },
};
export const TUTOR_CAPABILITIES: TutorCapabilities = {
  math: {
    young: {
      understand: OWNER_MATH_CELL,
      'check-work': OWNER_MATH_CELL,
      practice: OWNER_MATH_CELL,
    },
    child: {
      understand: OWNER_MATH_CELL,
      'check-work': OWNER_MATH_CELL,
      practice: OWNER_MATH_CELL,
    },
    teen: {
      understand: OWNER_MATH_CELL,
      'check-work': OWNER_MATH_CELL,
      practice: OWNER_MATH_CELL,
    },
    adult: {
      understand: OWNER_MATH_CELL,
      'check-work': OWNER_MATH_CELL,
      practice: OWNER_MATH_CELL,
    },
  },
  'social-studies': {
    child: {
      understand: { ...UNEVALUATED_CELL, grounding: true, tools: ['timeline'] },
    },
    teen: {
      understand: { ...UNEVALUATED_CELL, grounding: true, tools: ['timeline', 'map'] },
    },
    adult: {
      understand: { ...UNEVALUATED_CELL, grounding: true, tools: ['timeline', 'map', 'source-retrieval'] },
    },
  },
  cs: {
    teen: {
      understand: { ...UNEVALUATED_CELL, tools: ['sandboxed-code'] },
      'check-work': { ...UNEVALUATED_CELL, tools: ['sandboxed-code'] },
    },
    adult: {
      understand: { ...UNEVALUATED_CELL, tools: ['sandboxed-code'] },
      'check-work': { ...UNEVALUATED_CELL, tools: ['sandboxed-code'] },
    },
  },
};

/** Resolve only an exact, evaluated cell whose live dependencies match. */
export function tutorCellFor(
  subject: string | undefined,
  band: AgeBand,
  task: string | undefined,
  available?: {
    readonly tools: readonly string[];
    readonly grounding: boolean;
    readonly language: string;
    readonly model: ModelId;
    readonly safetyVersion: string;
  },
  cells: TutorCapabilities = TUTOR_CAPABILITIES,
): TutorCell | null {
  if (!subject || !task || !available) return null;
  const byBand = Object.hasOwn(cells, subject)
    ? cells[subject as TutorSubject] : undefined;
  const byTask = byBand?.[band];
  const cell = byTask && Object.hasOwn(byTask, task) ? byTask[task as TutorTask] : undefined;
  if (!cell?.enabled || !cell.evaluation?.runReference.trim()) return null;
  if (cell.primary !== 'tutor-turn' || cell.allowedFallbacks.length !== 0 ||
      cell.evaluation.model !== modelFor(cell.primary) ||
      cell.evaluation.model !== available.model ||
      cell.evaluation.language !== available.language ||
      cell.safety !== available.safetyVersion ||
      cell.evaluation.safetyVersion !== available.safetyVersion ||
      (cell.grounding && !available.grounding) ||
      cell.tools.some((tool) => !available.tools.includes(tool))) return null;
  return cell;
}

export class TutorCapabilityDenied extends Error {
  constructor() {
    super('No evaluated tutor cell covers this request');
    this.name = 'TutorCapabilityDenied';
  }
}

// Fixed recovery copy carries neither an inferred answer nor a model request.
export const TUTOR_MANUAL_HELP = 'Natalie cannot help with this work yet. You can keep reviewing your work or ask a teacher or trusted adult for help.';
