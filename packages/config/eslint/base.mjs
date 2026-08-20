// Shared flat config for workspace packages (TS/React libraries).
// Apps layer their platform preset (expo / next) and add boundaries themselves.
// SOT: docs/pack/11-architectural-guardrails.md §6
// SOT-KEYWORDS: eslint base config shared flat-config query-keys rule
import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js'; // no exports map — extension required in ESM
import { boundaries } from './boundaries.mjs';

export function baseConfig(extraBoundaryPatterns = []) {
  return defineConfig([
    expoConfig,
    boundaries(extraBoundaryPatterns),
    {
      // §4: query keys come from <domain>.keys.ts factories, never inline
      files: ['**/*.ts', '**/*.tsx'],
      ignores: ['**/*.keys.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "Property[key.name='queryKey'] > ArrayExpression",
            message: 'Inline queryKey arrays are forbidden — use the domain key factory (<domain>.keys.ts).',
          },
        ],
      },
    },
    { ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.mjs'] },
  ]);
}
