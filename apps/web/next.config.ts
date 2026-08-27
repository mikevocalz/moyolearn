import type { NextConfig } from 'next'
import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs'

// Turbopack (Next 16 default). webpack is unusable in this workspace — its
// FileSystemInfo snapshot walker dies with RangeError on the pnpm symlink
// forest. RN globals (__DEV__) come from a runtime shim imported in the root
// layout instead of DefinePlugin.
const nextConfig: NextConfig = {
  // Next 16.3 writes `AGENTS.md` and `CLAUDE.md` into apps/web on every `dev`
  // boot. This repo keeps one hand-written CLAUDE.md at the root, and generated
  // agent files landing next to it are both noise and a thing that gets
  // committed by accident.
  agentRules: false,
  // `sweep.sql` is read from disk at request time by the retention sweep and is
  // imported by nothing, so Next's tracer has no reason to know it exists and
  // the deployed function would 500 on a missing file. Named here rather than
  // inlined into the route because the .sql file is the source of truth for the
  // version-shadow half of the sweep (see apps/web/lib/retention.repository.ts).
  outputFileTracingIncludes: {
    '/api/retention/sweep': ['../../packages/payload/src/retention/sweep.sql'],
    '/api/retention/sweep/cron': ['../../packages/payload/src/retention/sweep.sql'],
  },
  // next/image rejects every remote host that is not listed here, so a
  // thumbnail from YouTube renders as a hard error rather than a broken image.
  // Only the thumbnail host, and only its /vi/ path: this is not a general
  // opening of remote images.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'img.youtube.com', pathname: '/vi/**' }],
  },
  // React Compiler — auto-memoization, same as the mobile app's
  // experiments.reactCompiler in app.config.ts.
  reactCompiler: true,
  experimental: {
    // Owns URLs that match no route at all. Without it Next serves its own
    // black default 404, because a per-group root layout leaves nothing for
    // `app/not-found.tsx` to render inside. Still flagged in 16.3.1
    // (config-shared.d.ts, default false); drop the flag once it stabilises.
    globalNotFound: true,

    // NOTE: `viewTransition` was removed in Next 16.3 stable — React's
    // <ViewTransition> now works in the App Router with no configuration
    // (node_modules/next/dist/docs/01-app/02-guides/view-transitions.md).
    // Native Rust port of the compiler inside Turbopack (faster than the
    // Babel transform); experimental — remove if it misbehaves.
    turbopackRustReactCompiler: true,

    // Barrel-file tree shaking. `lucide-react` is already in Next's built-in
    // list (node_modules/next/dist/server/config.js) and the user list is
    // merged with it, so only the workspace barrels are named here — both
    // re-export their whole surface from a single index.
    optimizePackageImports: [
      '@acme/ui',
      '@acme/app',
      '@tanstack/react-table',
      '@tanstack/react-form',
      '@tanstack/react-virtual',
    ],

    // Emit <style> instead of a render-blocking <link>, killing the CSS
    // request waterfall. The docs call out atomic CSS (Tailwind) as the case
    // where this pays off, which is exactly this app. Production-only — dev
    // still serves a stylesheet. TRADE-OFF: inlined CSS can't be cached
    // separately from the HTML, so returning visitors re-download it each
    // navigation; drop this if the audience is repeat-visit heavy.
    inlineCss: true,
  },

  // Dev DX: forwards browser console output into the terminal. Lived at
  // `experimental.browserDebugInfoInTerminal` until 16.3.1 moved it here.
  logging: {
    browserToTerminal: true,
  },
  cacheComponents: false,
  // DO NOT add `experimental.scrollRestoration` here. It still exists in the
  // 16.3 config schema (config-shared.d.ts) so it looks available, but its only
  // consumer is shared/lib/router/router.js — the PAGES router. This app is App
  // Router, where scroll restoration on back/forward is built in and cannot be
  // toggled. To stop a navigation scrolling to top, pass `scroll={false}` on the
  // link or `router.push(href, { scroll: false })` instead.
  transpilePackages: [
    '@acme/ui',
    '@acme/app',
    '@acme/payload',
    '@expo/html-elements',
    'expo-paste-input',
    'expo-drag-drop-content-view',
    '@legendapp/motion',
    '@expo/ui',
    'expo-image',
    'expo-modules-core',
    'expo',
    'react-native',
    'react-native-web',
    'react-native-enriched-html',
    'solito',
  ],
  async redirects() {
    return [
      { source: '/payload/admin/:path*', destination: '/admin/:path*', permanent: false },
    ];
  },

  turbopack: {
    resolveAlias: {
      'react-native': 'react-native-web',
    },
    resolveExtensions: [
      '.web.tsx', '.web.ts', '.web.js',
      '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json',
    ],
  },
}

/*
  Sentry's build wrapper, outermost so it sees the final config. Two jobs here:

  `tunnelRoute: '/monitoring'` — doc 35 §4.3: ad-blockers eat direct
  `ingest.sentry.io` requests, and an unreported crash is worse than a blocked
  one. The option is real on the installed SDK: `SentryBuildOptions.tunnelRoute?:
  string | boolean` (@sentry/nextjs 10.71.0,
  build/types/config/types.d.ts:533) — the wrapper adds a same-origin rewrite
  that proxies envelopes through this deployment, so no CSP/DNS third-party
  fetch is left for an extension to block.

  Source maps upload only when `SENTRY_AUTH_TOKEN` exists (CI), so a local
  `pnpm --filter web build` neither fails nor phones home. `SENTRY_ORG` and
  `SENTRY_PROJECT` come from env — never inlined.
*/
export default withSentryConfig(withPayload(nextConfig, { devBundleServerPackages: false }), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  tunnelRoute: '/monitoring',
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Build-time telemetry to Sentry about the plugin itself — off, same posture
  // as every other vendor phone-home in this repo.
  telemetry: false,
})
