import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { MAIN_CONTENT_ASPECT_RATIO, fitMainContent } from './main-content-geometry.ts';

test('the middle surface reuses the configured launch aspect without changing the window contract', () => {
  const config = readFileSync(new URL('../../app.config.ts', import.meta.url), 'utf8');
  const width = Number(config.match(/defaultWidth: '(\d+)dp'/)?.[1]);
  const height = Number(config.match(/defaultHeight: '(\d+)dp'/)?.[1]);
  assert.equal(MAIN_CONTENT_ASPECT_RATIO, width / height);
});

test('intermediate resize sizes preserve ratio and contain every surface edge', () => {
  for (const [width, height] of [[1024, 640], [500, 900], [1600, 640], [801, 599], [320, 280], [1920, 1080]]) {
    const frame = fitMainContent(width!, height!);
    assert.ok(frame);
    assert.ok(Math.abs(frame.width / frame.height - MAIN_CONTENT_ASPECT_RATIO) < 1e-10);
    assert.ok(frame.left >= 0 && frame.top >= 0);
    assert.ok(frame.left + frame.width <= width! + 1e-10 && frame.top + frame.height <= height! + 1e-10);
    assert.equal(frame.left, (width! - frame.width) / 2);
    assert.equal(frame.top, (height! - frame.height) / 2);
    assert.ok(frame.width === width || frame.height === height);
  }
});

test('zero or stale invalid measurements never produce an oversized frame', () => {
  for (const [width, height] of [[0, 640], [1024, 0], [-1, 600], [NaN, 600], [800, Infinity]]) assert.equal(fitMainContent(width!, height!), null);
});
