/**
 * Local ESLint rules — the two guardrails no stock rule expresses.
 * Doc 11 §6's whole point: a rule that is a review comment gets forgotten by
 * session 40; a rule that is a build error cannot be. Scope these with `files:`
 * globs in the consuming config, not with filename checks inside the rule.
 * SOT: docs/pack/11-architectural-guardrails.md §6
 * SOT-KEYWORDS: eslint local rules server-only sot-header enforcement plugin lint
 * ponytail: an inline flat-config plugin object — a published plugin package
 * would be three files and a build step to say the same twenty lines.
 */

/** `import 'server-only'` must be the first statement — not merely present. */
const serverOnlyFirst = {
  meta: {
    type: 'problem',
    docs: { description: "require `import 'server-only'` as the first statement" },
    schema: [],
    messages: {
      missing:
        "Repositories and services must open with `import 'server-only'`. On native the leak " +
        'this catches is Payload credentials and inference keys ending up readable in an app binary.',
      notFirst:
        "`import 'server-only'` must be the FIRST statement — anything above it is evaluated " +
        'before the guard, which is exactly the code you need guarded.',
    },
  },
  create(context) {
    return {
      Program(node) {
        const isServerOnly = (s) =>
          s.type === 'ImportDeclaration' && s.specifiers.length === 0 && s.source.value === 'server-only';
        const at = node.body.findIndex(isServerOnly);
        if (at === -1) context.report({ node, messageId: 'missing' });
        else if (at !== 0) context.report({ node: node.body[at], messageId: 'notFirst' });
      },
    };
  },
};

/**
 * Every file the generator emits carries a header block ending in SOT-KEYWORDS.
 * Without it `grep -rl "SOT-KEYWORDS:.*<term>"` misses the file, the next session
 * never finds it, and builds a duplicate instead — the slop this whole method targets.
 */
const sotHeader = {
  meta: {
    type: 'suggestion',
    docs: { description: 'require an SOT-KEYWORDS header block' },
    schema: [],
    messages: {
      missing:
        'Missing `// SOT-KEYWORDS:` header. Grep-first is how the next session finds this file; ' +
        'without keywords it is invisible to search and gets rebuilt as a duplicate.',
    },
  },
  create(context) {
    return {
      Program(node) {
        const source = context.sourceCode ?? context.getSourceCode();
        // Header = the comments before the first statement (or the whole file if it has none).
        const header = node.body.length ? source.getCommentsBefore(node.body[0]) : source.getAllComments();
        const all = header.length ? header : source.getAllComments();
        if (!all.some((c) => c.value.includes('SOT-KEYWORDS:'))) {
          context.report({ node, messageId: 'missing' });
        }
      },
    };
  },
};

export const moyoPlugin = {
  rules: {
    'server-only-first': serverOnlyFirst,
    'sot-header': sotHeader,
  },
};
