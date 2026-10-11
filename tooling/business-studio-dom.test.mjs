// Executes the real semantic View, GH3 handlers and Reanimated web runtime.
// jsdom has no layout or pointer capture: deterministic shims below model those
// boundaries. This is not a browser, authenticated owner-flow or device test.
// SOT: docs/business/semantic-gestures.md
// SOT-KEYWORDS: business studio semantic reorder DOM ref gesture regression
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const moduleRoot = (name) => resolve(require.resolve(`${name}/package.json`), '..');
const file = (path) => JSON.stringify(resolve(root, path));
const entry = `
  import React, { useCallback, useEffect, useRef } from 'react';
  import { createRoot } from 'react-dom/client';
  import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
  import { EmailReorderGroup, EmailBlockFrame } from ${file('packages/ui/email-reorder.web.tsx')};
  import { View, Pressable } from ${file('packages/ui/tw.tsx')};
  import { Text } from ${file('packages/ui/Text.tsx')};
  import { useInstanceStore, useStore } from ${file('packages/ui/use-instance-store.ts')};
  import { reorderEmailItems } from ${file('packages/ui/email-reorder.ts')};
  const AnimatedView = Animated.createAnimatedComponent(View);
  function RefProbe() {
    const ref = useRef(null);
    const offset = useSharedValue(0);
    const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }), [offset]);
    useEffect(() => { window.refProbe = { ref, move: (value) => offset.set(value) }; }, [offset]);
    return <AnimatedView ref={ref} nativeID="ref-probe" style={style}><Text>Ref probe</Text></AnimatedView>;
  }
  function ReorderProbe() {
    const store = useInstanceStore(() => ({ ids: ['alpha', 'beta', 'gamma'], moves: [] }));
    const { ids } = useStore(store, (state) => state);
    const move = useCallback((source, index) => store.setState((state) => ({
      ids: reorderEmailItems(state.ids.map(id => ({ id })), source, index).map(item => item.id),
      moves: [...state.moves, source + ':' + index],
    })), [store]);
    useEffect(() => { window.reorderProbe = store; }, [store]);
    return <EmailReorderGroup ids={ids} revision={ids.join(',')} disabled={false} onMove={move}>
      {ids.map((id, index) => <EmailBlockFrame key={id} id={id} label={id} disabled={false}>
        <Text>{id}</Text>
        <Pressable accessibilityLabel={'Move ' + id + ' up'} disabled={index === 0} onPress={() => move(id, index - 1)}><Text>Move up</Text></Pressable>
        <Pressable accessibilityLabel={'Move ' + id + ' down'} disabled={index === ids.length - 1} onPress={() => move(id, index + 1)}><Text>Move down</Text></Pressable>
      </EmailBlockFrame>)}
    </EmailReorderGroup>;
  }
  createRoot(document.getElementById('root')).render(<><RefProbe /><ReorderProbe /></>);
`;

const pause = () => new Promise((done) => setTimeout(done, 60));
async function until(check, message) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (check()) return;
    await pause();
  }
  assert.ok(check(), message);
}

