/**
 * Denim, mouth and brow — asserted where a GPU is not required.
 *
 * What these tests CAN prove: that the TSL symbols the spec claimed exist do
 * exist and compose, that the reference's constants survived the port, and —
 * the load-bearing one — that each material's replacement seeding is still
 * *exact*. Row 6 and row 7 are only "low risk" because the reference materials
 * happen to have no diffuse map, no roughness map and no vertex colours; the
 * moment one gains any of those, `colorNode`/`roughnessNode` stop being drop-in
 * and start silently dropping a texture. Three tests below exist purely to make
 * that day fail out loud.
 *
 * What they CANNOT prove: the look. That needs the golden set and a device.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 rows 6-7
 * SOT-KEYWORDS: denim mouth brow test wear cavity tip-fade colornode roughnessnode opacitynode
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DENIM_PHASE_CHANNEL,
  GARMENT_REST_ATTRIBUTE,
  createDenimMaterial,
  createDenimUniforms,
  denimColorNode,
  denimRoughnessNode,
  seedPhase,
} from './denim.ts';
import {
  CAVITY_ATTRIBUTE,
  CAVITY_FLOOR,
  buildCavityAttribute,
  cavityColorNode,
  makeMouthMaterials,
} from './mouth.ts';
import {
  BROW_FADE_AMOUNT,
  BROW_FADE_START,
  BROW_TIP_ATTRIBUTE,
  browOpacityNode,
  createBrowMaterial,
} from './brow.ts';

const REGION = { minY: 0.02, height: 1.04 };

describe('denim (row 6)', () => {
  it('reads the REST position, which is what makes the wear pose-invariant', () => {
    // If this ever becomes 'position', the knee fade slides across the fabric
    // when the leg bends. It is the entire reason the attribute is baked.
    assert.equal(GARMENT_REST_ATTRIBUTE, 'garmentRestPosition');
  });

  it('drives both colour and roughness from the same material', () => {
    const denim = createDenimMaterial({ region: REGION, seed: 7 });
    assert.ok(denim.material.colorNode, 'wear + topstitch');
    assert.ok(denim.material.roughnessNode, 'abrasion smooths, seam roughens');
    denim.dispose();
  });

  it('has NO map and NO roughnessMap — the precondition for an exact port', () => {
    // `colorNode`/`roughnessNode` REPLACE the map seeding rather than following
    // it. That is only equivalent to the reference's <map_fragment> patch while
    // these slots are empty. Adding a diffuse or roughness map without also
    // multiplying it into the node would silently delete the texture.
    const denim = createDenimMaterial({ region: REGION });
    assert.equal(denim.material.map, null, 'add a map and you must edit denim.ts');
    assert.equal(denim.material.roughnessMap, null, 'same for roughness');
    denim.dispose();
  });

  it('keeps the reference indigo, sheen and roughness', () => {
    const denim = createDenimMaterial({ region: REGION });
    assert.equal(denim.material.color.getHex(), 0x101e3b);
    assert.equal(denim.material.roughness, 0.73);
    assert.equal(denim.material.metalness, 0);
    assert.equal(denim.material.sheen, 0.24);
    assert.equal(denim.material.sheenColor.getHex(), 0x6681a8);
    denim.dispose();
  });

  it('is deterministic in the stitch phase, and seed-separated', () => {
    // Same seed in, same phase out — this is what makes the golden set stable.
    assert.equal(seedPhase(7, DENIM_PHASE_CHANNEL), seedPhase(7, DENIM_PHASE_CHANNEL));
    assert.notEqual(seedPhase(7, DENIM_PHASE_CHANNEL), seedPhase(8, DENIM_PHASE_CHANNEL));
    // And the stitch channel is not one of the normal-map channels (0-3).
    assert.ok(DENIM_PHASE_CHANNEL > 3);
    const phase = seedPhase(7, DENIM_PHASE_CHANNEL);
    assert.ok(phase >= 0 && phase < 1, 'a phase, not an arbitrary hash');
  });

  it('exposes the region as uniforms, so one avatar rescale is three writes', () => {
    const uniforms = createDenimUniforms(REGION, 3);
    assert.equal(uniforms.minY.value, REGION.minY);
    assert.equal(uniforms.height.value, REGION.height);
    assert.equal(uniforms.phase.value, seedPhase(3, DENIM_PHASE_CHANNEL));
    // The nodes build without a renderer — the graph is well-formed.
    assert.ok(denimColorNode(uniforms));
    assert.ok(denimRoughnessNode(uniforms));
  });
});

describe('the mouth cavity (row 7)', () => {
  it('darkens to the reference floor', () => {
    assert.equal(CAVITY_FLOOR, 0.1);
    assert.ok(cavityColorNode());
  });

  it('builds a FULL-LENGTH attribute, inert outside the mouth', () => {
    const cavity = {
      identitySha256: 'x'.repeat(64),
      apertureZ: 0.09,
      backZ: 0.02,
      count: 3,
      indices: [1, 4, 5],
      depth: [0.25, 1, 0.5],
    };
    const attr = buildCavityAttribute(cavity, 8);
    assert.equal(attr.count, 8, 'head-length, so head and mouth share a layout');
    assert.equal(attr.itemSize, 1);
    // §4 row 2: a single-component 8-bit attribute cannot be bound on WebGPU.
    assert.ok(attr.array instanceof Float32Array, 'Float32Array, not Uint8Array');
    assert.equal(attr.getX(0), 0, 'inert outside the mouth');
    assert.equal(attr.getX(1), 0.25);
    assert.equal(attr.getX(4), 1);
    assert.equal(attr.getX(7), 0);
  });

  it('gives all three surfaces the cavity, and none of them vertex colours', () => {
    const mouth = makeMouthMaterials();
    for (const material of mouth.ordered()) {
      assert.ok(material.colorNode, `${material.name} must darken with depth`);
      // colorNode replaces <color_fragment>, which is where vertex colours are
      // applied. No vertexColors here, so the replacement is exact.
      assert.equal(material.vertexColors, false, `${material.name}: see mouth.ts header`);
      assert.equal(material.map, null);
    }
    assert.equal(CAVITY_ATTRIBUTE, 'aCavity');
    mouth.dispose();
  });

  it('keeps teeth off pure white', () => {
    const mouth = makeMouthMaterials();
    // 0xf2ead8, not 0xffffff. Pure white teeth read as dentures.
    assert.notEqual(mouth.teeth.color.getHex(), 0xffffff);
    assert.ok(mouth.teeth.roughness < mouth.gums.roughness, 'enamel is glossier than gum');
    mouth.dispose();
  });
});

describe('brow strands (row 7)', () => {
  it('fades the last 45% of the strand by 85%, leaving 15%', () => {
    assert.equal(BROW_FADE_START, 0.55);
    assert.equal(BROW_FADE_AMOUNT, 0.85);
    assert.equal(BROW_TIP_ATTRIBUTE, 'aTip');
    assert.ok(browOpacityNode());
  });

  it('is transparent and double-sided — both required for the fade to show', () => {
    const brow = createBrowMaterial();
    // opacityNode without transparent:true is a no-op on an opaque draw.
    assert.equal(brow.material.transparent, true);
    assert.equal(brow.material.side, 2 /* DoubleSide */);
    assert.ok(brow.material.opacityNode, 'the tip fade');
    brow.dispose();
  });

  it('keeps the brow off pure black and out of the environment', () => {
    const brow = createBrowMaterial();
    assert.notEqual(brow.material.color.getHex(), 0x000000);
    assert.ok(brow.material.envMapIntensity < 0.5, 'or the brows go wet-plastic');
    brow.dispose();
  });
});
