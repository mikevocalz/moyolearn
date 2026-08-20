/**
 * Dependency-direction rules, enforced as CI-failing lint.
 * Compose into a flat config: `boundaries()` for the workspace-wide baseline,
 * or `boundaries(FORBID_DOMAIN_FROM_UI)` etc. for stricter packages.
 */
// SOT: docs/pack/11-architectural-guardrails.md §6
// SOT-KEYWORDS: eslint boundaries dependency-direction restricted-imports lint layering

// Browser motion/rendering systems must not enter the native app or shared
// package code that Metro can resolve.
export const FORBID_WEB_RENDERING_FROM_NATIVE = [
  {
    group: [
      'gsap',
      'gsap/*',
      'framer-motion',
      'framer-motion/*',
      'lenis',
      'lenis/*',
      '@react-three/fiber',
      '@react-three/fiber/*',
      '@react-three/drei',
      '@react-three/drei/*',
    ],
    message:
      'Browser-only animation/rendering libraries stay in apps/web or *.web files; native uses Reanimated and Gesture Handler.',
  },
];

// Backend SDKs are only touched through @acme/payload,
// and only from repositories inside packages/app/<domain>.
export const FORBID_BACKEND_DIRECT = [
  {
    group: ['payload', '@payloadcms/*'],
    message:
      'Payload is accessed via @acme/payload (client) or the web app server code only.',
  },
];

// Package boundaries: consume the index, never internals.
export const FORBID_DEEP_IMPORTS = [
  {
    group: ['@acme/*/src/*'],
    message: 'Deep imports bypass the package public API — import from the package index.',
  },
];

// packages/ui is pure presentation: no domains, no backends, no navigation.
export const FORBID_DOMAIN_FROM_UI = [
  {
    group: ['@acme/app', '@acme/app/*', '@acme/payload*'],
    message: 'packages/ui depends only on @acme/theme.',
  },
];

// @acme/payload is the content client; only a domain's repository layer may hold it.
// Applied everywhere EXCEPT **/repository/** — the exemption is the whole rule.
export const FORBID_PAYLOAD_OUTSIDE_REPOSITORIES = [
  {
    group: ['@acme/payload', '@acme/payload/*'],
    message:
      'Only <domain>/repository/* touches @acme/payload (doc 11 §3). Go through the domain service ' +
      'so the operation passes through protectedOperation().',
  },
];

// A repository is reachable from its own domain service and nowhere else.
// Scope this with `files`/`ignores` (exempting **/services/** and **/repository/**),
// NOT with a `!` negation in the group: negation matches on the specifier as written,
// so `./repository/x` from a feature slips through while `../repository/x` from the
// service next door gets blocked — precisely backwards.
export const FORBID_REPOSITORY_IMPORT = [
  {
    group: ['**/repository/*', '**/*.repository'],
    message:
      'Repositories are called by their own domain service only (doc 11 §3). Import the ' +
      "domain's index.ts and use the service.",
  },
];

// Nothing reaches past a domain's index.ts.
export const FORBID_DOMAIN_DEEP_IMPORTS = [
  {
    group: ['@acme/app/*/services/*', '@acme/app/*/repository/*', '@acme/app/*/permissions/*'],
    message: "Import a domain's index.ts — a deep path bypasses its public API (doc 11 §3).",
  },
];

// Doc 09's mock session is a dev affordance: screens depend on the session
// interface, so swapping in the live provider stays a swap and not a rewrite.
export const FORBID_MOCK_SESSION = [
  {
    group: ['**/provider/session/mock', '**/provider/session/mock/*'],
    message:
      'Screens use useAppSession(); importing the mock provider directly welds the dev fixture ' +
      'into the screen and breaks the Mock-Session Contract (doc 09).',
  },
];

export function boundaries(extraPatterns = []) {
  return {
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...FORBID_BACKEND_DIRECT, ...FORBID_DEEP_IMPORTS, ...extraPatterns] },
      ],
    },
  };
}
