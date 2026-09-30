import assert from 'node:assert/strict';
import test from 'node:test';
import type { FoldLayout } from './adaptive-panes/fold-layout.ts';
import { resolveAdaptiveNavigationPlacement } from './adaptive-navigation.ts';

const tabletop: FoldLayout = {
  orientation: 'horizontal',
  state: 'halfOpened',
  posture: 'tabletop',
  separating: true,
  x: 0,
  y: 400,
  width: 900,
  height: 0,
};

test('Android compact windows use bottom navigation', () => {
  assert.deepEqual(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'compact',
      folds: [],
      isRTL: false,
    }),
    {
      kind: 'bottom-compact',
      position: 'bottom',
      rail: false,
      expanded: false,
      hardwareWidth: 0,
    },
  );
});

test('Android tabletop posture keeps navigation on the bottom even at expanded width', () => {
  const placement = resolveAdaptiveNavigationPlacement({
    platform: 'android',
    sizeClass: 'expanded',
    folds: [tabletop],
    isRTL: false,
  });
  assert.equal(placement.kind, 'bottom-medium');
  assert.equal(placement.position, 'bottom');
});

test('Android regular foldables and tablets use logical-start rail', () => {
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'expanded',
      folds: [],
      isRTL: false,
    }).position,
    'left',
  );
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'expanded',
      folds: [],
      isRTL: true,
    }).position,
    'right',
  );
});

test('Android extra-large desktop windows get an expanded wide rail', () => {
  const placement = resolveAdaptiveNavigationPlacement({
    platform: 'android',
    sizeClass: 'extraLarge',
    folds: [],
    isRTL: false,
  });
  assert.equal(placement.kind, 'rail-expanded');
  assert.equal(placement.expanded, true);
});

test('Apple hardware column is physical and does not mirror in RTL', () => {
  const placement = resolveAdaptiveNavigationPlacement({
    platform: 'ios',
    sizeClass: 'compact',
    folds: [],
    hardwareEdge: { edge: 'left', width: 84 },
    isRTL: true,
  });
  assert.equal(placement.position, 'left');
  assert.equal(placement.kind, 'apple-hardware-rail');
  assert.equal(placement.hardwareWidth, 84);
});

test('ordinary iPad-width Apple windows use a logical leading sidebar', () => {
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'ios',
      sizeClass: 'expanded',
      folds: [],
      isRTL: false,
    }).position,
    'left',
  );
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'ios',
      sizeClass: 'expanded',
      folds: [],
      isRTL: true,
    }).position,
    'right',
  );
});

test('any tabletop hinge wins even on a multi-hinge device', () => {
  const vertical: FoldLayout = {
    ...tabletop,
    orientation: 'vertical',
    posture: 'book',
    x: 300,
    y: 0,
    width: 20,
    height: 900,
  };
  const placement = resolveAdaptiveNavigationPlacement({
    platform: 'android',
    sizeClass: 'large',
    folds: [vertical, tabletop],
    isRTL: false,
  });
  assert.equal(placement.position, 'bottom');
});
