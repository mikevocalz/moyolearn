/**
 * The capability manager and the dev controls — doc 22 §4 rows 16-17.
 *
 * The assertion worth having here is the `.glb` one. An embedded-image `.glb`
 * loads perfectly on a laptop and fails only on device, only in Hermes, only at
 * runtime — the worst possible failure shape. Encoding the rule as a manifest
 * check means it fails in CI on the commit that adds the asset, which is the
 * whole point of having a manifest.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §3, §4 rows 16-17
 * SOT-KEYWORDS: assets test manifest glb hermes integrity sha256 tier controls orbit damping
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  REQUIRED_RN_GLOBALS,
  assertLoadableInReactNative,
  assetsForTier,
  downloadBytesForTier,
  resolveAssets,
  tierMeets,
  validateManifest,
} from './assets.ts';
import type { AssetEntry, AssetHost, AssetManifest } from './assets.ts';
import { sha256Hex } from './crypto/sha256.ts';
import { DEFAULT_ORBIT_LIMITS, createOrbitControls } from './controls.ts';

const bodies = {
  clean: { images: 0, textures: 0, materials: 0 },
  textured: { images: 2, textures: 2, materials: 1 },
};

function manifestOf(assets: AssetManifest['assets']): AssetManifest {
  return { version: 1, baseUrl: 'https://cdn.example/avatar/v1/', assets };
}

const HEAD_BYTES = new Uint8Array([1, 2, 3, 4, 5]);
const HEAD_SHA = sha256Hex(HEAD_BYTES);

function baseManifest(): AssetManifest {
  return manifestOf([
    { id: 'gnm-head', kind: 'gnm-head', path: 'head.gnmw', bytes: 5, sha256: HEAD_SHA },
    {
      id: 'body',
      kind: 'body-glb',
      path: 'smplx_female_headless.glb',
      bytes: 5,
      sha256: HEAD_SHA,
      declares: bodies.clean,
    },
    {
      id: 'lash-strands',
      kind: 'texture',
      path: 'lash-strands.png',
      bytes: 5,
      sha256: HEAD_SHA,
      minTier: 'tablet',
    },
  ]);
}

/** An in-memory host — the injection point that keeps expo-file-system out of this package. */
function memoryHost(bytes = HEAD_BYTES) {
  const cache = new Map<string, Uint8Array>();
  const downloads: string[] = [];
  let corruptNext = false;
  const host: AssetHost = {
    async cachedUri(id) {
      return cache.has(id) ? `file:///cache/${id}` : null;
    },
    async download(url, id) {
      downloads.push(url);
      cache.set(id, corruptNext ? new Uint8Array([9, 9, 9]) : bytes);
      corruptNext = false;
      return `file:///cache/${id}`;
    },
    async read(uri) {
      const id = uri.replace('file:///cache/', '');
      const found = cache.get(id) ?? new Uint8Array();
      return found.buffer.slice(found.byteOffset, found.byteOffset + found.byteLength) as ArrayBuffer;
    },
    async evict(id) {
      cache.delete(id);
    },
  };
  return {
    host,
    downloads,
    corruptOnce() {
      corruptNext = true;
    },
  };
}

describe('the .glb rule (row 17)', () => {
  it('rejects a .glb that declares embedded images', () => {
    assert.throws(
      () =>
        assertLoadableInReactNative({
          id: 'body',
          kind: 'body-glb',
          path: 'b.glb',
          bytes: 1,
          sha256: HEAD_SHA,
          declares: bodies.textured,
        }),
      // The message must say what to do, not just that it failed.
      /split \.gltf/
    );
  });

  it('refuses a .glb that does not declare its counts at all', () => {
    // "I did not measure it" is not the same as "it has none", and treating it
    // as such is how the trap gets back in.
    assert.throws(
      () =>
        assertLoadableInReactNative({
          id: 'body',
          kind: 'body-glb',
          path: 'b.glb',
          bytes: 1,
          sha256: HEAD_SHA,
        }),
      /must declare/
    );
  });

  it('accepts our texture-free bodies, and ignores non-glb kinds', () => {
    assert.doesNotThrow(() =>
      assertLoadableInReactNative({
        id: 'body',
        kind: 'body-glb',
        path: 'b.glb',
        bytes: 1,
        sha256: HEAD_SHA,
        declares: bodies.clean,
      })
    );
    assert.doesNotThrow(() =>
      assertLoadableInReactNative({
        id: 'rig',
        kind: 'binary',
        path: 'rig.scf4',
        bytes: 1,
        sha256: HEAD_SHA,
      })
    );
  });
});

