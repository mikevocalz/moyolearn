import { baseConfig } from '@acme/config/eslint/base.mjs';
import { FORBID_WEB_RENDERING_FROM_NATIVE } from '@acme/config/eslint/boundaries.mjs';

export default [
  ...baseConfig(),
  {
    files: ['**/*.native.ts', '**/*.native.tsx', '**/*.shared.ts', '**/*.shared.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: FORBID_WEB_RENDERING_FROM_NATIVE },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'Use a *.web file for browser globals; shared/native code must run under Metro.',
        },
        {
          name: 'document',
          message: 'Use a *.web file for DOM APIs; shared/native code must run under Metro.',
        },
      ],
    },
  },
];
