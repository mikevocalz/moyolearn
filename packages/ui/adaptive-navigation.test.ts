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
      heightDp: 800,
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
    heightDp: 800,
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
      heightDp: 800,
      folds: [],
      isRTL: false,
    }).position,
    'left',
  );
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'expanded',
      heightDp: 800,
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
    heightDp: 900,
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
    heightDp: 800,
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
      heightDp: 800,
      folds: [],
      isRTL: false,
    }).position,
    'left',
  );
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'ios',
      sizeClass: 'expanded',
      heightDp: 800,
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
    heightDp: 800,
    folds: [vertical, tabletop],
    isRTL: false,
  });
  assert.equal(placement.position, 'bottom');
});


test('Android compact-height landscape stays on bottom navigation at wide width', () => {
  const placement = resolveAdaptiveNavigationPlacement({
    platform: 'android',
    sizeClass: 'expanded',
    heightDp: 420,
    folds: [],
    isRTL: false,
  });
  assert.equal(placement.kind, 'bottom-medium');
  assert.equal(placement.position, 'bottom');
});

test('Android rail starts exactly at the 600dp medium boundary', () => {
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'medium',
      heightDp: 800,
      widthDp: 600,
      folds: [],
      isRTL: false,
    }).kind,
    'rail-collapsed',
  );
});

test('Android 599dp compact width still keeps the rail', () => {
  // Compact width class alone no longer means the bottom bar: a 599dp window
  // is wider than a phone, so only a genuinely narrow window (<480dp) drops.
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'compact',
      heightDp: 800,
      widthDp: 599,
      folds: [],
      isRTL: false,
    }).kind,
    'rail-collapsed',
  );
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'compact',
      heightDp: 800,
      widthDp: 479,
      folds: [],
      isRTL: false,
    }).kind,
    'bottom-compact',
  );
});

test('Android 480dp is rail-eligible while 479dp stays on bottom navigation', () => {
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'expanded',
      heightDp: 480,
      widthDp: 900,
      folds: [],
      isRTL: false,
    }).kind,
    'rail-collapsed',
  );
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'expanded',
      heightDp: 479,
      widthDp: 900,
      folds: [],
      isRTL: false,
    }).kind,
    'bottom-medium',
  );
});

test('Android 1600dp is the inclusive boundary for the expanded rail', () => {
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'large',
      heightDp: 900,
      widthDp: 1599,
      folds: [],
      isRTL: false,
    }).kind,
    'rail-collapsed',
  );
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'extraLarge',
      heightDp: 900,
      widthDp: 1600,
      folds: [],
      isRTL: false,
    }).kind,
    'rail-expanded',
  );
});

test('Android book posture keeps rail navigation on the physical right edge', () => {
  const book: FoldLayout = {
    orientation: 'vertical',
    state: 'halfOpened',
    posture: 'book',
    separating: true,
    x: 430,
    y: 0,
    width: 20,
    height: 900,
  };

  // The rail is physical like the Apple hardware column — it does not mirror
  // under RTL.
  for (const isRTL of [false, true]) {
    const placement = resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'expanded',
      heightDp: 900,
      widthDp: 900,
      folds: [book],
      isRTL,
    });

    assert.equal(placement.kind, 'rail-collapsed');
    assert.equal(placement.position, 'right');
  }
});

test('Android tabletop wins over height/width rail eligibility', () => {
  const tabletopAt480: FoldLayout = {
    ...tabletop,
    y: 400,
  };

  const placement = resolveAdaptiveNavigationPlacement({
    platform: 'android',
    sizeClass: 'extraLarge',
    heightDp: 480,
    widthDp: 1600,
    folds: [tabletopAt480],
    isRTL: true,
  });

  assert.equal(placement.kind, 'bottom-medium');
  assert.equal(placement.position, 'bottom');
});
