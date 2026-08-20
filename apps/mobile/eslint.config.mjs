// https://docs.expo.dev/guides/using-eslint/
// ESM so it can import the shared guardrails; the browser-library ban now comes
// from @acme/config instead of a second inline copy that drifts from the first.
// SOT: docs/pack/11-architectural-guardrails.md §6 · packages/config/eslint/boundaries.mjs
// SOT-KEYWORDS: eslint mobile expo config native boundaries browser-libraries
import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
import { sharedRules } from '@acme/config/eslint/base.mjs';
import { FORBID_WEB_RENDERING_FROM_NATIVE } from '@acme/config/eslint/boundaries.mjs';

export default defineConfig([
  expoConfig,
  { ignores: ['dist/*'] },
  ...sharedRules(),
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', { patterns: FORBID_WEB_RENDERING_FROM_NATIVE }],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Browser globals are not available in the native app.' },
        { name: 'document', message: 'DOM APIs are not available in the native app.' },
      ],
    },
  },
]);
