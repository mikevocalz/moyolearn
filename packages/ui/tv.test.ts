// The ramp font sizes must survive tailwind-variants' merge. Without the
// `twMergeConfig` in tv.ts the merger reads `text-caption` as a text colour and
// deletes it next to `text-text-muted` (see the header of tv.ts). tailwind-variants
// 4 accepts that config only on its `/config` entry, so importing `createTV` from
// the root entry drops it with no type error at the call sites. Checked red on
// 2026-11-25: the root entry turns `text-caption text-text-muted` into
// `text-text-muted`.
// SOT: packages/ui/tv.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tv } from './tv.ts';

const merged = (base: string) => tv({ base })();

test('a ramp size and a text colour are kept together', () => {
  assert.equal(merged('text-caption text-text-muted'), 'text-caption text-text-muted');
  assert.equal(merged('text-title-lg text-text'), 'text-title-lg text-text');
  assert.equal(merged('text-display-sm text-primary'), 'text-display-sm text-primary');
  assert.equal(merged('text-site-hero text-text'), 'text-site-hero text-text');
});

test('a ramp size still replaces another font size', () => {
  assert.equal(merged('text-sm text-caption'), 'text-caption');
  assert.equal(merged('text-caption text-site-hero'), 'text-site-hero');
});

test('ordinary conflicts still resolve', () => {
  assert.equal(merged('text-red-500 text-text-muted'), 'text-text-muted');
  assert.equal(merged('p-2 p-4'), 'p-4');
});