describe('the manifest', () => {
  it('validates ids, hashes and the glb rule together', () => {
    assert.doesNotThrow(() => validateManifest(baseManifest()));

    const dupes = baseManifest();
    dupes.assets.push({ ...(dupes.assets[0] as AssetEntry) });
    assert.throws(() => validateManifest(dupes), /duplicate asset id/);

    const badHash = baseManifest();
    (badHash.assets[0] as { sha256: string }).sha256 = 'ABC';
    assert.throws(() => validateManifest(badHash), /64 lowercase hex/);

    assert.throws(() => validateManifest({ ...baseManifest(), version: 2 }), /version 2/);
  });

  it('filters by tier, so a phone does not pay for studio assets', () => {
    const manifest = baseManifest();
    assert.equal(assetsForTier(manifest, 'phone').length, 2);
    assert.equal(assetsForTier(manifest, 'tablet').length, 3);
    assert.equal(assetsForTier(manifest, 'studio').length, 3);
    assert.ok(downloadBytesForTier(manifest, 'phone') < downloadBytesForTier(manifest, 'studio'));

    assert.equal(tierMeets('phone', undefined), true);
    assert.equal(tierMeets('phone', 'tablet'), false);
    assert.equal(tierMeets('studio', 'tablet'), true);
  });

  it('names the two globals the RN entry point must install', () => {
    // Written down here rather than in three GitHub issues.
    assert.ok(REQUIRED_RN_GLOBALS.some((g) => g.includes('fast-text-encoding')));
    assert.ok(REQUIRED_RN_GLOBALS.some((g) => g.includes('window.parent')));
  });
});

describe('resolving assets', () => {
  it('downloads what is missing and reuses what is cached', async () => {
    const { host, downloads } = memoryHost();
    const manifest = baseManifest();

    const first = await resolveAssets(manifest, 'phone', host);
    assert.equal(first.length, 2);
    assert.ok(first.every((r) => r.fetched));
    assert.equal(downloads.length, 2);
    assert.ok(downloads[0]?.startsWith('https://cdn.example/avatar/v1/'), 'absolute CDN URL');

    const second = await resolveAssets(manifest, 'phone', host);
    assert.ok(second.every((r) => !r.fetched), 'second run is cache-only');
    assert.equal(downloads.length, 2, 'and issues no new requests');
  });

  it('re-downloads once on a hash mismatch, then gives up', async () => {
    const { host, downloads, corruptOnce } = memoryHost();
    corruptOnce();
    // A truncated download is the common case, so one retry is worth it...
    const resolved = await resolveAssets(baseManifest(), 'phone', host);
    assert.equal(resolved.length, 2);
    assert.equal(downloads.length, 3, 'one corrupt + one retry + the second asset');

    // ...but a permanently wrong object must not loop on the user's data plan.
    const bad = memoryHost(new Uint8Array([7, 7]));
    await assert.rejects(
      () => resolveAssets(baseManifest(), 'phone', bad.host),
      /sha256 mismatch after re-download/
    );
    assert.equal(bad.downloads.length, 2, 'exactly two attempts, then stop');
  });

  it('fetches the siblings of a split .gltf', async () => {
    const { host, downloads } = memoryHost();
    const manifest = manifestOf([
      {
        id: 'props',
        kind: 'gltf',
        path: 'props/props.gltf',
        bytes: 5,
        sha256: HEAD_SHA,
        siblings: ['props/props.bin', 'props/wood.png'],
      },
    ]);
    await resolveAssets(manifest, 'phone', host);
    assert.equal(downloads.length, 3, 'the .gltf plus both siblings');
    assert.ok(downloads.some((u) => u.endsWith('props/props.bin')));
  });

  it('still verifies by default — the neck seam depends on it', async () => {
    // A silently truncated head container does not throw; it produces a head
    // joined to the body at the wrong angle. Verification is not optional.
    const { host } = memoryHost(new Uint8Array([7, 7]));
    await assert.rejects(() => resolveAssets(baseManifest(), 'phone', host));
    const relaxed = memoryHost(new Uint8Array([7, 7]));
    await assert.doesNotReject(() =>
      resolveAssets(baseManifest(), 'phone', relaxed.host, { verify: false })
    );
  });
});

