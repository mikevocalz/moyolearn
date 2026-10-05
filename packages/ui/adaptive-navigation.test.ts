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

test('Android compact phone-width windows use bottom navigation', () => {
  assert.deepEqual(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'compact',
      heightDp: 800,
      widthDp: 390,
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

test('a single panel of a wide foldable keeps the right rail', () => {
  // One Surface Duo panel is 540×720dp — compact width class, but it is a
  // foldable half-screen, not a phone. The rail stays; the bottom bar is for
  // clamshell covers and portrait phones (<480dp).
  const duoPanel = resolveAdaptiveNavigationPlacement({
    platform: 'android',
    sizeClass: 'compact',
    heightDp: 720,
    widthDp: 540,
    folds: [],
    isRTL: false,
  });
  assert.equal(duoPanel.position, 'right');
  assert.equal(duoPanel.rail, true);

  const coverDisplay = resolveAdaptiveNavigationPlacement({
    platform: 'android',
    sizeClass: 'compact',
    heightDp: 800,
    widthDp: 390,
    folds: [],
    isRTL: false,
  });
  assert.equal(coverDisplay.kind, 'bottom-compact');
});

test('Android tabletop posture keeps navigation on the bottom even at expanded width', () => {
  const placement = resolveAdaptiveNavigationPlacement({
    platform: 'android',
    sizeClass: 'expanded',
    heightDp: 800,
      widthDp: 900,
    folds: [tabletop],
    isRTL: false,
  });
  assert.equal(placement.kind, 'bottom-medium');
  assert.equal(placement.position, 'bottom');
});

test('Android regular foldables and tablets use a physical right-edge rail', () => {
  // Like the iPhone Duo's hardware column, the Android rail stays on the
  // physical edge and does not mirror under RTL.
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'expanded',
      heightDp: 800,
      widthDp: 900,
      folds: [],
      isRTL: false,
    }).position,
    'right',
  );
  assert.equal(
    resolveAdaptiveNavigationPlacement({
      platform: 'android',
      sizeClass: 'expanded',
      heightDp: 800,
      widthDp: 900,
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
      widthDp: 1700,
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
      widthDp: 900,
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
      widthDp: 900,
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
      widthDp: 900,
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
      widthDp: 900,
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
      widthDp: 900,
    folds: [],
    isRTL: false,
  });
  assert.equal(placement.kind, 'bottom-medium');
  assert.equal(placement.position, 'bottom');
});
