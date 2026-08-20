/**
 * Dependency-direction rules, enforced as CI-failing lint.
 * Compose into a flat config: `boundaries()` for the workspace-wide baseline,
 * or `boundaries(FORBID_DOMAIN_FROM_UI)` etc. for stricter packages.
 */

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
