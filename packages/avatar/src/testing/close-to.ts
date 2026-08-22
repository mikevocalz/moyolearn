/**
 * `assert.strictEqual` is wrong for float comparisons and `assert.ok(a - b <
 * eps)` loses the numbers on failure. This restores the one assertion
 * `node:assert` is missing, with a message that prints both sides.
 *
 * Deliberately the only test helper in the package: the repo's runner is
 * `node --test` with `node:assert/strict` (matching `@acme/ui`), and adding a
 * second assertion library would be inventing a second way to do something
 * that already has a way.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §8
 * SOT-KEYWORDS: test assert close-to float tolerance helper node-test
 */
import assert from 'node:assert/strict';

/** Asserts |actual - expected| < 10^-digits / 2, matching Jest's semantics. */
export function closeTo(
  actual: number,
  expected: number,
  digits = 2,
  message?: string
): void {
  const tolerance = Math.pow(10, -digits) / 2;
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    message ??
      `expected ${actual} to be within ${tolerance} of ${expected} (${digits} digits)`
  );
}
