import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import { sharedRules } from '@acme/config/eslint/base.mjs'

const eslintConfig = defineConfig([
  ...nextVitals,
  // This app layers next's preset instead of baseConfig, so the workspace-wide
  // guardrails (doc 11 §6) have to be spread in explicitly or they stop at the app edge.
  ...sharedRules(),
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['components/site/Landing.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['gsap', 'gsap/*'],
              message: 'GSAP is scoped to components/site/Landing.tsx for the public landing experience.',
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])
 
export default eslintConfig