test('semantic animated refs, repeated releases, cancellations and move controls', async () => {
  // Match Next's web forks and absence of the Worklets Babel plugin. No native
  // modules or application components are mocked by this bundle.
  const result = await build({
    stdin: { contents: entry, loader: 'jsx', resolveDir: root },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
    conditions: ['browser', 'import', 'default'],
    nodePaths: [resolve(root, 'node_modules')],
    alias: {
      'react-native': moduleRoot('react-native-web'),
      'react': moduleRoot('react'), 'react-dom': moduleRoot('react-dom'),
      'react-native-gesture-handler': resolve(moduleRoot('react-native-gesture-handler'), 'src/index.ts'),
      'react-native-reanimated': moduleRoot('react-native-reanimated'),
      'react-native-worklets': moduleRoot('react-native-worklets'),
      '@expo/html-elements': moduleRoot('@expo/html-elements'),
    },
    define: { 'process.env.NODE_ENV': '"development"', global: 'globalThis', __DEV__: 'true' },
  });
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  virtualConsole.on('error', (...values) => errors.push(values.map(String).join(' ')));
  const dom = new JSDOM('<!doctype html><style>*{scale:none}</style><div id="root"></div>', {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole,
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      window.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
      window.HTMLElement.prototype.setPointerCapture = function () {};
      window.HTMLElement.prototype.releasePointerCapture = function () {};
      window.HTMLElement.prototype.hasPointerCapture = () => true;
      window.HTMLElement.prototype.getBoundingClientRect = function () {
        const section = this.closest('section');
        const index = section ? [...window.document.querySelectorAll('section')].indexOf(section) : 0;
        const top = index * 200;
        return { x: 10, y: top, left: 10, top, right: 410, bottom: top + 180, width: 400, height: 180, toJSON() {} };
      };
    },
  });
  const { window } = dom;
  const { document } = window;
  const state = () => JSON.parse(JSON.stringify(window.reorderProbe.getState()));
  const feedback = () => document.querySelector('[aria-live="polite"]').textContent;
  const pointer = (node, type, y) => node.dispatchEvent(new window.PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1, clientX: 50, clientY: y,
  }));
  async function drag(source, cancellation) {
    const handle = document.querySelector(`[aria-label^="Drag ${source}."]`);
    const animated = handle.closest('section').firstElementChild;
    pointer(handle, 'pointerdown', 20);
    pointer(handle, 'pointermove', 40);
    await pause();
    // GH3 emits a boundary transition before tracking outside movement.
    pointer(handle, 'pointermove', 560);
    pointer(handle, 'pointermove', 570);
    await until(() => animated.style.transform === 'translateY(530px)', 'drag updates the host transform');
    if (cancellation === 'escape') {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await pause();
    }
    pointer(handle, cancellation === 'pointer' ? 'pointercancel' : 'pointerup', 570);
    await until(() => animated.style.transform === 'translateY(0px)', 'finalization resets the host transform');
    await pause();
  }
  try {
    window.eval(result.outputFiles[0].text);
    await until(() => window.refProbe && window.reorderProbe, 'actual reorder wrapper mounts without a Babel plugin');
    assert.deepEqual(errors, []);
    const host = document.getElementById('ref-probe');
    assert.equal(window.refProbe.ref.current, host, 'semantic CSS wrapper forwards the real host ref');
    window.refProbe.move(48);
    await until(() => host.style.transform === 'translateY(48px)', 'shared-value update reaches the semantic host');
    window.refProbe.move(0);
    await until(() => host.style.transform === 'translateY(0px)', 'shared-value reset reaches the semantic host');
    await drag('alpha');
    assert.deepEqual(state(), { ids: ['beta', 'gamma', 'alpha'], moves: ['alpha:2'] });
    const firstFeedback = feedback();
    await drag('beta');
    assert.deepEqual(state(), { ids: ['gamma', 'alpha', 'beta'], moves: ['alpha:2', 'beta:2'] });
    assert.notEqual(feedback(), firstFeedback, 'same-destination releases announce independently');
    await drag('gamma', 'escape');
    await drag('gamma', 'pointer');
    assert.deepEqual(state(), { ids: ['gamma', 'alpha', 'beta'], moves: ['alpha:2', 'beta:2'] });
    const down = document.querySelector('[aria-label="Move gamma down"]');
    assert.equal(down.tagName, 'BUTTON');
    down.focus();
    assert.equal(document.activeElement, down, 'semantic move control accepts keyboard focus');
    down.click();
    await until(() => state().moves.length === 3, 'move control commits');
    assert.deepEqual(state().ids, ['alpha', 'gamma', 'beta']);
    const up = document.querySelector('[aria-label="Move gamma up"]');
    up.click();
    await until(() => state().moves.length === 4, 'opposite move control commits');
    assert.deepEqual(state().ids, ['gamma', 'alpha', 'beta']);
    await drag('gamma');
    assert.deepEqual(state().ids, ['alpha', 'beta', 'gamma']);
    assert.equal(state().moves.length, 5, 'reordering recovers after cancellation and button moves');
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});
