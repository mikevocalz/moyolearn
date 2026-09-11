/**
 * Turn-toward (§3.3), the small-angle half: below 15° of commanded yaw the
 * torso twists over planted feet — head leads, shoulders follow at a
 * fraction, hips stay. The step-turn past 15° is out of scope and the
 * command clamps; these tests hold that line too.
 *
 * Runs on the REAL glTF hierarchy, because every claim here is a WORLD-yaw
 * claim measured through the actual parent chains, and the feet gate needs
 * real bone offsets. The idle layer wanders (drift, torsoYaw) on top of the
 * turn, so the turn is isolated by differencing two same-seed runs stepped
 * in lockstep — identical inputs except `faceYawRad`, which touches neither
 * the engine nor the rng, so the idle stream subtracts out exactly.
 *
 * SOT: ./humano.ts (TURN_TOWARD) · ../reduced-motion.ts (heldFacingScale)
 * SOT-KEYWORDS: turn toward face yaw head leads chest follows hips stay clamp step turn reduced motion
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { TURN_TOWARD, createHumanoPresence, type HumanoInput } from './humano.ts';

const DEG = Math.PI / 180;
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

/** World yaw of a bone relative to its own rest world orientation. */
function worldYaw(bone: THREE.Bone, restWorldQ: THREE.Quaternion): number {
  const delta = bone.getWorldQuaternion(new THREE.Quaternion()).multiply(restWorldQ.clone().invert());
  const v = new THREE.Vector3(0, 0, 1).applyQuaternion(delta);
  return Math.atan2(v.x, v.z);
}

/**
 * Two same-seed runs in lockstep, one commanded to `faceYawRad`, one not.
 * Returns per-frame turn-isolated world yaws (commanded minus baseline) for
 * head, chest and hips, plus the toe worst-cases against the feet gate.
 */
function runPair(faceYawRad: number, seconds: number) {
  const a = buildRealScene();
  const b = buildRealScene();
  const pa = createHumanoPresence(a.root, { seed: 7 });
  const pb = createHumanoPresence(b.root, { seed: 7 });
  const bone = (scene: typeof a, name: string) => scene.byName.get(name)!;
  const restQ = (scene: typeof a, name: string) =>
    bone(scene, name).getWorldQuaternion(new THREE.Quaternion());
  a.root.updateMatrixWorld(true);
  b.root.updateMatrixWorld(true);
  const heads = [restQ(a, 'DEF-spine.006'), restQ(b, 'DEF-spine.006')] as const;
  const chests = [restQ(a, 'DEF-spine.003'), restQ(b, 'DEF-spine.003')] as const;
  const hips = [restQ(a, 'DEF-spine'), restQ(b, 'DEF-spine')] as const;
  const toeRest = {
    L: bone(a, 'DEF-toe.L').getWorldPosition(new THREE.Vector3()),
    R: bone(a, 'DEF-toe.R').getWorldPosition(new THREE.Vector3()),
  };
  const head: number[] = [];
  const chest: number[] = [];
  const hip: number[] = [];
  let worstToeVsRest = 0;
  let worstToeVsBaseline = 0;
  for (let i = 0; i < seconds * 60; i += 1) {
    pa.step(1 / 60, { ...QUIET, faceYawRad });
    pb.step(1 / 60, QUIET);
    a.root.updateMatrixWorld(true);
    b.root.updateMatrixWorld(true);
    head.push(worldYaw(bone(a, 'DEF-spine.006'), heads[0]) - worldYaw(bone(b, 'DEF-spine.006'), heads[1]));
    chest.push(worldYaw(bone(a, 'DEF-spine.003'), chests[0]) - worldYaw(bone(b, 'DEF-spine.003'), chests[1]));
    hip.push(worldYaw(bone(a, 'DEF-spine'), hips[0]) - worldYaw(bone(b, 'DEF-spine'), hips[1]));
    for (const side of ['L', 'R'] as const) {
      const pA = bone(a, `DEF-toe.${side}`).getWorldPosition(new THREE.Vector3());
      const pB = bone(b, `DEF-toe.${side}`).getWorldPosition(new THREE.Vector3());
      const rest = toeRest[side];
      worstToeVsRest = Math.max(worstToeVsRest, Math.hypot(pA.x - rest.x, pA.z - rest.z));
      worstToeVsBaseline = Math.max(worstToeVsBaseline, pA.distanceTo(pB));
    }
  }
  return { head, chest, hip, worstToeVsRest, worstToeVsBaseline };
}

