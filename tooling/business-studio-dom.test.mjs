// Executes the real semantic View, GH3 handlers and Reanimated web runtime.
// jsdom has no layout or pointer capture: deterministic shims below model those
// boundaries. This is not a browser, authenticated owner-flow or device test.
// SOT: docs/business/semantic-gestures.md
// SOT-KEYWORDS: business studio semantic reorder DOM ref gesture regression
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { matchesGlob, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const moduleRoot = (name) => resolve(require.resolve(`${name}/package.json`), '..');
const file = (path) => JSON.stringify(resolve(root, path));
const entry = `
  import React, { useEffect, useRef } from 'react';
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
    const store = useInstanceStore(() => ({ ids: ['alpha', 'beta', 'gamma'], moves: [], callbackTags: [], unrelated: 0, revision: 0, disabled: false }));
    const { ids, unrelated, revision, disabled } = useStore(store, (state) => state);
    const move = (source, index) => store.setState((state) => ({
      ids: reorderEmailItems(state.ids.map(id => ({ id })), source, index).map(item => item.id),
      moves: [...state.moves, source + ':' + index],
      callbackTags: [...state.callbackTags, unrelated],
    }));
    useEffect(() => { window.reorderProbe = store; }, [store]);
    return <EmailReorderGroup ids={[...ids]} revision={String(revision)} disabled={disabled} onMove={move}>
      {ids.map((id, index) => <EmailBlockFrame key={id} id={id} label={id} disabled={disabled}>
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
    absWorkingDir: root,
    stdin: { contents: entry, loader: 'jsx', resolveDir: root },
    bundle: true, write: false, metafile: true, platform: 'browser', format: 'iife', jsx: 'automatic',
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
  // Keep the workflow coupled to the actual local bundle dependency graph,
  // including semantic primitives reached through platform forks/barrels.
  const workflow = readFileSync(resolve(root, '.github/workflows/business-studio-ui.yml'), 'utf8');
  const pullRequest = workflow.match(/^  pull_request:\r?\n([\s\S]*?)(?=^  \S|^\S|(?![\s\S]))/m)?.[1] ?? '';
  const paths = pullRequest.match(/^    paths:\r?\n([\s\S]*?)(?=^    \S|(?![\s\S]))/m)?.[1] ?? '';
  const filters = [...paths.matchAll(/^      - '([^']+)'\r?$/gm)].map((match) => match[1]);
  const localInputs = Object.keys(result.metafile.inputs).filter((path) => path.startsWith('packages/') || path.startsWith('apps/'));
  assert.ok(localInputs.length > 0, 'the real bundle records its local dependencies');
  assert.deepEqual(localInputs.filter((path) => !filters.some((filter) => matchesGlob(path, filter))), [], 'workflow must trigger for every bundled local source');
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
  const snapshot = () => JSON.parse(JSON.stringify(window.reorderProbe.getState()));
  const state = () => { const { ids, moves } = snapshot(); return { ids, moves }; };
  const feedback = () => document.querySelector('[aria-live="polite"]').textContent;
  const pointer = (node, type, y, pointerId = 1, pointerType = 'mouse') => node.dispatchEvent(new window.PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId, pointerType, isPrimary: pointerId === 1,
    button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1, clientX: 50, clientY: y,
  }));
  async function drag(source, cancellation, whileActive) {
    const handle = document.querySelector(`[aria-label^="Drag ${source}."]`);
    const animated = handle.closest('section').firstElementChild;
    const send = (type, y, id = 1) => pointer(handle, type, y, id, cancellation === 'extra' ? 'touch' : 'mouse');
    send('pointerdown', 20);
    send('pointermove', 40);
    await pause();
    if (cancellation === 'extra') {
      // The first touch is already ACTIVE. The second touch goes down/up
      // without a move; only then does the original touch move and release.
      // GH3's web onPointerAdd must cancel immediately at maxPointers: 1.
      send('pointermove', 60);
      await until(() => animated.style.transform === 'translateY(20px)', 'the first touch is active before another touch is added');
      send('pointerdown', 45, 2);
      await until(() => animated.style.transform === 'translateY(0px)', 'second touch down immediately cancels the active pan');
      send('pointerup', 45, 2);
      await pause();
      send('pointermove', 560);
      send('pointermove', 570);
      send('pointerup', 570);
      await pause();
      assert.equal(animated.style.transform, 'translateY(0px)', 'second touch cancels before the original release');
      return;
    }
    // GH3 emits a boundary transition before tracking outside movement.
    pointer(handle, 'pointermove', 560);
    pointer(handle, 'pointermove', 570);
    await until(() => animated.style.transform === 'translateY(530px)', 'drag updates the host transform');
    if (whileActive) await whileActive({ handle, animated });
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
    await drag('gamma', 'extra');
    assert.deepEqual(state(), { ids: ['gamma', 'alpha', 'beta'], moves: ['alpha:2', 'beta:2'] }, 'a stationary second touch followed by the original release commits nothing');
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
    await drag('alpha', undefined, async ({ handle, animated }) => {
      window.reorderProbe.setState({ unrelated: 1 });
      await pause();
      assert.equal(animated.style.transform, 'translateY(530px)', 'fresh equal IDs and a new callback do not cancel an active gesture');
      pointer(handle, 'pointermove', 575);
      await until(() => animated.style.transform === 'translateY(535px)', 'the gesture continues after the unrelated parent render');
    });
    assert.equal(state().moves.length, 6, 'unrelated parent render still permits one release commit');
    assert.equal(snapshot().callbackTags.at(-1), 1, 'release uses the newest committed callback');
    const invalidations = [
      ['ID order', { ids: ['alpha', 'gamma', 'beta'] }],
      ['ID value', { ids: ['alpha', 'delta', 'gamma'] }],
      ['ID count', { ids: ['alpha', 'beta'] }],
      ['document revision', { revision: 1 }],
      ['disabled state', { disabled: true }],
    ];
    for (const [reason, update] of invalidations) {
      window.reorderProbe.setState({ ids: ['alpha', 'beta', 'gamma'], revision: 0, disabled: false });
      await pause();
      await drag('alpha', undefined, async ({ animated }) => {
        window.reorderProbe.setState(update);
        await until(() => animated.style.transform === 'translateY(0px)', reason + ' immediately cancels translation');
      });
      assert.equal(state().moves.length, 6, reason + ' prevents a release commit');
    }
    // Both arrays collide under a NUL-delimited join; ID values must still
    // invalidate the transaction without relying on a delimiter convention.
    window.reorderProbe.setState({ ids: ['alpha', 'beta\u0000gamma', 'delta'], revision: 0, disabled: false });
    await pause();
    await drag('alpha', undefined, async ({ animated }) => {
      window.reorderProbe.setState({ ids: ['alpha', 'beta', 'gamma\u0000delta'] });
      await until(() => animated.style.transform === 'translateY(0px)', 'delimiter-colliding IDs still cancel');
    });
    assert.equal(state().moves.length, 6, 'delimiter-colliding IDs prevent a release commit');
    window.reorderProbe.setState({ ids: ['alpha', 'beta', 'gamma'] });
    await pause();
    await drag('alpha');
    assert.equal(state().moves.length, 7, 'the next valid gesture recovers after all prop invalidations');
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});
