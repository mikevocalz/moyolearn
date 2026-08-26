// The recording capabilities are gated by whether their handler was supplied.
//
// That is the whole mechanism — `record-media.web` supplies neither handler, so
// `isEnabled` drops both buttons on web. It is worth a test because the failure
// is invisible: a capability whose handler is missing but whose `isEnabled` does
// not check for it renders a button that silently does nothing when tapped,
// which is exactly what shipped for `recordAudio` until now.
// SOT: packages/app/features/editor/record-media.ts
// SOT-KEYWORDS: recording gate capability isEnabled platform web native audio video test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CAPABILITIES } from './capabilities.ts';
import type { Capability, CapabilityContext } from './capabilities.ts';

/*
  Widened to `Capability` on the way out. The registry is `as const satisfies`,
  so its members keep their literal types and only some of them declare
  `isEnabled` — the same widening the toolbar gets for free by iterating a typed
  list. Reading the field off the raw union does not compile.
*/
const capability = (id: string): Capability => {
  const found: readonly Capability[] = CAPABILITIES;
  const match = found.find((c) => c.id === id);
  assert.ok(match, `no "${id}" capability — the registry changed, not the gate`);
  return match;
};

/** A context with neither recorder, as `record-media.web` produces. */
const web = { editor: {} } as unknown as CapabilityContext;

/** A context with both, as `record-media.native` produces. */
const native = {
  editor: {},
  recordAudio: async () => null,
  recordVideo: async () => null,
} as unknown as CapabilityContext;

describe('recording capabilities are gated by their handler', () => {
  it('hides the video note where no recorder was supplied', () => {
    assert.equal(capability('video').isEnabled?.(web), false);
  });

  it('hides the voice note where no recorder was supplied', () => {
    assert.equal(capability('audio').isEnabled?.(web), false);
  });

  it('shows both where the handlers exist', () => {
    assert.equal(capability('video').isEnabled?.(native), true);
    assert.equal(capability('audio').isEnabled?.(native), true);
  });

  it('names an icon the kit actually exports', async () => {
    /*
      The registry stores icon NAMES, and a name with no matching export used to
      throw only when the toolbar rendered — taking the toolbar down with it.
      `IconName` now catches that at compile time; this asserts the same thing at
      runtime so the guard cannot be quietly widened back to `string`.
    */
    const icons = await import('@acme/ui/icons');
    for (const c of CAPABILITIES) {
      assert.ok(c.icon in icons, `capability "${c.id}" names a missing icon "${c.icon}"`);
    }
  });
});
