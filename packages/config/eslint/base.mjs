// Shared flat config for workspace packages (TS/React libraries).
// Apps layer their platform preset (expo / next) and add boundaries themselves.
// SOT: docs/pack/11-architectural-guardrails.md §6
// SOT-KEYWORDS: eslint base config shared flat-config query-keys rule any raw-values
import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js'; // no exports map — extension required in ESM
import {
  boundaries,
  FORBID_DOMAIN_DEEP_IMPORTS,
  FORBID_PAYLOAD_OUTSIDE_REPOSITORIES,
  FORBID_REPOSITORY_IMPORT,
} from './boundaries.mjs';
import { moyoPlugin } from './moyo-rules.mjs';

// §4: query keys come from <domain>.keys.ts factories, never inline.
const NO_INLINE_QUERY_KEY = {
  selector: "Property[key.name='queryKey'] > ArrayExpression",
  message: 'Inline queryKey arrays are forbidden — use the domain key factory (<domain>.keys.ts).',
};

/**
 * Arbitrary Tailwind values for properties that HAVE tokens (doc 08 §2.1).
 * Deliberately narrow: layout escapes like `flex-[2]` and `basis-[45%]` have no
 * token to point at, so banning them would only teach people to disable the rule.
 * Font sizes join this list when the UI type ramp lands (doc 08 §3.1, PR-20).
 */
const NO_RAW_STYLE_VALUE = {
  selector:
    'JSXAttribute[name.name=/^(className|tw)$/] Literal[value=/(^|\\s)-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-\\[|(^|\\s)(bg|text|border|fill|stroke|shadow)-\\[#/]',
  message:
    'Raw spacing/color value. Tokens only — add it to packages/theme/tokens.ts if it is missing (doc 08 §2.1).',
};

/** Doc 11 §6 rules 1 & 6: the shape the generator emits, enforced after it is edited. */
const DOMAIN_LAYERING = [
  {
    files: ['**/*.repository.ts', '**/*.service.ts'],
    plugins: { moyo: moyoPlugin },
    rules: { 'moyo/server-only-first': 'error' },
  },
  {
    // Generator-emitted domain files; leaf components stay findable by filename.
    files: ['**/repository/*.ts', '**/services/*.ts', '**/permissions/*.ts', '**/queries/*.keys.ts'],
    plugins: { moyo: moyoPlugin },
    rules: { 'moyo/sot-header': 'error' },
  },
  {
    // The exemption IS the rule: repositories are the one place @acme/payload is allowed.
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/repository/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...FORBID_PAYLOAD_OUTSIDE_REPOSITORIES, ...FORBID_DOMAIN_DEEP_IMPORTS] },
      ],
    },
  },
  {
    // Everything except a domain's own service layer (and the repositories themselves,
    // which re-export within their folder) is kept out of the repository layer.
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/services/**', '**/repository/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...FORBID_PAYLOAD_OUTSIDE_REPOSITORIES,
            ...FORBID_DOMAIN_DEEP_IMPORTS,
            ...FORBID_REPOSITORY_IMPORT,
          ],
        },
      ],
    },
  },
];

/**
 * The rules that must hold everywhere, for the two apps that layer a platform
 * preset instead of baseConfig (apps/web on next, apps/mobile on expo). Without
 * this the `any` ban has an app-shaped hole in it.
 */
export const sharedRules = () => [
  { files: ['**/*.tsx'], rules: { 'no-restricted-syntax': ['error', NO_INLINE_QUERY_KEY, NO_RAW_STYLE_VALUE] } },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, minimumDescriptionLength: 10 },
      ],
    },
  },
  ...DOMAIN_LAYERING,
];

export function baseConfig(extraBoundaryPatterns = []) {
  return defineConfig([
    expoConfig,
    boundaries(extraBoundaryPatterns),
    {
      // Flat config REPLACES rule options rather than merging them, so every
      // no-restricted-syntax selector for a given file has to arrive in one array.
      files: ['**/*.ts'],
      ignores: ['**/*.keys.ts'],
      rules: { 'no-restricted-syntax': ['error', NO_INLINE_QUERY_KEY] },
    },
    {
      files: ['**/*.tsx'],
      rules: { 'no-restricted-syntax': ['error', NO_INLINE_QUERY_KEY, NO_RAW_STYLE_VALUE] },
    },
    {
      // Doc 10: types are derived, so an escape hatch is a design failure, not a shortcut.
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/ban-ts-comment': [
          'error',
          { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, minimumDescriptionLength: 10 },
        ],
      },
    },
    ...DOMAIN_LAYERING,
    { ignores: ['dist/**', '.types/**', 'node_modules/**', '*.config.js', '*.config.mjs'] },
  ]);
}
