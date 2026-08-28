// Safe arithmetic evaluator — client-safe pure helper used by the tutor surface.
// Strips non-math noise from a problem string, tokenizes, and evaluates with a
// shunting-yard parser. No `eval` or `new Function`.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/07-security-child-ai-safety-spec.md §2
// SOT-KEYWORDS: student model evaluate arithmetic shunting-yard parse safe

const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
};

/** A literal, sign included — the shunting-yard's operands after `tokenize`. */
const NUMBER = /^-?\d+(?:\.\d+)?$/;

/**
 * Splits the expression, resolving UNARY MINUS — which the binary
 * shunting-yard below cannot represent.
 *
 * `-3 + 5` used to tokenize to `- 3 + 5` and reach `evaluatePostfix` an
 * operand short. A `-` is unary exactly when nothing evaluable precedes it:
 * the start of the expression, an open paren, or another operator. Two shapes
 * resolve it and one deliberately does not:
 *
 *   · before a literal, the sign folds INTO the literal — `2 * -3` must stay
 *     `2 × (−3)`, so a synthesized zero (`2 * 0 - 3`) would bind wrong;
 *   · at the start or after `(`, where no operator can bind tighter, a zero IS
 *     the negation — `-(3+1)` becomes `0 - (3+1)`;
 *   · after an operator and before `(` — `2 * -(3+1)` — has neither, and is
 *     left to fail into the caller's `null`. A wrong number is worse than
 *     "cannot evaluate": it marks a child's correct answer incorrect.
 */
function tokenize(expr: string): string[] {
  const raw = expr.match(/\d+(?:\.\d+)?|[+\-*/()]/g) ?? [];
  const tokens: string[] = [];

  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i]!;
    if (token !== '-') {
      tokens.push(token);
      continue;
    }

    const previous = tokens[tokens.length - 1];
    const opens = previous === undefined || previous === '(';
    if (!opens && PRECEDENCE[previous] === undefined) {
      tokens.push(token);
      continue;
    }

    const next = raw[i + 1];
    if (next !== undefined && NUMBER.test(next)) {
      tokens.push(`-${next}`);
      i += 1;
    } else if (opens) {
      tokens.push('0', '-');
    } else {
      tokens.push(token);
    }
  }

  return tokens;
}

function toPostfix(tokens: string[]): string[] {
  const output: string[] = [];
  const ops: string[] = [];

  for (const token of tokens) {
    if (NUMBER.test(token)) {
      output.push(token);
      continue;
    }

    if (token === '(') {
      ops.push(token);
      continue;
    }

    if (token === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') {
        output.push(ops.pop()!);
      }
      ops.pop(); // discard '('
      continue;
    }

    const tokenPrec = PRECEDENCE[token];
    if (tokenPrec == null) continue; // unknown token, skip

    let top: string | undefined = ops[ops.length - 1];
    while (
      top !== undefined &&
      top !== '(' &&
      (PRECEDENCE[top] ?? 0) >= tokenPrec
    ) {
      output.push(ops.pop()!);
      top = ops[ops.length - 1];
    }
    ops.push(token);
  }

  while (ops.length) {
    const op = ops.pop()!;
    if (op === '(' || op === ')') throw new Error('Mismatched parentheses');
    output.push(op);
  }

  return output;
}

function evaluatePostfix(tokens: string[]): number {
  const stack: number[] = [];

  for (const token of tokens) {
    if (NUMBER.test(token)) {
      stack.push(Number(token));
      continue;
    }

    /*
      UNDERFLOW IS "CANNOT EVALUATE", NOT "WRONG". A leading unary minus —
      `-3 + 5`, the shape half of arithmetic homework arrives in — produces one
      operand too few, and popping an empty stack used to yield `undefined`,
      then `NaN`, then a `stack.length === 1` that slipped past the malformed
      guard below. `evaluateArithmetic` only null-checks the ANSWER, so
      `Math.abs(NaN - 2) < 1e-9` came back `false`: a child who answered
      correctly was marked wrong and their mastery estimate moved DOWN for it.
      Throwing is what routes this to the `null` the caller's contract has.
    */
    if (stack.length < 2) throw new Error('Operand underflow');
    const b = stack.pop()!;
    const a = stack.pop()!;
    switch (token) {
      case '+':
        stack.push(a + b);
        break;
      case '-':
        stack.push(a - b);
        break;
      case '*':
        stack.push(a * b);
        break;
      case '/':
        if (b === 0) throw new Error('Division by zero');
        stack.push(a / b);
        break;
      default:
        throw new Error(`Unknown operator: ${token}`);
    }
  }

  if (stack.length !== 1) throw new Error('Malformed expression');
  return stack[0]!;
}

function evaluateExpression(expr: string): number {
  const tokens = tokenize(expr);
  if (tokens.length === 0) throw new Error('No tokens');
  const postfix = toPostfix(tokens);
  return evaluatePostfix(postfix);
}

/** Returns true/false if the answer can be evaluated; null when it cannot. */
export function evaluateArithmetic(problem: string, answer: string): boolean | null {
  const expr = problem.replace(/[^0-9+\-*/().\s]/g, '').replace(/\s+/g, ' ').trim();
  if (!expr || /^[*/^]/.test(expr)) return null;

  let value: number;
  try {
    value = evaluateExpression(expr);
  } catch {
    return null;
  }

  const answerNum = Number(answer);
  if (Number.isNaN(answerNum)) return null;
  // A non-finite VALUE is the same "cannot evaluate" as a non-numeric answer.
  // Comparing against it silently answers `false`, which is a verdict.
  if (!Number.isFinite(value)) return null;

  return Math.abs(value - answerNum) < 1e-9;
}
