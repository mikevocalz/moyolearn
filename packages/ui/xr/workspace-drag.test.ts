// Dragging the workspace must carry the ink plane with the paper.
//
// The board panel and its input plane are both derived from the session
// placement. These tests pin that a grip drag, written as a placement move,
// shifts the panel slot, the ink anchor the screen computes and the Rive
// board's content anchor by exactly the hand's movement, at any yaw.
// SOT: packages/ui/xr/workspace-drag.ts · packages/ui/xr/world-slot.ts
// SOT-KEYWORDS: xr workspace drag test placement ink plane anchor delta

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentAnchorWorld } from './board-chrome-layout.ts';
import { worldSlot, xrRotateY } from './world-slot.ts';
import { dragStep, movePlacement, workspaceHeadOf, WORKSPACE_DRAG_MAX_STEP_M } from './workspace-drag.ts';

const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !== ${b}`);

const DIST = 1.5;
const DROP = -0.2;

/** What tutor-xr-screen derives from a placement: the paper's slot and the
    ink anchor (slot + media offset turned by the slot yaw). */
function surfacesOf(placement: { position: readonly [number, number, number]; rotation: readonly [number, number, number] }) {
  const head = workspaceHeadOf(placement, DIST, DROP);
  const slot = worldSlot('center', head, placement.rotation[1]);
  const off = xrRotateY([0, -0.08, 0.006], slot.yaw);
  const ink: [number, number, number] = [slot.position[0] + off[0], slot.position[1] + off[1], slot.position[2] + off[2]];
  const content = contentAnchorWorld(slot, { position: [0, 0, 0], yawDeg: 0 });
  return { slot, ink, content };
}

test('the first report of a grab seeds without moving', () => {
  const step = dragStep(null, [0.1, 1.2, -1]);
  assert.equal(step.delta, null);
  assert.deepEqual(step.last, [0.1, 1.2, -1]);
});

test('successive reports become the movement between them', () => {
  const step = dragStep([0, 1, -1], [0.05, 1.02, -1.1]);
  assert.ok(step.delta);
  near(step.delta[0], 0.05);
  near(step.delta[1], 0.02);
  near(step.delta[2], -0.1);
  assert.deepEqual(step.last, [0.05, 1.02, -1.1]);
});

test('a tracking jump reseeds instead of throwing the board', () => {
  const step = dragStep([0, 1, -1], [0, 1, -1 - WORKSPACE_DRAG_MAX_STEP_M - 0.01]);
  assert.equal(step.delta, null);
  near(step.last[2], -1 - WORKSPACE_DRAG_MAX_STEP_M - 0.01);
});

test('a non-finite report is ignored', () => {
  const step = dragStep([0, 1, -1], [Number.NaN, 1, -1]);
  assert.equal(step.delta, null);
  assert.deepEqual(step.last, [0, 1, -1]);
});

test('moving the placement keeps yaw and scale', () => {
  const moved = movePlacement({ position: [1, 2, 3], rotation: [0, 40, 0], scale: 1 }, [0.1, 0, -0.2]);
  assert.deepEqual(moved.rotation, [0, 40, 0]);
  assert.equal(moved.scale, 1);
  near(moved.position[0], 1.1);
  near(moved.position[2], 2.8);
});

test('paper, ink anchor and content anchor move together by exactly the drag', () => {
  for (const yaw of [-135, -20, 0, 33, 90, 180]) {
    const before = { position: [0.4, 1.6, -0.3] as const, rotation: [0, yaw, 0] as const, scale: 1 };
    const delta: [number, number, number] = [0.27, -0.11, 0.42];
    const after = movePlacement(before, delta);
    const a = surfacesOf(before);
    const b = surfacesOf(after);
    for (let i = 0; i < 3; i++) {
      near(b.slot.position[i]! - a.slot.position[i]!, delta[i]!);
      near(b.ink[i]! - a.ink[i]!, delta[i]!);
      near(b.content.position[i]! - a.content.position[i]!, delta[i]!);
    }
    near(b.slot.yaw, a.slot.yaw);
    near(b.content.yawDeg, a.content.yawDeg);
  }
});
