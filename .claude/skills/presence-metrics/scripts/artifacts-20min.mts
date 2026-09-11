// artifactsIn20MinCapture: pose resets, foot slides, eye detachments over 20
// simulated minutes on the REAL glTF bone hierarchy (built the way
// src/presence/feet.test.ts builds it), seed 7, quiet input, 60 Hz.
//
// Two passes:
//   A) no clip base — the presence alone.
//   B) a clip base cycling idle_19 → (5 s rest) → idle_21 → (5 s rest) →
//      wei_rl_45 → …, clips from `node tools/retarget_staystill.mjs
//      --all-curated` (/tmp/staystill_<take>.clip.json), so the CLIP_FADE_S
//      cross-fades and clip playback are covered.
//
// Detectors, per frame:
//   pose reset      any bone's LOCAL rotation jumping > 10° in one frame
//                   (angle between consecutive local quaternions).
//   foot slide      pass A and pass-B gaps (clipBlend 0): DEF-toe.L/R world
//                   horizontal drift from REST > 2 mm (the feet gate's bound).
//                   Pass B at clipBlend 1: drift from the toe's position at
//                   entry into a clip `contacts` window — rest-anchored drift
//                   would count the clip's own real foot repositions as slide.
//                   Mid-fade (0 < clipBlend < 1) the base is a mix and toe
//                   motion is fade motion; slide is not evaluated there.
//   eye detachment  DEF-eye.L/R position in the DEF-spine.006 (head) frame
//                   drifting > 1 mm from its rest offset.
//   self-intersection: NOT measured — no mesh/collision representation exists
//                   in this Node harness (bones only, no skinned geometry).
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createHumanoPresence } from '/Users/mikevocalz/MoyoLearn/packages/avatar/src/presence/humano.ts';
import type { RetargetedClip } from '/Users/mikevocalz/MoyoLearn/packages/avatar/src/presence/clip-player.ts';

const DT = 1 / 60;
const STEPS = 20 * 60 * 60; // 20 min
const POSE_RESET_RAD = (10 * Math.PI) / 180;
const SLIDE_M = 0.002;
const EYE_M = 0.001;

