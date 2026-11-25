// The persona switch is QA tooling and must have no door in a release build.
// Three facts hold that: no route file carries it, the root layout registers
// no screen for it, and every module that reaches the mock session or the
// fixture personas does so through a `require` inside a literal `__DEV__`
// branch rather than a static import. A static import is a release-bundle
// import; `tooling/check-barrels.mjs` already refuses an unreachable module,
// so this is the other half: reachable, but only from a dev build.
// SOT: docs/pack/09-screens-first-build-order.md §2 · packages/app/providers/session/auth-mode.ts
// SOT-KEYWORDS: dev hatch persona switch release route guard mock session require __DEV__ test
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('there is no /onboarding/dev route file in the mobile app', async () => {
  const entries = await readdir(new URL('apps/mobile/app/onboarding/', root));
  assert.ok(
    !entries.some((name) => /^dev(\.(android|ios|native|web))?\.[jt]sx?$/.test(name)),
    `apps/mobile/app/onboarding/ still has a dev route: ${entries.join(', ')}`,
  );
});

test('the root layout registers no screen or title for the dev hatch', async () => {
  const layout = await read('apps/mobile/app/_layout.tsx');
  assert.doesNotMatch(layout, /name=["']onboarding\/dev["']/);
  assert.doesNotMatch(layout, /["']\/onboarding\/dev["']\s*:/);
});

test('the persona switch is not exported from the @acme/app barrel', async () => {
  const barrel = await read('packages/app/index.ts');
  assert.doesNotMatch(barrel, /export\s*\{[^}]*\bDevPersonaSwitch\b[^}]*\}\s*from/);
});

/**
 * Files allowed to reach the dev-only modules, and the one way they may do it.
 * A static `import ... from` of any of these specifiers is a failure.
 */
const DEV_ONLY = [
  { file: 'packages/app/providers/session/session.tsx', specifier: './mock' },
  { file: 'packages/app/providers/entitlements/entitlements-sync.tsx', specifier: '../../fixtures/personas' },
  { file: 'packages/app/providers/entitlements/entitlements-sync.tsx', specifier: '../../fixtures/subscriptions' },
  { file: 'packages/app/providers/session/role-switcher.tsx', specifier: '../../fixtures/personas' },
  { file: 'packages/app/features/onboarding/public-entry-content.tsx', specifier: './dev-persona-switch' },
];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const { file, specifier } of DEV_ONLY) {
  test(`${file} reaches ${specifier} only through require() behind a literal __DEV__ test`, async () => {
    const source = await read(file);
    const spec = escape(specifier);
    // `import type` is erased by the compiler and carries nothing into a bundle.
    // One statement: `[^;]` keeps the match from spanning an earlier import's
    // `from` clause into this specifier.
    const staticImport = new RegExp(`(?:^|\\n)\\s*import\\s+(?!type\\b)[^;]*?from\\s+['"]${spec}['"]`);
    assert.doesNotMatch(source, staticImport, `${file} imports ${specifier} statically`);
    const required = new RegExp(`require\\(\\s*['"]${spec}['"]\\s*\\)`);
    assert.match(source, required, `${file} does not require ${specifier}`);
    assert.match(
      source,
      /typeof __DEV__ !== 'undefined' \? __DEV__ : process\.env\.NODE_ENV === 'development'/,
      `${file} has no literal __DEV__ test for the bundler to fold`,
    );
  });
}

test('the mock session provider is reached from nowhere else', async () => {
  const files = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) await walk(url);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(url);
    }
  };
  await walk(new URL('packages/app/', root));
  await walk(new URL('apps/mobile/app/', root));
  const offenders = [];
  for (const url of files) {
    const source = await readFile(url, 'utf8');
    if (/from\s+['"][^'"]*\/session\/mock['"]/.test(source) || /from\s+['"]\.\/mock['"]/.test(source)) {
      offenders.push(url.pathname.replace(root.pathname, ''));
    }
  }
  assert.deepEqual(offenders, []);
});
