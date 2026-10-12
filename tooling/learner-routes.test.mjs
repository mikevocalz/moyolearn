// Expo Router protects declared screen names, not every file in a route group.
// Verify every route owned by the learner layout is inside the learner-role guard.
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(new URL('../packages/app/package.json', import.meta.url));
const ts = require('typescript');
const directory = new URL('../apps/mobile/app/(learner)/', import.meta.url);

// Expo hoists descendants without a _layout into the nearest layout. A nested
// layout is one screen (including groups); its descendants are guarded with it.
async function ownedRoutes(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const routeName = (name) => name.replace(/(?:\.(?:android|ios|native|web))?\.[jt]sx?$/, '');
  if (prefix && entries.some((entry) => entry.isFile() && routeName(entry.name) === '_layout')) {
    return [prefix];
  }
  const routes = new Set();
  for (const entry of entries) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      for (const route of await ownedRoutes(new URL(`${entry.name}/`, directory), name)) routes.add(route);
    } else if (/\.[jt]sx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') &&
        !entry.name.startsWith('+') && routeName(entry.name) !== '_layout') {
      routes.add(routeName(name));
    }
  }
  return [...routes];
}

test('route scan includes JS/TS variants, hoisted routes and nested layouts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'moyo-learner-routes-'));
  try {
    for (const path of ['plain.ts', 'jsx.jsx', 'script.js', 'lab.web.tsx', 'lab.native.tsx',
      '_private.tsx', '_layout.tsx', '+not-found.tsx', 'types.d.ts',
      'nested/index.tsx', 'nested/page.ts', '(tabs)/_layout.tsx', '(tabs)/today.tsx',
      'another/_layout.tsx', 'another/index.tsx']) {
      const target = join(root, path);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, 'export default function Screen() {}');
    }
    assert.deepEqual((await ownedRoutes(pathToFileURL(`${root}/`))).sort(),
      ['(tabs)', '_private', 'another', 'jsx', 'lab', 'nested/index', 'nested/page', 'plain', 'script']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('all learner routes are declared inside Stack.Protected with the learner-role guard', async () => {
  const text = await readFile(new URL('_layout.tsx', directory), 'utf8');
  const source = ts.createSourceFile('_layout.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const protectedNames = new Set();
  const collectScreens = (node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'Stack.Screen') {
      for (const attribute of node.attributes.properties) {
        if (ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'name' && attribute.initializer && ts.isStringLiteral(attribute.initializer)) {
          protectedNames.add(attribute.initializer.text);
        }
      }
    }
    ts.forEachChild(node, collectScreens);
  };
  const visit = (node) => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'Stack.Protected') {
      const guarded = node.openingElement.attributes.properties.some((attribute) =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'guard' &&
        attribute.initializer && ts.isJsxExpression(attribute.initializer) &&
        attribute.initializer.expression?.getText(source) === 'isLearner');
      if (guarded) collectScreens(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const routes = await ownedRoutes(directory);
  assert.ok(routes.length > 0);
  for (const name of routes) {
    assert.ok(protectedNames.has(name), `${name} must be declared within the learner-role guard`);
  }
});
