/**
 * Layer one under the live presence — the clip base behind `setBaseClip`,
 * held to the same gates as the standalone player PLUS the composition
 * claims: eyes attached with a clip base, breath still modulating on top,
 * and a cross-fade that never snaps a bone at entry or exit.
 *
 * Runs on the REAL glTF hierarchy (the synthetic flat scene cannot express
 * the two-chain or planted-foot failures), against the same regenerated clip
 * the player suite uses — absent, it SKIPS loudly, never passes vacuously.
 *
 * SOT: ./humano.ts (setBaseClip) · ./clip-player.test.ts (the gates)
 * SOT-KEYWORDS: blend layer one clip base test eyes breath cross fade snap contact gate
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { IdleEngine, type IdleInputs } from '../idle/engine.ts';
import { createClipPlayer, type RetargetedClip } from './clip-player.ts';
import { createHumanoPresence, type HumanoInput } from './humano.ts';

const CLIP_PATH = process.env.CLIP_PATH ?? '/tmp/staystill_wei_lr.clip.json';

const QUIET: HumanoInput = { speaking: false, mouth: 0, reducedMotion: false };

function buildRealScene(): { root: THREE.Group; byName: Map<string, THREE.Bone> } {
  const gltf = JSON.parse(
    readFileSync(new URL('../../assets/natalie-phone/natalie.gltf', import.meta.url), 'utf8'),
  ) as { nodes: { name: string; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[] };
  const bones = gltf.nodes.map((node) => {
    const bone = new THREE.Bone();
    bone.name = node.name;
    if (node.translation) bone.position.fromArray(node.translation);
    if (node.rotation) bone.quaternion.fromArray(node.rotation as [number, number, number, number]);
    if (node.scale) bone.scale.fromArray(node.scale);
    return bone;
  });
  const root = new THREE.Group();
  const hasParent = new Set<number>();
  gltf.nodes.forEach((node, i) => {
    for (const child of node.children ?? []) {
      bones[i]!.add(bones[child]!);
      hasParent.add(child);
    }
  });
  bones.forEach((bone, i) => {
    if (!hasParent.has(i)) root.add(bone);
  });
  root.updateMatrixWorld(true);
  return { root, byName: new Map(bones.map((bone) => [bone.name, bone])) };
}

describe('clip base under the live presence', { skip: !existsSync(CLIP_PATH) && 'run tools/retarget_staystill.mjs first' }, () => {
  const clip = existsSync(CLIP_PATH)
    ? (JSON.parse(readFileSync(CLIP_PATH, 'utf8')) as RetargetedClip)
    : null;

  it('keeps the eyes in the head with a clip base and quiet input', () => {
    const { root, byName } = buildRealScene();
    const presence = createHumanoPresence(root, { seed: 7 });
    const head = byName.get('DEF-spine.006')!;
    const eye = byName.get('DEF-eye.L')!;
    const inFrame = () => head.worldToLocal(eye.getWorldPosition(new THREE.Vector3()));
    root.updateMatrixWorld(true);
    const eyeRest = inFrame();
    presence.setBaseClip(clip!, 0);
    // Fade in fully before measuring; the entry itself is the cross-fade test.
    for (let i = 0; i < 60; i += 1) presence.step(1 / 60, QUIET);
    assert.equal(presence.clipBlend, 1);
    let worstEye = 0;
    const frames = Math.round((clip!.frames / clip!.fps) * 60);
    for (let i = 0; i < frames; i += 1) {
      presence.step(1 / 60, QUIET);
      root.updateMatrixWorld(true);
      worstEye = Math.max(worstEye, inFrame().distanceTo(eyeRest));
    }
    assert.ok(worstEye < 0.001, `eye drifted ${(worstEye * 1000).toFixed(2)} mm in the head frame`);
  });

  it('keeps marked planted toes pinned while the clip drives under the presence', () => {
    type Contacts = Record<'L' | 'R', readonly [number, number][]>;
    const contacts = (clip as RetargetedClip & { contacts?: Contacts }).contacts;
    assert.ok(contacts, 'clip carries no contact windows — regenerate with tools/retarget_staystill.mjs');
    let windows = 0;
    for (const side of ['L', 'R'] as const) {
      for (const [start, end] of contacts[side]) {
        if (end - start < 3) continue; // a 1-frame window measures nothing
        windows += 1;
        const { root, byName } = buildRealScene();
        const presence = createHumanoPresence(root, { seed: 7 });
        const toe = byName.get(`DEF-toe.${side}`)!;
        // One second of pre-roll so the fade (0.4 s) and the yielding stance
        // followers are fully settled when the window opens.
        presence.setBaseClip(clip!, start / clip!.fps - 1);
        for (let i = 0; i < 60; i += 1) presence.step(1 / 60, QUIET);
        root.updateMatrixWorld(true);
        const entry = toe.getWorldPosition(new THREE.Vector3());
        for (let f = start + 1; f <= end; f += 1) {
          presence.step(1 / clip!.fps, QUIET);
          root.updateMatrixWorld(true);
          const p = toe.getWorldPosition(new THREE.Vector3());
          const drift = Math.hypot(p.x - entry.x, p.z - entry.z);
          assert.ok(
            drift < 0.005,
            `${side} toe drifted ${(drift * 1000).toFixed(2)} mm at frame ${f} of contact window [${start}, ${end}]`,
          );
        }
      }
    }
    assert.ok(windows >= 3, `only ${windows} usable contact windows — the gate barely measured anything`);
  });

  it('breath still modulates the chest on top of the clip base', () => {
    // The observable is the presence-minus-pure-clip residual at the chest:
    // the clip's own motion subtracts out, what remains is the life layer.
    // Correlating that against the engine's own breath channel (same seed,
    // same inputs, deterministic) is what "modulates AT breath rate" means —
    // sway shares the residual, so a frequency count alone would be mush.
    const a = buildRealScene();
    const b = buildRealScene();
    const presence = createHumanoPresence(a.root, { seed: 7 });
    const player = createClipPlayer(b.root, clip!);
    const engine = new IdleEngine(7);
    const waiting: IdleInputs = {
      speechActive: false,
      speechGap: true,
      processing: false,
      partnerSpeaking: false,
      partnerPauseEvent: false,
      partnerF0Falling: false,
      timeUntilOnset: Infinity,
    };
    const chestA = a.byName.get('DEF-spine.003')!;
    const chestB = b.byName.get('DEF-spine.003')!;
    presence.setBaseClip(clip!, 0);
    const residual: number[] = [];
    const breath: number[] = [];
    const covariates: [number[], number[], number[]] = [[], [], []];
    const total = 60 * 31;
    for (let i = 0; i < total; i += 1) {
      presence.step(1 / 60, QUIET);
      const frame = engine.step(1 / 60, waiting);
      if (i < 60) continue; // past the fade
      player.apply((i + 1) / 60);
      a.root.updateMatrixWorld(true);
      b.root.updateMatrixWorld(true);
      residual.push(chestA.getWorldPosition(new THREE.Vector3()).y - chestB.getWorldPosition(new THREE.Vector3()).y);
      breath.push(frame.breathY);
      // The other life channels that share the residual — projected out below,
      // so the claim really is "the breath", not "something oscillates".
      covariates[0].push(frame.swayY);
      covariates[1].push(frame.swayX);
      covariates[2].push(frame.weightShift);
    }
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const center = (xs: number[]) => {
      const m = mean(xs);
      return xs.map((x) => x - m);
    };
    const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i]!, 0);
    const projOut = (x: number[], c: number[]) => {
      const k = dot(x, c) / dot(c, c);
      return x.map((v, i) => v - k * c[i]!);
    };
    let r = center(residual);
    let bth = center(breath);
    for (const cov of covariates.map(center)) {
      r = projOut(r, cov);
      bth = projOut(bth, cov);
    }
    // Partial correlation: sway in, it reads 0.35; sway out, 0.999. The bound
    // sits where only breath-shaped motion clears it.
    const corr = dot(r, bth) / Math.sqrt(dot(r, r) * dot(bth, bth));
    const span = Math.max(...residual) - Math.min(...residual);
    assert.ok(span > 0.0008, `chest residual spans ${(span * 1000).toFixed(2)} mm — no breath is reaching it`);
    assert.ok(corr > 0.9, `chest residual partial-correlates ${corr.toFixed(2)} with the breath channel — breath is not what moves it`);
  });

  it('never steps a bone more than the smooth bound at clip entry or exit', () => {
    const { root, byName } = buildRealScene();
    const presence = createHumanoPresence(root, { seed: 7 });
    const tracked = ['DEF-spine', 'DEF-spine.006', 'DEF-hand.L', 'DEF-hand.R', 'DEF-toe.L', 'DEF-eye.L'].map(
      (name) => byName.get(name)!,
    );
    root.updateMatrixWorld(true);
    const hip = byName.get('DEF-spine')!;
    const hipRestX = hip.getWorldPosition(new THREE.Vector3()).x;
    // Leave mid-clip where the root track is furthest from rest, so a snap
    // back to rest would be as large as this clip can make it.
    const xs = clip!.root.translation.map((p) => Math.abs(p[0]!));
    const exitS = xs.indexOf(Math.max(...xs)) / clip!.fps;
    // The presence's own first frame steps from the mannequin rest into the
    // stance pose — pre-existing, not the blend layer. Settle before measuring.
    for (let i = 0; i < 30; i += 1) presence.step(1 / 60, QUIET);
    root.updateMatrixWorld(true);
    const previous = tracked.map((bone) => bone.getWorldPosition(new THREE.Vector3()));
    let worstStep = 0;
    const measure = () => {
      root.updateMatrixWorld(true);
      tracked.forEach((bone, k) => {
        const p = bone.getWorldPosition(new THREE.Vector3());
        worstStep = Math.max(worstStep, p.distanceTo(previous[k]!));
        previous[k]!.copy(p);
      });
    };
    for (let i = 0; i < 30; i += 1) {
      presence.step(1 / 60, QUIET);
      measure();
    }
    presence.setBaseClip(clip!, 0);
    for (let i = 0; i < Math.round(exitS * 60); i += 1) {
      presence.step(1 / 60, QUIET);
      measure();
    }
    root.updateMatrixWorld(true);
    const displaced = Math.abs(hip.getWorldPosition(new THREE.Vector3()).x - hipRestX);
    presence.setBaseClip(null);
    for (let i = 0; i < 90; i += 1) {
      presence.step(1 / 60, QUIET);
      measure();
    }
    assert.equal(presence.clipBlend, 0);
    // Non-vacuous: at the exit the pose sat far enough from rest that a snap
    // would blow the bound by an order of magnitude.
    assert.ok(displaced > 0.1, `hip only ${(displaced * 100).toFixed(1)} cm from rest at exit — a snap would hide here`);
    assert.ok(
      worstStep < 0.035,
      `a bone stepped ${(worstStep * 1000).toFixed(1)} mm in one 60 fps frame — that is a snap, not a fade`,
    );
  });
});
