/**
 * The tier policy is the difference between "supports the top tier" and
 * "renders the top tier for four seconds and then throttles", so every rule
 * that governs the ladder is asserted here rather than discovered on a device.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §6, §10.4
 * SOT-KEYWORDS: tiers test demotion adapter limits fallback storage buffers ema warmup
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_DEMOTION,
  REBAKED_HEAD_BUDGET,
  TIERS,
  TIER_PROFILES,
  canComputeHead,
  createTierWatcher,
  selectTier,
  tierBelow,
  type AdapterFacts,
} from './tiers.ts';

const spec = (over: Partial<AdapterFacts['limits']> = {}): AdapterFacts => ({
  isFallbackAdapter: false,
  limits: {
    // WebGPU spec defaults — what a mobile adapter typically reports.
    maxStorageBuffersPerShaderStage: 8,
    maxStorageBufferBindingSize: 134_217_728,
    maxBufferSize: 268_435_456,
    ...over,
  },
});

describe('selectTier', () => {
  it('falls hard to presence-2d with no adapter at all', () => {
    assert.equal(selectTier(null, 'desktop'), 'presence-2d');
  });

  it('falls hard to presence-2d on a software adapter, whatever the device', () => {
    const software: AdapterFacts = { ...spec(), isFallbackAdapter: true };
    for (const cls of ['phone', 'tablet', 'desktop', 'headset'] as const) {
      assert.equal(selectTier(software, cls), 'presence-2d', cls);
    }
  });

  it('gives each device class its tier on a spec-default adapter', () => {
    assert.equal(selectTier(spec(), 'phone'), 'phone');
    assert.equal(selectTier(spec(), 'tablet'), 'tablet');
    assert.equal(selectTier(spec(), 'desktop'), 'studio');
    assert.equal(selectTier(spec(), 'headset'), 'studio');
  });

  it('drops a capable device to the CPU-head tier when compute will not fit', () => {
    // 6 < the kernel's 7 storage buffers. The GPU is real; the path is not.
    const tight = spec({ maxStorageBuffersPerShaderStage: 6 });
    assert.equal(selectTier(tight, 'desktop'), 'phone');
    assert.equal(TIER_PROFILES.phone.computeHead, false);
  });
});

describe('canComputeHead', () => {
  it('accepts the spec defaults for the rebaked container', () => {
    assert.equal(canComputeHead(spec()), true);
  });

  it('is decided by the storage-buffer count, not the byte limits', () => {
    // The rebake made bytes a formality: 1.0 MB against a 128 MiB default.
    assert.ok(REBAKED_HEAD_BUDGET.largestBindingBytes < 2_000_000);
    assert.equal(canComputeHead(spec({ maxStorageBuffersPerShaderStage: 7 })), true);
    assert.equal(canComputeHead(spec({ maxStorageBuffersPerShaderStage: 6 })), false);
  });

  it('refuses an adapter that cannot bind the basis', () => {
    assert.equal(canComputeHead(spec({ maxStorageBufferBindingSize: 1024 })), false);
    assert.equal(canComputeHead(spec({ maxBufferSize: 1024 })), false);
  });

  it('would refuse the AUTHORING container on a default adapter budget', () => {
    // 20.5 MB still fits the byte limit — the point of the rebake was never
    // that the old basis could not bind, it was the 34.9 MB download.
    const authoring = { largestBindingBytes: 20_476_329, storageBuffers: 7 };
    assert.equal(canComputeHead(spec(), authoring), true);
    assert.equal(
      canComputeHead(spec({ maxStorageBufferBindingSize: 16_000_000 }), authoring),
      false,
      'an adapter reporting a smaller binding limit is where it bites'
    );
  });
});

describe('the ladder', () => {
  it('is ordered worst to best and bottoms out at presence-2d', () => {
    assert.deepEqual([...TIERS], ['presence-2d', 'phone', 'tablet', 'studio']);
    assert.equal(tierBelow('studio'), 'tablet');
    assert.equal(tierBelow('tablet'), 'phone');
    assert.equal(tierBelow('phone'), 'presence-2d');
    assert.equal(tierBelow('presence-2d'), 'presence-2d');
  });

  it('every tier below studio drops at least one cost', () => {
    const s = TIER_PROFILES.studio;
    const t = TIER_PROFILES.tablet;
    const p = TIER_PROFILES.phone;
    assert.equal(s.ambientOcclusion && !t.ambientOcclusion, true);
    assert.equal(t.bloom && !p.bloom, true);
    assert.equal(p.samples, 0);
    assert.equal(TIER_PROFILES['presence-2d'].hair, 'none');
  });
});

describe('demotion', () => {
  const run = (frameMs: number, frames: number, start = 'studio' as const) => {
    const w = createTierWatcher(start);
    for (let i = 0; i < frames; ++i) w.frame(frameMs);
    return w;
  };

  it('ignores the warmup window — shader compilation is not the steady state', () => {
    const w = createTierWatcher('studio');
    for (let i = 0; i < DEFAULT_DEMOTION.warmupFrames; ++i) w.frame(200);
    assert.equal(w.tier, 'studio');
    assert.equal(w.frameMs, 0, 'no sample is recorded during warmup');
  });

  it('holds the tier when the budget is met', () => {
    const w = run(12, 2000);
    assert.equal(w.tier, 'studio');
    assert.equal(w.demotions, 0);
  });

  it('demotes under sustained over-budget frames', () => {
    const w = run(40, 400);
    assert.notEqual(w.tier, 'studio');
    assert.ok(w.demotions >= 1);
  });

  it('walks all the way to presence-2d if the device never recovers', () => {
    const w = run(120, 4000);
    assert.equal(w.tier, 'presence-2d');
    assert.equal(w.demotions, 3, 'studio → tablet → phone → presence-2d');
  });

  it('stops at presence-2d and demotes no further', () => {
    const w = run(500, 8000);
    assert.equal(w.tier, 'presence-2d');
    assert.equal(w.demotions, 3);
  });

  it('never promotes back up — a quality flip mid-lesson is worse than one low tier', () => {
    const w = createTierWatcher('studio');
    for (let i = 0; i < 400; ++i) w.frame(40);
    const demoted = w.tier;
    assert.notEqual(demoted, 'studio');
    for (let i = 0; i < 5000; ++i) w.frame(4);
    assert.equal(w.tier, demoted, 'a recovered device keeps the tier it earned');
  });

  it('does not demote twice on one bad patch — the cooldown holds', () => {
    const w = createTierWatcher('studio');
    // Just enough over-budget frames for one demotion plus the cooldown.
    for (let i = 0; i < DEFAULT_DEMOTION.warmupFrames + DEFAULT_DEMOTION.strikes + 5; ++i) {
      w.frame(40);
    }
    assert.equal(w.demotions, 1);
    for (let i = 0; i < DEFAULT_DEMOTION.cooldownFrames - 10; ++i) w.frame(40);
    assert.equal(w.demotions, 1, 'the cooldown must swallow the rest of the patch');
  });

  it('a brief spike does not demote', () => {
    const w = createTierWatcher('studio');
    for (let i = 0; i < 200; ++i) w.frame(10);
    for (let i = 0; i < 5; ++i) w.frame(90); // one dropped-frame hiccup
    for (let i = 0; i < 200; ++i) w.frame(10);
    assert.equal(w.tier, 'studio');
    assert.equal(w.demotions, 0);
  });
});
