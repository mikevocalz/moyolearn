import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
  OUTWARD_FAR_EDGE_DP,
  PICO_RAIL_STRIP_WIDTH_DP,
  RAIL_WINDOW_DP,
  outwardWindowGapDp,
  railWindow,
  railWindowHeightDp,
} from './railWindow.ts';
import { ATTACHED_WINDOW_GAP_DP, attachedWindowFrame, panelLaunchSizeDp } from './panelWindowsCore.ts';

const require = createRequire(import.meta.url);
const { resolveAnchor } = require(
  join(dirname(require.resolve('@metavr/layout-window-compat')), 'SpatialAnchor.js'),
);

// The learner shell's bands (app/(learner)/(tabs)/_layout.tsx BAND_ITEMS).
const LEARNER_TABS = { young: 3, child: 4, teen: 5, adult: 5 } as const;

describe('outwardWindowGapDp (Horizon OS 207, Harlem Might ADR 0005)', () => {
  it('reproduces the overlaps measured on the headset', () => {
    assert.equal(outwardWindowGapDp(300), -140);
    assert.equal(outwardWindowGapDp(400), -240);
    assert.equal(outwardWindowGapDp(440), -280);
  });

  it('puts the far edge 160dp out', () => {
    assert.equal(OUTWARD_FAR_EDGE_DP, 160);
  });

  it('leaves room beside the rail window instead of overlapping the main one', () => {
    assert.equal(outwardWindowGapDp(RAIL_WINDOW_DP.width), 80);
  });
});

describe('RAIL_WINDOW_DP', () => {
  it('is the collapsed rail token wide, with the K–2 target as its slot', () => {
    assert.equal(RAIL_WINDOW_DP.width, 80);
    assert.equal(RAIL_WINDOW_DP.item, 72);
  });

  it('pads top and bottom by the indicator clearance', () => {
    assert.equal(RAIL_WINDOW_DP.padding, (80 - 40) / 2);
  });
});

describe('railWindow', () => {
  it('sits outside the physical left edge, including RTL, at the same depth', () => {
    const window = railWindow(LEARNER_TABS.teen);
    assert.deepEqual(window.anchor, { parent: 'left', child: 'right' });
    assert.equal(window.offset, undefined);
  });

  it('passes physical edges through the installed Meta SDK anchor adapter', () => {
    assert.deepEqual(resolveAnchor(railWindow(LEARNER_TABS.teen).anchor), {
      parent: { horizontal: 'left', vertical: null },
      child: { horizontal: 'right', vertical: null },
    });
  });

  it('is exactly as tall as each learner band’s tabs', () => {
    assert.equal(railWindow(LEARNER_TABS.young).windowHeight, 3 * 72 + 2 * 20);
    assert.equal(railWindow(LEARNER_TABS.child).windowHeight, 4 * 72 + 2 * 20);
    assert.equal(railWindow(LEARNER_TABS.teen).windowHeight, 5 * 72 + 2 * 20);
    assert.equal(railWindow(LEARNER_TABS.adult).windowHeight, railWindowHeightDp(5));
  });

  it('keeps its label stable across bands so a band change resizes one window', () => {
    assert.equal(railWindow(3).label, railWindow(5).label);
  });

  it('outranks content windows for a slot and never draws inline', () => {
    const window = railWindow(LEARNER_TABS.teen);
    assert.equal(window.priority, 20);
    assert.equal(window.fallback, 'drop');
    assert.equal(window.promotable, true);
  });
});

describe('the PICO rail panel', () => {
  // PICO reads the panel size once, at install, so it is a fixed box for the
  // tallest shell: five destinations plus the overflow-menu slot.
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

  it('is declared at the rail width and the tallest shell’s height in app.config.ts', () => {
    const config = read('../../app.config.ts');
    assert.match(
      config,
      new RegExp(`defaultWidth: '${RAIL_WINDOW_DP.width}dp', defaultHeight: '${railWindowHeightDp(6)}dp'`),
    );
  });

  it('matches the checked-in pico manifest', () => {
    const manifest = read('../../android/app/src/pico/AndroidManifest.xml');
    const size = `${RAIL_WINDOW_DP.width}x${railWindowHeightDp(6)}`;
    assert.match(manifest, new RegExp(`windowcontainer.defaultsize" android:value="${size}"`));
    assert.match(
      manifest,
      new RegExp(`android:defaultWidth="${RAIL_WINDOW_DP.width}dp" android:defaultHeight="${railWindowHeightDp(6)}dp"`),
    );
  });
});

describe('one rail geometry on every spatial platform', () => {
  it('opens the PICO panel at exactly the Quest window size for every shell', () => {
    for (const items of [3, 4, 5, 6, 7]) {
      const quest = railWindow(items);
      const pico = panelLaunchSizeDp(quest);
      assert.deepEqual(pico, { widthDp: quest.windowWidth, heightDp: quest.windowHeight });
    }
  });

  it('is a rounded rail shorter than the main window', () => {
    assert.equal(RAIL_WINDOW_DP.width, 80);
    assert.ok(RAIL_WINDOW_DP.cornerRadius > 0);
    assert.ok(railWindow(5).windowHeight < 720);
  });
});

describe('the PICO in-window rail strip', () => {
  it('draws the rail at the Quest window size for every shell', () => {
    for (const items of [3, 4, 5, 6, 7]) {
      const quest = railWindow(items);
      const frame = attachedWindowFrame(quest);
      assert.ok(frame, 'the Quest rail is attached outside the left edge');
      assert.equal(frame.edge, 'left');
      assert.equal(frame.widthDp, quest.windowWidth);
      assert.equal(frame.heightDp, quest.windowHeight);
    }
  });

  it('keeps the Quest gap: flush, as the anchor pins the edges with no offset', () => {
    const quest = railWindow(5);
    assert.equal(quest.offset, undefined);
    assert.equal(attachedWindowFrame(quest)?.gapDp, ATTACHED_WINDOW_GAP_DP);
    assert.equal(ATTACHED_WINDOW_GAP_DP, 0);
  });

  it('reserves exactly the rail plus the gap', () => {
    assert.equal(PICO_RAIL_STRIP_WIDTH_DP, RAIL_WINDOW_DP.width + ATTACHED_WINDOW_GAP_DP);
    assert.equal(attachedWindowFrame(railWindow(5))?.stripWidthDp, PICO_RAIL_STRIP_WIDTH_DP);
  });

  it('rounds the rail and the main panel with the one window radius', () => {
    assert.equal(RAIL_WINDOW_DP.cornerRadius, 12.25);
  });

  it('is shorter than the PICO main panel, so it centres beside it', () => {
    // The PICO OS 5 main panel: 1600x900px at 200dpi, 720dp tall.
    for (const items of [3, 4, 5, 6, 7]) assert.ok(railWindow(items).windowHeight < 720);
  });

  it('leaves floating windows as their own panels', () => {
    const floating = { ...railWindow(5), label: 'detail', anchor: { parent: 'right', child: 'left' } } as const;
    assert.equal(attachedWindowFrame(floating), null);
    assert.equal(attachedWindowFrame({ ...railWindow(5), anchor: 'center' }), null);
    assert.equal(attachedWindowFrame({ ...railWindow(5), offset: { z: 1 } }), null);
  });
});
