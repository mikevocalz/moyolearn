import { baseConfig } from '@acme/config/eslint/base.mjs';

// This package owns the Payload server integration, so Payload SDK imports
// are expected here while remaining restricted elsewhere in the workspace.
export default [
  ...baseConfig(),
  { rules: { 'no-restricted-imports': 'off' } },
  {
    // Authenticated Payload REST runs in TanStack SSR, not React's RSC layer.
    // Keep the first-import gate using the compiler's native server marker;
    // admin-vite explicitly rejects marketing server imports in client graphs.
    files: [
      'src/marketing/marketing.repository.ts',
      'src/marketing/marketing.service.ts',
    ],
    rules: { 'moyo/server-only-first': ['error', { runtime: 'tanstack' }] },
  },
];