describe('turn-toward, small angles over planted feet', () => {
  it('10°: the head settles on the command, the chest on a fraction, the hips on nothing', () => {
    const run = runPair(10 * DEG, 6);
    const headDeg = run.head.at(-1)! / DEG;
    const chestDeg = run.chest.at(-1)! / DEG;
    const hipDeg = Math.abs(run.hip.at(-1)!) / DEG;
    assert.ok(Math.abs(headDeg - 10) < 1, `head world yaw settled at ${headDeg.toFixed(2)}°, commanded 10°`);
    assert.ok(chestDeg < headDeg, `chest (${chestDeg.toFixed(2)}°) must stay strictly under the head (${headDeg.toFixed(2)}°)`);
    // Non-vacuous both ways: the shoulders DO follow, and only at a fraction.
    assert.ok(chestDeg > 1 && chestDeg < 6, `chest settled at ${chestDeg.toFixed(2)}° — expected a following fraction, not zero and not the whole turn`);
    assert.ok(hipDeg < 1, `hips yawed ${hipDeg.toFixed(3)}° — they must stay put; past 15° that is a step-turn, which is out of scope`);
    // The feet gates hold: same 5 mm bound the retargeter and blend layer obey,
    // and the legs must be IDENTICAL to the unturned run — the turn owns
    // nothing below the hips.
    assert.ok(run.worstToeVsRest < 0.005, `a toe drifted ${(run.worstToeVsRest * 1000).toFixed(2)} mm from its plant during the turn`);
    assert.ok(run.worstToeVsBaseline < 0.0005, `a toe sits ${(run.worstToeVsBaseline * 1000).toFixed(3)} mm off the unturned run — the turn is reaching the legs`);
  });

  it('the head LEADS the chest — crossing times ordered', () => {
    const run = runPair(12 * DEG, 6);
    const headFinal = run.head.at(-1)!;
    const chestFinal = run.chest.at(-1)!;
    const crossing = (series: number[], final: number) =>
      series.findIndex((v) => v >= final * 0.5);
    const tHead = crossing(run.head, headFinal);
    const tChest = crossing(run.chest, chestFinal);
    assert.ok(tHead >= 0 && tChest >= 0, 'both series must cross half their own settle value');
    assert.ok(
      tHead < tChest,
      `head crossed half-travel at frame ${tHead}, chest at ${tChest} — the head must lead, not the turntable`,
    );
  });

  it('clamps at 15°: a 30° command is a step-turn, and a step-turn is not faked', () => {
    const run = runPair(30 * DEG, 6);
    const headDeg = run.head.at(-1)! / DEG;
    const maxDeg = TURN_TOWARD.maxRad / DEG;
    assert.ok(Math.abs(maxDeg - 15) < 1e-9, `TURN_TOWARD.maxRad is ${maxDeg}°, the §3.3 boundary is 15°`);
    assert.ok(Math.abs(headDeg - maxDeg) < 1, `head settled at ${headDeg.toFixed(2)}° on a 30° command — must clamp near ${maxDeg}°`);
    assert.ok(Math.abs(run.hip.at(-1)!) / DEG < 1, 'and the hips still do not spin to cover the difference');
  });

  it('reduced motion: no travel, direction held', () => {
    const { root, byName } = buildRealScene();
    const presence = createHumanoPresence(root, { seed: 7 });
    const head = byName.get('DEF-spine.006')!;
    const hip = byName.get('DEF-spine')!;
    root.updateMatrixWorld(true);
    const headRestQ = head.getWorldQuaternion(new THREE.Quaternion());
    const hipRestQ = hip.getWorldQuaternion(new THREE.Quaternion());
    const rmInput: HumanoInput = { speaking: false, mouth: 0, reducedMotion: true, faceYawRad: 10 * DEG };
    presence.step(1 / 60, rmInput);
    root.updateMatrixWorld(true);
    const heldYaw = worldYaw(head, headRestQ);
    let worstTravel = 0;
    for (let i = 0; i < 300; i += 1) {
      presence.step(1 / 60, rmInput);
      root.updateMatrixWorld(true);
      worstTravel = Math.max(worstTravel, Math.abs(worldYaw(head, headRestQ) - heldYaw));
    }
    // Direction HELD: she faces the command from the first frame…
    assert.ok(Math.abs(heldYaw / DEG - 10) < 1, `held facing is ${(heldYaw / DEG).toFixed(2)}°, commanded 10°`);
    // …and the transition is PINNED: zero travel afterwards, ever.
    assert.ok(worstTravel < 1e-6, `head travelled ${(worstTravel / DEG).toFixed(4)}° under reduced motion — the transition must be pinned`);
    assert.ok(Math.abs(worldYaw(hip, hipRestQ)) / DEG < 1e-6, 'hips hold zero under reduced motion too');
  });
});
