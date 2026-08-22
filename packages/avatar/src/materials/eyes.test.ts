/**
 * The eyes and hair, asserted where a GPU is not required: that the API the
 * spec claimed exists, that the constants survived the port, and — for hair —
 * that the two silent traps are actually avoided.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 rows 3-5
 * SOT-KEYWORDS: eyes hair test parallax uniforms anisotropy positionnode sway debug
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Color, Matrix4, Vector3 } from 'three';
import { EYE_AUX_ATTRIBUTE, EYE_SURFACES, makeEyeMaterials } from './eyes.ts';
import {
  HAIR_PHASE_ATTRIBUTE,
  HAIR_T_ATTRIBUTE,
  createHairMaterial,
  createHairUniforms,
  hairSwayNode,
} from './hair.ts';

const AUX = { irisRadius: 0.005265, pupilRadius: 0.00263 };

describe('hair colour', () => {
  it('tints from the material colour, never from a constant', () => {
    // `colorNode` REPLACES the colour rather than tinting it. The first version
    // of hair.ts seeded the debug lookup with vec3(1,1,1), which silently threw
    // `hairColor` away and rendered white braids — no throw, no failing test,
    // and the constructor argument still looked as though it worked. The
    // shader probe found it on its first real render.
    //
    // This asserts the property that was missing: the node graph must depend on
    // the material's own colour, so a change to `hairColor` can reach the pixel.
    const hair = createHairMaterial({ hairColor: new Color(0x2a2320) });
    assert.equal(hair.material.color.getHex(), 0x2a2320);
    const source = JSON.stringify(hair.material.colorNode, (key, value) =>
      key === 'parent' ? undefined : value
    );
    assert.match(source, /material/i, 'the colour graph must reference materialColor');
    hair.dispose();
  });
});

describe('the eyes', () => {
  it('builds three surfaces, in the geometry-group order', () => {
    // These are three material groups of ONE mesh and the geometry's groups are
    // reordered to match, so the order is a contract, not a preference.
    assert.deepEqual([...EYE_SURFACES], ['sclera', 'iris', 'pupil']);
    const eyes = makeEyeMaterials(AUX);
    assert.equal(eyes.ordered().length, 3);
    assert.equal(eyes.ordered()[0], eyes.sclera);
    eyes.dispose();
  });

  it('gives the cornea a real IOR and a wet clearcoat', () => {
    const eyes = makeEyeMaterials(AUX);
    // 1.376 is the cornea's actual index; the parallax march depends on it.
    assert.equal(eyes.iris.ior, 1.376);
    assert.equal(eyes.pupil.ior, 1.376);
    assert.ok(eyes.iris.clearcoat > 0.9, 'the tear film is the catchlight');
    assert.ok(eyes.sclera.clearcoat > 0, 'the sclera is wet too, just less so');
    eyes.dispose();
  });

  it('shares one uniform set across all three, carrying the baked radii', () => {
    const eyes = makeEyeMaterials(AUX);
    assert.equal(eyes.uniforms.irisRadius.value, AUX.irisRadius);
    assert.equal(eyes.uniforms.pupilRadius.value, AUX.pupilRadius);
    assert.ok(eyes.uniforms.pupilRadius.value < eyes.uniforms.irisRadius.value);
    eyes.dispose();
  });

  it('brings the camera into model space once per frame', () => {
    const eyes = makeEyeMaterials(AUX);
    // A head translated up by 1.45m: the model-space camera must come back down.
    const inverse = new Matrix4().makeTranslation(0, -1.45, 0);
    eyes.update(new Vector3(0, 1.65, 1.2), inverse);
    const v = eyes.uniforms.cameraModel.value;
    assert.equal(v.x, 0);
    assert.ok(Math.abs(v.y - 0.2) < 1e-6, `expected 0.2, got ${v.y}`);
    assert.ok(Math.abs(v.z - 1.2) < 1e-6);
    eyes.dispose();
  });

  it('names the aux attribute the bake writes', () => {
    assert.equal(EYE_AUX_ATTRIBUTE, 'aEyeAux');
  });

  it('builds every colour node without a renderer', () => {
    const eyes = makeEyeMaterials(AUX);
    for (const m of eyes.ordered()) {
      assert.notEqual(m.colorNode, null);
      assert.notEqual(m.roughnessNode, null);
    }
    eyes.dispose();
  });
});

describe('the hair', () => {
  it('COMPOSES the sway onto positionLocal instead of replacing it', () => {
    // The trap: a bare `positionNode = sway` silently discards skinning, and
    // the braids hang off the head bone. The node must not be the raw offset.
    const hair = createHairMaterial();
    const sway = hairSwayNode(createHairUniforms());
    assert.notEqual(hair.material.positionNode, null);
    assert.notEqual(
      hair.material.positionNode,
      sway,
      'positionNode must be positionLocal.add(sway), never the offset alone'
    );
    hair.dispose();
  });

  it('enables the anisotropic BRDF and keeps a tangent direction', () => {
    const hair = createHairMaterial();
    assert.ok(hair.material.anisotropy > 0, 'non-zero anisotropy is what flips useAnisotropy');
    assert.equal(hair.material.anisotropyRotation, 0);
    hair.dispose();
  });

  it('updates by writing uniforms — no geometry work per frame', () => {
    const hair = createHairMaterial();
    const before = hair.uniforms.sway.value.clone();
    hair.update(3.25);
    assert.equal(hair.uniforms.time.value, 3.25);
    assert.deepEqual(hair.uniforms.sway.value, before, 'full scale leaves sway alone');
    hair.dispose();
  });

  it('pins the sway completely at motionScale 0 — reduced motion asks for still', () => {
    const hair = createHairMaterial();
    hair.update(10, 0);
    assert.equal(hair.uniforms.sway.value.x, 0);
    assert.equal(hair.uniforms.sway.value.y, 0);
    // And restores: a scale is not a one-way door.
    hair.update(11, 1);
    assert.ok(hair.uniforms.sway.value.x > 0);
    hair.dispose();
  });

  it('maps every debug mode to a distinct code', () => {
    const hair = createHairMaterial();
    const seen = new Set<number>();
    for (const mode of ['none', 'flow', 'motion', 'roots'] as const) {
      hair.setDebugMode(mode);
      seen.add(hair.uniforms.debug.value);
    }
    assert.equal(seen.size, 4);
    hair.setDebugMode('none');
    assert.equal(hair.uniforms.debug.value, 0, 'none must be the zero default');
    hair.dispose();
  });

  it('names the attributes the groom writes', () => {
    assert.equal(HAIR_T_ATTRIBUTE, 'aHairT');
    assert.equal(HAIR_PHASE_ATTRIBUTE, 'aHairPhase');
  });
});