function buildRealScene() {
  const gltf = JSON.parse(
    readFileSync('/Users/mikevocalz/MoyoLearn/packages/avatar/assets/natalie-phone/natalie.gltf', 'utf8'),
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
  return { root, bones, byName: new Map(bones.map((bone) => [bone.name, bone])) };
}

interface ClipWithContacts extends RetargetedClip {
  contacts?: Record<'L' | 'R', [number, number][]>;
}

interface Counts {
  poseResetFrames: number;
  poseResetEvents: number;
  poseResetFadeFrames: number;
  maxStepDeg: number;
  maxStepBone: string;
  slideFrames: number;
  slideEvents: number;
  maxSlideMm: number;
  eyeFrames: number;
  eyeEvents: number;
  maxEyeMm: number;
  maxEyeAt: string;
  resetFirsts: string[];
  slideFirsts: string[];
  eyeFirsts: string[];
}

function run(clips: ClipWithContacts[] | null): Counts {
  const { root, bones, byName } = buildRealScene();
  const presence = createHumanoPresence(root, { seed: 7 });
  const toes = [byName.get('DEF-toe.L')!, byName.get('DEF-toe.R')!];
  const eyes = [byName.get('DEF-eye.L')!, byName.get('DEF-eye.R')!];
  const head = byName.get('DEF-spine.006')!;
  root.updateMatrixWorld(true);

  const toeRest = toes.map((t) => t.getWorldPosition(new THREE.Vector3()));
  const headInv = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const eyeRestInHead = eyes.map((e) => {
    headInv.copy(head.matrixWorld).invert();
    return e.getWorldPosition(new THREE.Vector3()).applyMatrix4(headInv);
  });

  const prevQ = bones.map((b) => b.quaternion.clone());
  const c: Counts = {
    poseResetFrames: 0, poseResetEvents: 0, poseResetFadeFrames: 0,
    maxStepDeg: 0, maxStepBone: '',
    slideFrames: 0, slideEvents: 0, maxSlideMm: 0,
    eyeFrames: 0, eyeEvents: 0, maxEyeMm: 0, maxEyeAt: '', resetFirsts: [], slideFirsts: [], eyeFirsts: [],
  };
  let inReset = false, inSlide = false, inEye = false;

  // clip sequencing state
  let clipIdx = -1;
  let phase: 'clip' | 'gap' = 'gap';
  let phaseLeft = clips ? 1 : Infinity; // start a clip on the first step
  let clipStep = 0;
  let clip: ClipWithContacts | null = null;
  // per-foot contact-window anchor: window index and entry position
  const anchor: ({ win: number; pos: THREE.Vector3 } | null)[] = [null, null];

  const input = { speaking: false, mouth: 0, reducedMotion: false } as const;

  for (let i = 0; i < STEPS; i += 1) {
    if (clips) {
      phaseLeft -= 1;
      if (phaseLeft <= 0) {
        if (phase === 'gap') {
          clipIdx = (clipIdx + 1) % clips.length;
          clip = clips[clipIdx]!;
          presence.setBaseClip(clip, 0);
          phase = 'clip';
          clipStep = 0;
          phaseLeft = Math.floor((clip.frames / clip.fps) * 60);
        } else {
          presence.setBaseClip(null);
          clip = null;
          phase = 'gap';
          phaseLeft = 5 * 60;
        }
        anchor[0] = anchor[1] = null;
      }
    }

    presence.step(DT, input);
    if (phase === 'clip') clipStep += 1;
    root.updateMatrixWorld(true);
    const t = i * DT;
    const blend = presence.clipBlend;
    const fading = blend > 0 && blend < 1;

    // pose reset
    let frameHasReset = false;
    for (let k = 0; k < bones.length; k += 1) {
      const q = bones[k]!.quaternion;
      const p = prevQ[k]!;
      const dot = Math.min(1, Math.abs(q.x * p.x + q.y * p.y + q.z * p.z + q.w * p.w));
      const ang = 2 * Math.acos(dot);
      if (ang > c.maxStepDeg * (Math.PI / 180)) {
        c.maxStepDeg = (ang * 180) / Math.PI;
        c.maxStepBone = `${bones[k]!.name} @t=${t.toFixed(2)}s blend=${blend.toFixed(3)} ${phase}${clip ? ' ' + clip.source : ''}`;
      }
      if (ang > POSE_RESET_RAD) {
        if (!frameHasReset && c.resetFirsts.length < 24) c.resetFirsts.push(`t=${t.toFixed(2)}s reset ${bones[k]!.name} ${((ang * 180) / Math.PI).toFixed(1)}° blend=${blend.toFixed(3)} phase=${phase}${clip ? ' ' + clip.source : ''}`);
        frameHasReset = true;
      }
      p.copy(q);
    }
    if (frameHasReset) {
      c.poseResetFrames += 1;
      if (fading) c.poseResetFadeFrames += 1;
      if (!inReset) c.poseResetEvents += 1;
    }
    inReset = frameHasReset;

    // foot slide
    let frameHasSlide = false;
    if (!clips || blend === 0) {
      toes.forEach((toe, k) => {
        toe.getWorldPosition(v).sub(toeRest[k]!);
        const d = Math.hypot(v.x, v.z);
        if (d * 1000 > c.maxSlideMm) c.maxSlideMm = d * 1000;
        if (d > SLIDE_M) {
          frameHasSlide = true;
          if (!inSlide && c.slideFirsts.length < 12) c.slideFirsts.push(`t=${t.toFixed(2)}s slide toe${k === 0 ? 'L' : 'R'} ${(d * 1000).toFixed(2)}mm`);
        }
      });
    } else if (clip && blend === 1) {
      const srcFrame = (clipStep / 60) * clip.fps;
      (['L', 'R'] as const).forEach((side, k) => {
        const wins = clip!.contacts?.[side] ?? [];
        const wi = wins.findIndex(([s, e]) => srcFrame >= s && srcFrame <= e);
        if (wi < 0) { anchor[k] = null; return; }
        const toe = toes[k]!;
        if (!anchor[k] || anchor[k]!.win !== wi) {
          anchor[k] = { win: wi, pos: toe.getWorldPosition(new THREE.Vector3()) };
          return;
        }
        toe.getWorldPosition(v).sub(anchor[k]!.pos);
        const d = Math.hypot(v.x, v.z);
        if (d * 1000 > c.maxSlideMm) c.maxSlideMm = d * 1000;
        if (d > SLIDE_M) {
          frameHasSlide = true;
          if (!inSlide && c.slideFirsts.length < 12) c.slideFirsts.push(`t=${t.toFixed(2)}s contact-slide toe${side} ${(d * 1000).toFixed(2)}mm clip=${clip!.source}`);
        }
      });
    }
    if (frameHasSlide) {
      c.slideFrames += 1;
      if (!inSlide) c.slideEvents += 1;
    }
    inSlide = frameHasSlide;

    // eye detachment
    let frameHasEye = false;
    headInv.copy(head.matrixWorld).invert();
    eyes.forEach((eye, k) => {
      eye.getWorldPosition(v).applyMatrix4(headInv).sub(eyeRestInHead[k]!);
      const d = v.length();
      if (d * 1000 > c.maxEyeMm) { c.maxEyeMm = d * 1000; c.maxEyeAt = `t=${t.toFixed(2)}s blend=${blend.toFixed(3)} ${phase}${clip ? ' ' + clip.source : ''}`; }
      if (d > EYE_M) {
        frameHasEye = true;
        if (!inEye && c.eyeFirsts.length < 24) c.eyeFirsts.push(`t=${t.toFixed(2)}s eye${k === 0 ? 'L' : 'R'} ${(d * 1000).toFixed(2)}mm blend=${blend.toFixed(3)} phase=${phase}${clip ? ' ' + clip.source : ''}`);
      }
    });
    if (frameHasEye) {
      c.eyeFrames += 1;
      if (!inEye) c.eyeEvents += 1;
    }
    inEye = frameHasEye;
  }
  return c;
}

const report = (label: string, c: Counts) => {
  console.log(`── ${label} ──`);
  console.log(`pose resets  (>10°/frame): ${c.poseResetEvents} events / ${c.poseResetFrames} frames (${c.poseResetFadeFrames} mid-fade) · worst step ${c.maxStepDeg.toFixed(2)}° (${c.maxStepBone})`);
  console.log(`foot slides  (>2 mm):      ${c.slideEvents} events / ${c.slideFrames} frames · worst ${c.maxSlideMm.toFixed(3)} mm`);
  console.log(`eye detach   (>1 mm):      ${c.eyeEvents} events / ${c.eyeFrames} frames · worst ${c.maxEyeMm.toFixed(3)} mm ${c.maxEyeAt}`);
  for (const f of c.resetFirsts) console.log(`  reset event: ${f}`);
  for (const f of c.slideFirsts) console.log(`  slide event: ${f}`);
  for (const f of c.eyeFirsts) console.log(`  eye event:   ${f}`);
};

const load = (name: string): ClipWithContacts =>
  JSON.parse(readFileSync(`/tmp/staystill_${name}.clip.json`, 'utf8')) as ClipWithContacts;

console.log(`20 simulated minutes, 60 Hz, seed 7, quiet input, real natalie.gltf hierarchy`);
if (process.env.PASS !== 'B') report('pass A: no clip base', run(null));
if (process.env.PASS !== 'A') report('pass B: clip base cycling idle_19 → idle_21 → wei_rl_45 (5 s rests)', run([load('idle_19'), load('idle_21'), load('wei_rl_45')]));
console.log('self-intersection: not measured — no mesh/collision representation in this harness (bones only)');
