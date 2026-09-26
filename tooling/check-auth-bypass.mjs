#!/usr/bin/env node
// The session gate's bypass must be OPT-IN. An unset environment variable may
// never mean "let everything through".
//
// This exists because it already happened. `apps/web/proxy.ts` read
// `process.env.NEXT_PUBLIC_AUTH_MODE !== 'live'` and returned `next()` — so
// any build where the variable was missing served every protected route
// unauthenticated. `NEXT_PUBLIC_*` is inlined at BUILD time, and this project
// has zero Preview-scoped variables on Vercel, so every preview deployment was
// built with the gate disabled. Measured 2026-09-22 on a live preview:
// `/tutor` returned 200 instead of 307, and `/api/account/learners/delete`
// returned 405 rather than 401 — a wrong-method answer from the handler, which
// only happens after the gate has already let the request past. One promote
// away from production, on a product used by children.
//
// The rule is one line of policy and the reason it needs a checker is that the
// safe and unsafe forms differ by a single operator. A reviewer reads
// `!== 'live'` as "not live means mock" and moves on.
// SOT: apps/web/proxy.ts · packages/app/core/protected-operation.ts `isMockAuth`
// SOT-KEYWORDS: auth bypass proxy session gate fail closed preview env inline mock
import { readFileSync } from 'node:fs';

const PROXY = 'apps/web/proxy.ts';
const source = readFileSync(PROXY, 'utf8');
const failures = [];

// The inverted form, in any spacing. `!== 'live'` is the shape that makes an
// absent value permissive; there is no correct use of it as a gate condition.
if (/NEXT_PUBLIC_AUTH_MODE\s*!==/.test(source)) {
  failures.push(
    `${PROXY}: bypass is written as \`NEXT_PUBLIC_AUTH_MODE !== …\`, so an UNSET ` +
      'variable opens every protected route. Compare for the mock value instead.',
  );
}

// Explicit mock is necessary but not sufficient: a production build that
// somehow carried `mock` must still gate, which is why `isMockAuth()` pairs it
// with the build kind. The proxy has to make the same pair.
const bypass = /NEXT_PUBLIC_AUTH_MODE\s*===\s*'mock'/.test(source);
const devGuarded = /NODE_ENV\s*===\s*'development'/.test(source);

if (!bypass) {
  failures.push(
    `${PROXY}: no \`NEXT_PUBLIC_AUTH_MODE === 'mock'\` bypass found. If the gate no ` +
      'longer has one, delete this check rather than leaving it asserting nothing.',
  );
} else if (!devGuarded) {
  failures.push(
    `${PROXY}: the mock bypass is not paired with \`NODE_ENV === 'development'\`. ` +
      'On Vercel every build is NODE_ENV=production, previews included, so without ' +
      'that pairing a stray `mock` value disables the gate on a deployed host.',
  );
}

if (failures.length > 0) {
  for (const line of failures) console.error(`  FAIL ${line}`);
  process.exit(1);
}

console.log('auth-bypass OK — the session gate opens only for an explicit mock dev build');