describe('the dev orbit controls (row 16)', () => {
  const makeCamera = () => {
    const camera = new PerspectiveCamera(35, 1, 0.05, 20);
    camera.position.set(0, 1.5, 0.9);
    camera.updateMatrixWorld();
    return camera;
  };

  it('snaps rather than eases when the golden harness asks it to', () => {
    const camera = makeCamera();
    const controls = createOrbitControls(camera, { target: new Vector3(0, 1.5, 0) });
    controls.orbit(0.3, 0.1);
    // Damping drifts subpixels between runs, which is exactly the 0.4 % pixel
    // budget the golden diff polices — so the harness passes damped: false.
    controls.update(false);
    assert.equal(controls.settled(), true, 'one undamped update consumes everything');
  });

  it('eases to a stop instead of easing forever', () => {
    const camera = makeCamera();
    const controls = createOrbitControls(camera);
    controls.orbit(0.5, 0.2);
    assert.equal(controls.settled(), false);
    for (let i = 0; i < 500 && !controls.settled(); ++i) controls.update(true);
    // Without the epsilon snap this never terminates and the harness hangs.
    assert.equal(controls.settled(), true);
  });

  it('clamps to the authored framing box', () => {
    const camera = makeCamera();
    const controls = createOrbitControls(camera, { target: new Vector3(0, 1.5, 0) });
    for (let i = 0; i < 40; ++i) {
      controls.orbit(10, 10);
      controls.dolly(4);
      controls.update(false);
    }
    const distance = camera.position.distanceTo(controls.target);
    assert.ok(distance <= DEFAULT_ORBIT_LIMITS.maxDistance + 1e-6, `distance ${distance}`);
    assert.ok(distance >= DEFAULT_ORBIT_LIMITS.minDistance - 1e-6);
    // Never up the nose, never the bald spot.
    assert.ok(camera.position.y > controls.target.y - 2);
  });

  it('ignores a nonsense pinch instead of inverting the view', () => {
    const camera = makeCamera();
    const controls = createOrbitControls(camera);
    const before = camera.position.clone();
    controls.dolly(0);
    controls.dolly(-1);
    controls.update(false);
    assert.ok(camera.position.distanceTo(before) < 1e-6, 'scale <= 0 is dropped');
  });

  it('resets to the authored camera', () => {
    const camera = makeCamera();
    const controls = createOrbitControls(camera, { target: new Vector3(0, 1.5, 0) });
    const home = camera.position.clone();
    controls.orbit(0.6, 0.3);
    controls.pan(0.2, 0.2);
    controls.update(false);
    assert.ok(camera.position.distanceTo(home) > 1e-4);
    controls.reset();
    assert.ok(camera.position.distanceTo(home) < 1e-9);
    assert.equal(controls.settled(), true);
  });
});

describe('the shipped manifest', () => {
  // `assets/avatar-manifest.json` is generated by `tools/build_asset_manifest.mjs`
  // from the real baked artefacts and committed. These assert the two things a
  // generated file still needs a human to care about: that it is valid, and
  // that it has not quietly got expensive.
  const manifest = JSON.parse(
    readFileSync(new URL('../assets/avatar-manifest.json', import.meta.url), 'utf8')
  ) as AssetManifest;

  /**
   * The phone-tier download budget, in bytes.
   *
   * This is a POLICY number, not a technical limit. Doc 22 §3 keeps avatar
   * bytes out of the binary entirely, which means every one of them is a
   * download a child waits through on a family data plan. The reference's head
   * container alone was 34.9 MB; the rebake brought the whole phone tier to
   * about 2.5 MB. 4 MB leaves real headroom while making a regression — someone
   * adding a texture set to the base tier — a failing test rather than a
   * support ticket.
   */
  const PHONE_BUDGET_BYTES = 4 * 1024 * 1024;

  it('is valid against its own consumer', () => {
    assert.doesNotThrow(() => validateManifest(manifest));
    assert.ok(manifest.assets.length > 10);
  });

  it('keeps the phone tier inside the download budget', () => {
    const bytes = downloadBytesForTier(manifest, 'phone');
    assert.ok(
      bytes <= PHONE_BUDGET_BYTES,
      `phone tier is ${(bytes / 1024 / 1024).toFixed(2)} MB, budget is 4 MB`
    );
    // And it must not be trivially small either — an empty manifest would pass
    // a budget check and fail every device.
    assert.ok(bytes > 1024 * 1024, 'a phone still needs a head, a body and a seam');
  });

  it('ships the REBAKED head, not the authoring container', () => {
    const head = manifest.assets.find((a) => a.id === 'gnm-head');
    assert.ok(head, 'the manifest must contain a head');
    // 34.9 MB in, ~1.9 MB out. Anything near the original means someone pointed
    // the build at `gnm_head_web.bin` and the rebake silently stopped applying.
    assert.ok(head.bytes < 4 * 1024 * 1024, `head is ${head.bytes} bytes — is this the raw container?`);
    assert.match(head.path, /runtime/);
  });

  it('costs the phone tier nothing for grooming detail', () => {
    // Lashes, brow strands, the mouth cavity and the skin aux buffers are
    // invisible at phone framing and are real megabytes on a data plan.
    const phone = new Set(assetsForTier(manifest, 'phone').map((a) => a.id));
    for (const groomed of ['lash-strands', 'lash-lines', 'brow-strands', 'mouth-cavity', 'eye-aux']) {
      assert.equal(phone.has(groomed), false, `${groomed} must not be on the phone tier`);
    }
    assert.ok(phone.has('gnm-head') && phone.has('body-headless') && phone.has('neck-align'));
  });

  it('measured the body .glb rather than assuming it', () => {
    const body = manifest.assets.find((a) => a.id === 'body-headless');
    // The counts come from parsing the .glb's JSON chunk in the build script.
    // Hermes cannot decode an embedded image, and this is where that is caught.
    assert.deepEqual(body?.declares, { images: 0, textures: 0, materials: 0 });
  });
});
