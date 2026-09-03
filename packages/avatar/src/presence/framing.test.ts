/**
 * The one thing the fit has to get right: nothing is off screen.
 *
 * Written against the SHIPPED body's real bounds (x ±0.62, y 0..1.65, z
 * ±0.2 — read off `natalie-phone/natalie.gltf`'s POSITION accessor) in the two
 * aspects that actually exist: the tall column of the pane composition and the
 * short wide band of the single spine card. The check is a projection, not a
 * number, so it fails for the reason the bug had — a corner outside the
 * frustum — rather than because someone retuned the margin.
 *
 * SOT: ./framing.ts
 * SOT-KEYWORDS: framing test camera fit contain aspect bounds ndc
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { frameBody } from './framing.ts';

/** Her real bounds, as a box the fit can measure. */
function bodyProxy(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1.231, 1.657, 0.349);
  geometry.translate(0.0035, 0.8255, 0.0335);
  return new THREE.Mesh(geometry);
}

/** Every corner of the body's bounds, in normalised device coordinates. */
function corners(camera: THREE.PerspectiveCamera, body: THREE.Object3D): THREE.Vector3[] {
  const box = new THREE.Box3().setFromObject(body);
  const out: THREE.Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        out.push(new THREE.Vector3(x, y, z).project(camera));
      }
    }
  }
  return out;
}

describe('frameBody', () => {
  for (const [name, aspect] of [
    ['a tall pane column', 280 / 700],
    ['the spine card band', 360 / 260],
    ['square', 1],
  ] as const) {
    it(`holds the whole body in ${name}`, () => {
      const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 10);
      const body = bodyProxy();
      frameBody(camera, body);
      camera.updateMatrixWorld(true);

      for (const point of corners(camera, body)) {
        assert.ok(Math.abs(point.x) <= 1, `x ${point.x} off screen at aspect ${aspect}`);
        assert.ok(Math.abs(point.y) <= 1, `y ${point.y} off screen at aspect ${aspect}`);
        // Inside the near/far planes too — the old `far` of 10 was the kind of
        // constant that survives a reframe and clips the result.
        assert.ok(point.z > -1 && point.z < 1, `z ${point.z} outside the frustum`);
      }
    });
  }

  it('frames her head to toe, not her face', () => {
    const camera = new THREE.PerspectiveCamera(38, 280 / 700, 0.1, 10);
    const body = bodyProxy();
    frameBody(camera, body);
    camera.updateMatrixWorld(true);

    // Feet and crown both in frame is the whole of the reported bug.
    const feet = new THREE.Vector3(0, 0, 0).project(camera);
    const crown = new THREE.Vector3(0, 1.654, 0).project(camera);
    assert.ok(Math.abs(feet.y) <= 1, 'her feet are off screen');
    assert.ok(Math.abs(crown.y) <= 1, 'the top of her head is off screen');
    // And the right way up.
    assert.ok(crown.y > feet.y);
  });

  it('is a no-op on an empty object rather than a NaN camera', () => {
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10);
    camera.position.set(0, 1.45, 1.15);
    frameBody(camera, new THREE.Group());
    assert.deepEqual(camera.position.toArray(), [0, 1.45, 1.15]);
  });
});
