// Safe arithmetic evaluator for the S9 tutor surface.
// Strips non-math noise from the problem string, tokenizes, and evaluates
// with a shunting-yard parser — no `eval` or `new Function` ever.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/07-security-child-ai-safety-spec.md §2
// SOT-KEYWORDS: tutor evaluate arithmetic shunting-yard parse safe answer

const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
};

function tokenize(expr: string): string[] {
  const matches = expr.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
  return matches ?? [];
}

function toPostfix(tokens: string[]): string[] {
  const output: string[] = [];
  const ops: string[] = [];

  for (const token of tokens) {
    if (/^\d+(?:\.\d+)?$/.test(token)) {
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
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      stack.push(Number(token));
      continue;
    }

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

  return Math.abs(value - answerNum) < 1e-9;
}
