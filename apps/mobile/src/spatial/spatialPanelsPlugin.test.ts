import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const plugin = require('../../modules/spatial-panels/app.plugin.js');

const OPTIONS = { defaultWidth: '80dp', defaultHeight: '472dp' };

function meta(element: { 'meta-data': { $: Record<string, string> }[] }): Map<string, string> {
  return new Map(element['meta-data'].map(({ $ }) => [$['android:name'], $['android:value']]));
}

// PICO OS 5 reuses the caller's 2D window for a same-package activity whose
// pico.vr.position equals the task root's. MainActivity declares none.
test('the panel declares a pico.vr.position, so PICO OS 5 opens it in its own window', () => {
  const values = meta(plugin.panelActivityElement(OPTIONS));
  assert.equal(values.get('pico.vr.position'), 'near');
});

test('the panel size the module reads is WxH in dp', () => {
  assert.equal(meta(plugin.panelActivityElement(OPTIONS)).get('pico.spatial.windowcontainer.defaultsize'), '80x472');
});

test('the committed pico manifest matches the plugin', () => {
  const xml = readFileSync(new URL('../../android/app/src/pico/AndroidManifest.xml', import.meta.url), 'utf8');
  const panel = xml.slice(xml.indexOf(plugin.PANEL_ACTIVITY));
  assert.match(panel, /android:name="pico\.vr\.position" android:value="near"/);
  assert.doesNotMatch(xml.slice(0, xml.indexOf(plugin.PANEL_ACTIVITY)), /pico\.vr\.position/);
});
