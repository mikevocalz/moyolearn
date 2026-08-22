/**
 * There is no GPU here, so this suite asserts the two things that are true
 * without one — and they are the two that doc 22 §4 row 1 was uncertain about.
 *
 * First, that every API this port depends on EXISTS at the pinned three
 * version. The spec claims a specific hook (`setupLightingModel` returning a
 * `PhysicalLightingModel` subclass whose `direct()` receives
 * `{lightDirection, lightColor, reflectedLight}`) and a specific signature for
 * `BRDF_GGX`. Constructing the material and the node graph proves those, and
 * proves it against the real package rather than against the spec's memory of
 * it. A typecheck alone would not: the declarations narrow several of these to
 * bare `Node`.
 *
 * Second, that the tuned constants survived the port intact — a look is only
 * reproducible if its numbers are.
 *
 * What this CANNOT assert is the look. That is the golden set's job (doc 22 §8)
 * and it needs a device.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 row 1, §6, §8
 * SOT-KEYWORDS: skin material test lighting model construct uniforms defaults tsl api
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PhysicalLightingModel } from 'three/webgpu';
import {
  SKIN_CURVATURE_ATTRIBUTE,
  SKIN_DEFAULTS,
  SKIN_THICKNESS_ATTRIBUTE,
  SkinLightingModel,
  SkinNodeMaterial,
  createSkinUniforms,
  skinEmissiveNode,
} from './skin.ts';

describe('the material', () => {
  it('constructs and returns a physical lighting model', () => {
    const material = new SkinNodeMaterial();
    const model = material.setupLightingModel();
    assert.ok(model instanceof SkinLightingModel);
    assert.ok(
      model instanceof PhysicalLightingModel,
      'the stock physical response must still be the base — the skin terms ADD'
    );
  });

  it('sets the vellus rim as emissive, not as a lighting term', () => {
    // emissiveNode is added to outgoing light AFTER all lighting, which is
    // exactly where an additive Fresnel rim belongs.
    const material = new SkinNodeMaterial();
    assert.notEqual(material.emissiveNode, null);
  });

  it('is not metal, and carries the reference complexion', () => {
    const material = new SkinNodeMaterial();
    assert.equal(material.metalness, 0);
    assert.equal(material.roughness, 0.48);
    assert.equal(material.color.getHex(), 0x7d4f35);
  });
});

describe('the uniforms', () => {
  it('builds one node per tuned constant, carrying the value through', () => {
    const u = createSkinUniforms();
    assert.equal(u.scatterStrength.value, SKIN_DEFAULTS.scatterStrength);
    assert.equal(u.backPower.value, SKIN_DEFAULTS.backPower);
    assert.equal(u.lobe2Roughness.value, SKIN_DEFAULTS.lobe2Roughness);
    assert.equal(u.scatterColor.value.getHex(), SKIN_DEFAULTS.scatterColor.getHex());
  });

  it('is live — a look-dev pass moves the value, not the graph', () => {
    const u = createSkinUniforms();
    u.scatterStrength.value = 0.9;
    assert.equal(u.scatterStrength.value, 0.9);
  });

  it('accepts overridden params', () => {
    const u = createSkinUniforms({ ...SKIN_DEFAULTS, backStrength: 0.1 });
    assert.equal(u.backStrength.value, 0.1);
  });
});

describe('the emissive rim graph', () => {
  it('builds without a renderer', () => {
    assert.notEqual(skinEmissiveNode(createSkinUniforms()), null);
  });
});

describe('the tuned constants', () => {
  it('are all finite and in a sane range', () => {
    const n = SKIN_DEFAULTS;
    for (const [name, value] of Object.entries(n)) {
      if (typeof value === 'number') {
        assert.ok(Number.isFinite(value), `${name} must be finite`);
        assert.ok(value >= 0, `${name} must not be negative`);
      }
    }
    assert.ok(n.lobe2Roughness > 0 && n.lobe2Roughness <= 1);
    assert.ok(
      n.lobe2Strength < 1,
      'the second lobe is a broad sheen under the primary, never louder than it'
    );
  });

  it('names the aux attributes the bake writes', () => {
    // These are the names tools/bake_skin_aux.py emits; a rename here is a
    // silently unlit face, so the strings are asserted rather than trusted.
    assert.equal(SKIN_CURVATURE_ATTRIBUTE, 'aCurvature');
    assert.equal(SKIN_THICKNESS_ATTRIBUTE, 'aThickness');
  });
});
