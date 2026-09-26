// Every ratio the spatial chrome claims, computed rather than described.
//
// `XR_MATERIAL.key`, `XR_MATERIAL.keySelected` and `XR_COLOR.focus` all
// resolved to `palette.ink[100]` through a release: a rail key's resting fill,
// its selected fill and its hover ring were one colour, 1.00:1 between every
// pair, and a child could not see which tool was chosen or where their ray was
// pointing (`06-a11y.md` F1/F2). Nothing caught it because the colours lived
// beside `ViroMaterials.createMaterials`, in a module that imports the renderer
// and therefore cannot be loaded by a test in this package.
//
// So the values moved to `xr-colors.ts` and the ratios moved here. The maths is
// `tooling/check-contrast.mjs`'s, which is the gate the 2D palette already runs
// under — copied rather than imported because that file is a lint script with
// its own pair list, not a module, and eight lines of sRGB is a smaller cost
// than making it one.
// SOT: packages/ui/xr/xr-colors.ts · tooling/check-contrast.mjs
// SOT-KEYWORDS: xr colours contrast test wcag ratio key selected focus ring label non-text

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { THEMES } from '@quickdrawjs/core';
import { XR_COLOR, XR_SURFACE } from './xr-colors.ts';

/** WCAG 2.1 relative luminance over an opaque sRGB hex, `#rgb` or `#rrggbb`. */
const channels = (colour: string): [number, number, number] => {
  const body = colour.slice(1);
  const full = body.length === 3 ? [...body].map((c) => c + c).join('') : body;
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255);
  return [r ?? 0, g ?? 0, b ?? 0];
};

const luminance = (colour: string): number => {
  const [r, g, b] = channels(colour).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a: string, b: string): number => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
};

/** WCAG 1.4.11 non-text contrast, and 1.4.3 for anything a child has to read. */
const NON_TEXT = 3;
const BODY_TEXT = 4.5;

const atLeast = (bar: number, a: string, b: string, what: string) =>
  assert.ok(ratio(a, b) >= bar, `${what}: ${ratio(a, b).toFixed(2)}:1, needs ${bar}:1`);

test('the three key colours are three colours', () => {
  // The regression itself, stated as the thing it was: not "they contrast
  // enough" but "they are not the same value".
  const three = [XR_SURFACE.key, XR_SURFACE.keySelected, XR_SURFACE.focus];
  assert.equal(new Set(three).size, 3, `collapsed to ${new Set(three).size} colour(s)`);
});

test('a selected key is distinguishable from a resting one', () => {
  atLeast(NON_TEXT, XR_SURFACE.keySelected, XR_SURFACE.key, 'selected fill on resting fill');
});

test('the focus ring reads on every fill it is ever drawn over', () => {
  // It is drawn ON a key, so the key is the adjacent colour — both of them.
  atLeast(NON_TEXT, XR_SURFACE.focus, XR_SURFACE.key, 'ring on a resting key');
  atLeast(NON_TEXT, XR_SURFACE.focus, XR_SURFACE.keySelected, 'ring on a selected key');
});

test('a key has a visible body on the rail it sits on', () => {
  atLeast(NON_TEXT, XR_SURFACE.key, XR_SURFACE.rail, 'resting key on the rail');
});

test('a label clears AA on the fill under it, in both key states', () => {
  atLeast(BODY_TEXT, XR_COLOR.onKey, XR_SURFACE.key, 'resting label');
  atLeast(BODY_TEXT, XR_COLOR.onKeySelected, XR_SURFACE.keySelected, 'selected label');
  atLeast(BODY_TEXT, XR_COLOR.onPanel, XR_SURFACE.rail, 'panel text on the rail');
  atLeast(BODY_TEXT, XR_COLOR.onPanelMuted, XR_SURFACE.rail, 'muted panel text on the rail');
});

test('the selection outline reads on the fill it outlines', () => {
  // It is drawn only when the key is selected, so that is the only pairing.
  atLeast(NON_TEXT, XR_COLOR.onKeySelected, XR_SURFACE.keySelected, 'selection outline');
});

test('every outline is the colour of the label it belongs to', () => {
  /*
    An outline used to be a `ViroFlexView`'s `borderColor` and could take
    `XR_COLOR` directly. A stacked-quad key draws it as geometry, so the same
    value has to exist a second time as a registered surface — and two writings
    of one colour are two colours waiting to disagree. The ring that says "this
    key is selected" drifting off the label that says which key it is would be
    the exact failure this file was written for.
  */
  assert.equal(XR_SURFACE.ringKey, XR_COLOR.onKey);
  assert.equal(XR_SURFACE.ringKeySelected, XR_COLOR.onKeySelected);
  assert.equal(XR_SURFACE.ringMuted, XR_COLOR.onPanelMuted);
});

test('an ink chip has a boundary on both key fills, whatever the hue', () => {
  /*
    A chip is bounded either by its own contrast with the key or by the outline
    drawn around it in the label's colour — `#f1ac4b` is 1.85:1 against the
    cream key and needs the outline, `#1d1d1d` is 15.18:1 and does not. Each
    swatch's NAME is what carries the choice (SC 1.4.1); this keeps the sample
    beside it from being a smudge.
  */
  for (const id of ['black', 'blue', 'red', 'green', 'yellow', 'orange', 'violet'] as const) {
    const chip = THEMES.light.colors[id].stroke;
    assert.ok(
      Math.max(ratio(chip, XR_SURFACE.key), ratio(XR_COLOR.onKey, chip)) >= NON_TEXT,
      `${id} chip is unbounded on a resting key`,
    );
    assert.ok(
      Math.max(ratio(chip, XR_SURFACE.keySelected), ratio(XR_COLOR.onKeySelected, chip)) >=
        NON_TEXT,
      `${id} chip is unbounded on a selected key`,
    );
  }
});
