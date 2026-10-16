// B6 scratch perf harness: bundles the real WorksheetReview through the same
// esbuild + react-native-web + jsdom setup as tooling/business-studio-dom.test.mjs,
// wraps it in React.Profiler, and records mount and one reorder commit at N candidates.
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
const root = resolve(import.meta.dirname, '../../../../..');
const require = createRequire(resolve(root, 'package.json'));
const moduleRoot = (n) => dirname(require.resolve(n + '/package.json'));
const file = (p) => JSON.stringify(resolve(root, p));
const entry = `
  import React, { Profiler } from 'react';
  import { createRoot } from 'react-dom/client';
  import { WorksheetReview } from ${file('packages/app/features/capture/worksheet-review.tsx')};
  const n = window.__N;
  const text = Array.from({ length: n }, (_, i) => (i + 1) + '. ' + (i + 1) + '/' + (i + 2) + ' + 1/' + (i + 3)).join('\\n');
  window.__commits = [];
  const onRender = (id, phase, actual, base) => window.__commits.push({ phase, actual, base });
  createRoot(document.getElementById('root')).render(
    <Profiler id="review" onRender={onRender}>
      <WorksheetReview text={text} pages={[]} subject="Math" ageBand="child" onBack={() => {}} onConfirm={() => {}} />
    </Profiler>);
`;
const result = await build({
  absWorkingDir: root, stdin: { contents: entry, loader: 'tsx', resolveDir: root },
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  conditions: ['browser', 'import', 'default'], nodePaths: [resolve(root, 'node_modules')],
  alias: {
    'react-native': moduleRoot('react-native-web'), react: moduleRoot('react'), 'react-dom': moduleRoot('react-dom'),
    'react-native-gesture-handler': resolve(moduleRoot('react-native-gesture-handler'), 'src/index.ts'),
    'react-native-reanimated': moduleRoot('react-native-reanimated'), 'react-native-worklets': moduleRoot('react-native-worklets'),
    '@expo/html-elements': moduleRoot('@expo/html-elements'),
  },
  loader: { '.js': 'jsx', '.png': 'empty', '.ttf': 'empty', '.otf': 'empty', '.css': 'empty' },
  define: { 'process.env.NODE_ENV': '"development"', global: 'globalThis', __DEV__: 'true', 'process.env': '{}' },
  logLevel: 'error',
});
const code = result.outputFiles[0].text;
const pause = (ms) => new Promise((d) => setTimeout(d, ms));
for (const n of [10, 25, 50]) {
  const runs = [];
  for (let r = 0; r < 5; r += 1) {
    const errors = [];
    const vc = new VirtualConsole(); vc.on('jsdomError', (e) => errors.push(e.message)); vc.on('error', (...v) => errors.push(v.map(String).join(' ')));
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc,
      beforeParse(w) { w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }); w.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} }; } });
    const { window } = dom; window.__N = n; window.__errs = errors;
    window.eval(code);
    await pause(100);
    if (!window.__commits.length) { console.log('no commit', n, errors.slice(0,3).join(' || ').slice(0,800)); process.exit(1); }
    const cards = (window.document.body.textContent.match(/Question \d+ of \d+/g) ?? []).length;
    const detected = (window.document.body.textContent.match(/(\d+) questions detected/) ?? [])[1];
    const later = [...window.document.querySelectorAll('[role="button"],button')].find((b) => b.textContent.trim() === 'Later' && b.getAttribute('aria-disabled') !== 'true');
    const before = window.__commits.length;
    later?.click();
    await pause(100);
    const upd = window.__commits.slice(before);
    runs.push({ detected, mount: window.__commits[0]?.actual, mountCommits: before, cards, updateCommits: upd.length, update: upd.reduce((a, c) => a + c.actual, 0), domNodes: window.document.querySelectorAll('*').length, errors: errors.length, clicked: !!later });
    window.close();
  }
  const med = (k) => { const v = runs.map((x) => x[k]).sort((a, b) => a - b); return v[2]; };
  console.log(JSON.stringify({ n, detected: runs[0].detected, cardsRendered: runs[0].cards, domNodes: runs[0].domNodes, mountCommits: runs[0].mountCommits, mountMsMedian: +med('mount').toFixed(2), reorderCommits: runs[0].updateCommits, reorderMsMedian: +med('update').toFixed(2), reorderClicked: runs[0].clicked, jsdomErrors: runs[0].errors, mountMsRuns: runs.map((x) => +x.mount.toFixed(2)) }));
}
