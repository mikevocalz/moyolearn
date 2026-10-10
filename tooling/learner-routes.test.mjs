// Expo Router protects declared screen names, not every file in a route group.
// Verify every direct learner route is declared inside the learner-role guard.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(new URL('../packages/app/package.json', import.meta.url));
const ts = require('typescript');
const directory = new URL('../apps/mobile/app/(learner)/', import.meta.url);

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
  const files = await readdir(directory, { withFileTypes: true });
  const routes = files.filter((entry) => entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.startsWith('_') && !entry.name.startsWith('+'));
  assert.ok(routes.length > 0);
  for (const route of routes) {
    const name = route.name.slice(0, -4);
    assert.ok(protectedNames.has(name), `${name} must be declared within the learner-role guard`);
  }
});
