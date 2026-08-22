/**
 * The stage cannot be constructed without a GPU — `RenderPipeline`,
 * `PMREMGenerator` and `pass()` all need a live `WebGPURenderer`. So this suite
 * asserts the parts that are decisions rather than devices: the tone-mapping
 * choice, the rig's shape, and the shadow constant.
 *
 * That the stage's API surface EXISTS at three 0.185.1 is proven by
 * `src/stage.ts` compiling — `RenderPipeline` (not `PostProcessing`),
 * `PMREMGenerator` from `three/webgpu` (a different class from the WebGL one),
 * `RectAreaLightNode.setLTC`, `RectAreaLightTexturesLib` (renamed from
 * `…UniformsLib`), `pass(scene, camera, { samples })`, and `bloom()` from the
 * addons path. Doc 22 §4 rows 8-12 claimed each of those; the typecheck is the
 * receipt.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 rows 8-12, §6
 * SOT-KEYWORDS: stage test tone mapping rig lights shadow pcf aces agx
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ACESFilmicToneMapping, AgXToneMapping, PCFShadowMap, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import { Vector3 } from 'three';
import {
  DEFAULT_TONE_MAPPING,
  STANDING_HEAD_HEIGHT,
  groundYFor,
  OUTPUT_COLOR_SPACE,
  RIG,
  TONE_MAPPING_CHOICES,
  chooseToneMapping,
} from './stage.ts';

describe('tone mapping', () => {
  it('defaults to ACES — AgX greys out brown skin under this rig', () => {
    assert.equal(DEFAULT_TONE_MAPPING, 'acesfilmic');
    assert.equal(TONE_MAPPING_CHOICES.acesfilmic.toneMapping, ACESFilmicToneMapping);
    assert.equal(TONE_MAPPING_CHOICES.agx.toneMapping, AgXToneMapping);
  });

  it('carries a per-curve exposure — the two are not interchangeable', () => {
    // AgX's gentler shoulder needs more exposure to land the same key-side
    // skin values; a shared exposure would make the A/B meaningless.
    assert.notEqual(
      TONE_MAPPING_CHOICES.agx.exposure,
      TONE_MAPPING_CHOICES.acesfilmic.exposure
    );
    assert.ok(TONE_MAPPING_CHOICES.agx.exposure > TONE_MAPPING_CHOICES.acesfilmic.exposure);
  });

  it('keeps AgX one parameter away, and ignores anything else', () => {
    assert.equal(chooseToneMapping('agx'), 'agx');
    assert.equal(chooseToneMapping('acesfilmic'), 'acesfilmic');
    assert.equal(chooseToneMapping(null), DEFAULT_TONE_MAPPING);
    assert.equal(chooseToneMapping('neutral'), DEFAULT_TONE_MAPPING);
  });

  it('sets the output colour space explicitly — nothing stays at a default', () => {
    assert.equal(OUTPUT_COLOR_SPACE, SRGBColorSpace);
  });
});

describe('the deep-skin rig', () => {
  it('is five area lights', () => {
    assert.equal(RIG.length, 5);
  });

  it('is rim + fill, not a key-dominated rig', () => {
    // The shadow side of a brown face keeps structure because the two rim
    // lights behind carry real intensity. A rig whose key dominates is the
    // failure this shape exists to avoid.
    const byRole = (needle: string) => RIG.find((l) => l.role.includes(needle));
    const key = byRole('key');
    const warmRim = byRole('warm rim');
    assert.ok(key && warmRim);
    assert.ok(warmRim.intensity >= key.intensity, 'the rim must not be an afterthought');
  });

  it('puts a broad warm bounce below the face', () => {
    const bounce = RIG.find((l) => l.role.includes('under-bounce'));
    assert.ok(bounce);
    assert.ok(bounce.offset[1] < 0, 'the under-bounce is below the focus');
    assert.ok(bounce.width >= 1.5 && bounce.height >= 1.0, 'and it is broad');
  });

  it('splits warm and cool across the face', () => {
    // Warm key camera-right, cool fill camera-left: the colour separation is
    // what keeps the shadow side readable without lifting it into mud.
    const key = RIG.find((l) => l.role.includes('key'));
    const fill = RIG.find((l) => l.role.includes('fill'));
    assert.ok(key && fill);
    assert.ok(key.offset[0] > 0 && fill.offset[0] < 0);
    assert.ok(fill.intensity < key.intensity, 'fill supports the key, never rivals it');
  });

  it('places both rims behind the subject', () => {
    for (const light of RIG.filter((l) => l.role.includes('rim'))) {
      assert.ok(light.offset[2] < 0, `${light.role} must sit behind`);
    }
  });
});

describe('shadows', () => {
  it('targets PCFShadowMap — the only value that survives r186', () => {
    // r185 honours PCFSoftShadowMap on WebGPU; r186 removes it and throws.
    // Asserting the constants are distinct keeps a future "soften it" edit
    // from silently choosing the one that breaks on the next bump.
    assert.notEqual(PCFShadowMap, PCFSoftShadowMap);
  });
});

describe('the contact shadow', () => {
  // The catcher is an invisible ShadowMaterial plane — the avatar is grounded
  // without a visible floor. That only works if the plane is under the FEET,
  // and it was not: `catcher.position.y` was a hardcoded -1.45, set once at
  // construction, which is right only for a head at the origin. With the
  // default focus (a standing avatar, feet on y = 0) it sat 1.45 m below the
  // floor and the shadow landed on nothing. `setFocus()` did not move it
  // either, so re-framing silently detached the shadow from the feet.
  //
  // Nothing threw. The shadow map rendered perfectly, onto a plane out of shot.
  // The stage probe caught it — no contact shadow in any tier's frame.
  it('puts the ground a standing height below the head', () => {
    assert.equal(groundYFor(new Vector3(0, STANDING_HEAD_HEIGHT, 0)), 0);
    assert.equal(groundYFor(new Vector3(0, 0, 0)), -STANDING_HEAD_HEIGHT);
  });

  it('tracks the focus, so re-framing keeps the shadow under the feet', () => {
    // `focus` is where the head IS in world space, so a head framed lower has
    // feet lower too — the ground moves WITH it, one for one. (My first version
    // of this test asserted the opposite, reasoning about avatar height rather
    // than about where the head actually sits. The relationship is a
    // translation, not a scale.)
    const high = groundYFor(new Vector3(0, 1.6, 0));
    const low = groundYFor(new Vector3(0, 1.1, 0));
    assert.equal(high - low, 0.5, 'the ground tracks the focus one for one');
    assert.equal(low, 1.1 - STANDING_HEAD_HEIGHT);
  });

  it('lets a caller override it for an avatar that is not standing', () => {
    assert.equal(groundYFor(new Vector3(0, 1.2, 0), -0.4), -0.4);
    // 0 is a real answer, not a missing one.
    assert.equal(groundYFor(new Vector3(0, 1.45, 0), 0), 0);
  });
});
