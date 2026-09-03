/**
 * The two properties the shot has to hold, and they are Mike's, in his words:
 * she is never squished, and her size does not change when the panels move.
 *
 * Squish is the RENDERER's half (camera aspect vs surface aspect) and cannot be
 * seen from here. What this file pins is the framing's half: the whole of her
 * height is in frame, and the distance that puts it there is the same number at
 * every aspect — so a pane opening beside her cannot resize her.
 *
 * Written against the SHIPPED body's real bounds (x ±0.62, y 0..1.65, z ±0.2,
 * read off `natalie-phone/natalie.gltf`'s POSITION accessor) and checked as a
 * projection rather than a number, so it fails for the reason the bug had
 * rather than because someone retuned the fill.
 *
 * SOT: ./framing.ts
 * SOT-KEYWORDS: framing test camera fit height aspect invariant bounds ndc
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { TARGET_FILL, frameBody } from './framing.ts';

/** Her real bounds, as a box the fit can measure. */
function bodyProxy(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1.231, 1.657, 0.349);
  geometry.translate(0.0035, 0.8255, 0.0335);
  return new THREE.Mesh(geometry);
}

/** The three panes she really renders in, plus a square for good measure. */
const ASPECTS: [string, number][] = [
  ['a three-pane column', 280 / 700],
  ['a two-pane column', 520 / 700],
  ['the spine card band', 360 / 260],
  ['square', 1],
];

describe('frameBody', () => {
  for (const [name, aspect] of ASPECTS) {
    it(`holds her full height in ${name}`, () => {
      const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 10);
      frameBody(camera, bodyProxy());
      camera.updateMatrixWorld(true);

      const feet = new THREE.Vector3(0, 0, 0.2).project(camera);
      const crown = new THREE.Vector3(0, 1.654, 0.2).project(camera);
      assert.ok(Math.abs(feet.y) <= 1, `her feet are off screen (${feet.y})`);
      assert.ok(Math.abs(crown.y) <= 1, `the top of her head is off screen (${crown.y})`);
      assert.ok(crown.y > feet.y, 'she is upside down');
      // Inside the near/far planes too — the old `far` of 10 was the kind of
      // constant that survives a reframe and clips the result.
      for (const point of [feet, crown]) {
        assert.ok(point.z > -1 && point.z < 1, `z ${point.z} outside the frustum`);
      }
    });
  }

  it('puts the camera in the SAME place at every aspect — a pane toggle cannot resize her', () => {
    const distances = ASPECTS.map(([, aspect]) => {
      const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 10);
      frameBody(camera, bodyProxy());
      return camera.position.z;
    });
    for (const distance of distances) {
      assert.equal(distance, distances[0]);
    }
  });

  it('fills the pane rather than sitting in it', () => {
    const camera = new THREE.PerspectiveCamera(38, 0.5, 0.1, 10);
    frameBody(camera, bodyProxy());
    camera.updateMatrixWorld(true);
    // Her toes are the tightest feature — front face, bottom edge — so they
    // are the ones that carry the fill. Anything at the centre plane sits a
    // few percent inside it.
    const toes = new THREE.Vector3(0, 0, 0.208).project(camera);
    assert.ok(Math.abs(toes.y) > 0.95, `she is small in frame (${toes.y})`);
    assert.ok(Math.abs(toes.y) <= TARGET_FILL + 1e-3, `she overflows (${toes.y})`);
  });

  it('is a no-op on an empty object rather than a NaN camera', () => {
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10);
    camera.position.set(0, 1.45, 1.15);
    frameBody(camera, new THREE.Group());
    assert.deepEqual(camera.position.toArray(), [0, 1.45, 1.15]);
  });
});
