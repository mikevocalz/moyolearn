// The gate between a generated item and a printed answer key.
//
// It reads the PRINTED prompt, never a side channel from the generator. For
// "What is <expression>?" it hands the prompt and the answer to
// `checkExactMath`, whose question wrapper strips the words. For
// "Solve for x: <lhs> = <rhs>" it substitutes the answer for x on both sides
// and asks the same checker whether the two sides are the same exact rational.
// A generator bug that printed one equation and computed another is therefore
// caught here, which is the reason the generator does not get to pass a
// verification pair of its own.
//
// What this cannot do, stated plainly so nobody reads a pass as more than it is:
//   - Anything outside finite exact rationals: percent, units, words, powers,
//     roots, inequalities, comparisons, simplification tasks, more than one
//     unknown. Those come back `uncheckable` and are dropped.
//   - Uniqueness. A root that satisfies the equation passes; the checker does
//     not prove it is the only root. The generator's linear templates have one
//     root by construction, but that is the generator's property, not this
//     file's.
//   - Fit. Nothing here knows whether an item suits the child, the band or the
//     misconception. It knows whether the key is right.
// SOT: docs/work/pr-100/contract.md §Practice sets · docs/decisions/adr-homework-exact-math.md
// SOT-KEYWORDS: practice checker exact math verify answer key substitute equation drop uncheckable coverage
import { checkExactMath, exactMathTool } from './exact-math.ts';
import type { GeneratedItem, PracticeSkillTag } from './practice-generator.ts';

/** Stamped on every kept item so a sheet records which checker vouched for it. */
export const PRACTICE_CHECKER_VERSION =
  `${exactMathTool.id}/${exactMathTool.version}@${exactMathTool.engineVersion}` as const;

/** Structurally `PracticeItem` from `@acme/app`; this package does not depend upward. */
export interface VerifiedPracticeItem {
  readonly id: string;
  readonly skillTag: PracticeSkillTag;
  readonly prompt: string;
  readonly answer: string;
  readonly checkerVersion: string;
}

export interface DroppedPracticeItem {
  readonly id: string;
  readonly skillTag: PracticeSkillTag;
  readonly reason: string;
}

export type PracticeCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const EQUATION = /^Solve for x:\s*(.+?)\s*=\s*(.+?)\s*$/;

/* `2x` -> `2*(A)`, `x/3` -> `(A)/3`. The coefficient pass runs first so the inserted answer never meets the bare-x pass. */
function substitute(side: string, answer: string): string {
  const wrapped = `(${answer})`;
  return side.replace(/(\d)\s*x/g, `$1*${wrapped}`).replace(/x/g, wrapped);
}

export function checkPracticeItem(prompt: string, answer: string): PracticeCheck {
  if (!answer.trim()) return { ok: false, reason: 'empty-answer' };
  const equation = EQUATION.exec(prompt);
  const result = equation
    ? checkExactMath(substitute(equation[1]!, answer), substitute(equation[2]!, answer))
    : checkExactMath(prompt, answer);
  if (result.status === 'equivalent') return { ok: true };
  return {
    ok: false,
    reason: 'reason' in result ? `${result.status}:${result.reason}` : result.status,
  };
}

/** Keeps what verifies, names what did not. Order is preserved so item numbers on a sheet stay stable. */
export function verifyPracticeItems(items: readonly GeneratedItem[]): {
  readonly kept: readonly VerifiedPracticeItem[];
  readonly dropped: readonly DroppedPracticeItem[];
} {
  const kept: VerifiedPracticeItem[] = [];
  const dropped: DroppedPracticeItem[] = [];
  for (const item of items) {
    const check = checkPracticeItem(item.prompt, item.answer);
    if (check.ok) kept.push({ ...item, checkerVersion: PRACTICE_CHECKER_VERSION });
    else dropped.push({ id: item.id, skillTag: item.skillTag, reason: check.reason });
  }
  return { kept, dropped };
}
