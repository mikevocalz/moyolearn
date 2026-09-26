import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHROME_ARTBOARD,
  CONTENT_BAND,
  CONTENT_RECT_PANEL,
  INK_ROW,
  PANEL_HEIGHT_M,
  PANEL_WIDTH_M,
  TOOL_ROW,
  artboardCenter,
  artboardToPanel,
  contentAnchorWorld,
} from './board-chrome-layout.ts';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('the panel is 1.2 m wide, 16:10, and the paper keeps its own 16:10', () => {
  near(PANEL_HEIGHT_M / PANEL_WIDTH_M, CHROME_ARTBOARD.height / CHROME_ARTBOARD.width);
  near(CHROME_ARTBOARD.width / CHROME_ARTBOARD.height, 16 / 10);
  near(CONTENT_RECT_PANEL.width, (CONTENT_BAND.w * PANEL_WIDTH_M) / CHROME_ARTBOARD.width);
  near(CONTENT_RECT_PANEL.height / CONTENT_RECT_PANEL.width, 640 / 1024);
});

test('artboard→panel flips Y and centres the panel on its own origin', () => {
  /* Top-left corner of the artboard → top-left of the panel face. */
  const tl = artboardToPanel({ x: 0, y: 0, w: 10, h: 10 });
  near(tl.x, -PANEL_WIDTH_M / 2);
  /* y grows DOWN in the artboard: the band at the very top sits highest. */
  const title = artboardToPanel({ x: 0, y: 0, w: 1024, h: 36 });
  const toolbar = artboardToPanel({ x: 0, y: 36, w: 1024, h: 104 });
  const content = artboardToPanel({ x: 0, y: 140, w: 1024, h: 640 });
  assert.ok(title.y > toolbar.y);
  assert.ok(toolbar.y > content.y);
  /* The bands tile the panel exactly — no seams, no overlap. */
  near(title.height + toolbar.height + content.height, PANEL_HEIGHT_M);
});

test('the content rect is the only input plane — 16:10, centred below the toolbar', () => {
  assert.deepEqual(contentAnchorWorld({ position: [0, 1.4, -1.5], yaw: 0 }, { position: [0, 0, 0], yawDeg: 0 }).position, [
    0,
    1.4 + (artboardCenter(CONTENT_BAND)[1] as number),
    -1.5,
  ]);
});

test('carrier translation and yaw move the world anchor exactly', () => {
  const slot = { position: [0, 1.4, -1.5] as const, yaw: 0 };
  const localY = artboardCenter(CONTENT_BAND)[1] as number;

  /* Translated carrier: straight offset, no rotation. */
  const moved = contentAnchorWorld(slot, { position: [0.3, 0, 0.2], yawDeg: 0 });
  near(moved.position[0], 0.3);
  near(moved.position[1], 1.4 + localY);
  near(moved.position[2], -1.3);

  /* Carrier yawed 90°: the slot's forward -z becomes the world's -x… and the
     anchor's yaw reports the composed facing. */
  const turned = contentAnchorWorld(slot, { position: [0, 0, 0], yawDeg: 90 });
  near(turned.position[0], -1.5);
  near(turned.position[2], 0);
  assert.equal(turned.yawDeg, 90);

  /* A rect off the axis under a turned slot: the local x offset becomes a
     world z offset — the sign convention xrRotateY states, composed here. */
  const offAxis = contentAnchorWorld(
    { position: [0, 1.4, -1.5], yaw: 90 },
    { position: [0.5, 0, 0], yawDeg: 0 },
    { x: 0, y: 140, w: 100, h: 640 },
  );
  const offX = artboardCenter({ x: 0, y: 140, w: 100, h: 640 })[0] as number;
  assert.ok(offX < 0);
  near(offAxis.position[0], 0.5); /* local x swings onto world z */
  near(offAxis.position[2], -1.5 - offX); /* z' = -x·sin90 → -(-0.541) = +0.541 */
  assert.equal(offAxis.yawDeg, 90);
});

test('the tool row covers the band without gaps the spec did not draw', () => {
  const keys = Object.keys(TOOL_ROW);
  for (const key of keys) {
    const r = TOOL_ROW[key as keyof typeof TOOL_ROW];
    assert.ok(r.x >= 0 && r.x + r.w <= CHROME_ARTBOARD.width, `${key} escapes the toolbar`);
    assert.ok(r.y >= 36 && r.y + r.h <= 140, `${key} escapes the band`);
  }
  /* Inks: 7 swatches at pitch, close key after them. */
  const lastSwatchX = CONTENT_BAND.x + 12 + 6 * INK_ROW.swatchPitch;
  assert.ok(lastSwatchX + INK_ROW.swatch.w <= INK_ROW.close.x, 'swatches overlap the close key');
});
