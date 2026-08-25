// The spaced-repetition queue. Doc 19 §1: "retention is a first-class outcome,
// not an accident."
//
// A fixed expanding ladder rather than SM-2's per-item ease factor, and that is
// a deliberate reduction: SM-2 tunes ease from a self-reported 0–5 recall grade,
// which is an adult metacognition task. An eight-year-old rating how well she
// remembered fractions is noise, and doc 19 §1 already says engagement signals
// come from behaviour. So the ladder advances on a correct attempt, and a wrong
// attempt drops one rung instead of resetting to day one — a single miss on a
// skill held for months is a bad day, not amnesia, and resetting it is how a
// review queue turns into a punishment schedule.
//
// The path shows review as the next stop, never as a "go back" (doc 09 §4), so
// nothing here produces an overdue count or a streak-loss signal.
// SOT: docs/pack/19-learning-outcomes-spec.md §1 · docs/pack/09-screens-first-build-order.md §4
// SOT-KEYWORDS: review spaced repetition queue interval schedule retention due

/** Days between reviews, in order. Roughly the standard expanding ladder. */
export const REVIEW_LADDER = [1, 3, 7, 16, 35, 90] as const;

export interface ReviewState {
  intervalDays: number;
  dueAt: string;
}

const rungOf = (intervalDays: number): number => {
  const exact = REVIEW_LADDER.indexOf(intervalDays as (typeof REVIEW_LADDER)[number]);
  if (exact !== -1) return exact;
  // An interval from an older ladder still has to land somewhere sane.
  const next = REVIEW_LADDER.findIndex((d) => d >= intervalDays);
  return next === -1 ? REVIEW_LADDER.length - 1 : next;
};

export function scheduleReview(
  previous: ReviewState | null,
  correct: boolean,
  now: Date,
): ReviewState {
  const rung = previous === null ? -1 : rungOf(previous.intervalDays);
  const nextRung = correct
    ? Math.min(rung + 1, REVIEW_LADDER.length - 1)
    : Math.max(rung - 1, 0);
  const intervalDays = REVIEW_LADDER[nextRung] ?? REVIEW_LADDER[0];
  return {
    intervalDays,
    dueAt: new Date(now.getTime() + intervalDays * 86_400_000).toISOString(),
  };
}

export const isDue = (state: ReviewState, now: Date): boolean =>
  Date.parse(state.dueAt) <= now.getTime();
