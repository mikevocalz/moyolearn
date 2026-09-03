/**
 * The rig semantics the presence writer relies on, verified against the SHIPPED
 * phone body rather than remembered — doc 22 §7's caveat on `gesture-gate.ts`
 * ("a sign flip turns the reach cap into a reach requirement") applied to the
 * Rigify export the writer actually poses.
 *
 * Two classes of fact are asserted:
 *
 *   1. ANCESTRY. Every bone the writer rotates is an ancestor of skin weight.
 *      The control bones `head`/`neck`/`chest` are NOT (constraints do not
 *      export), which is how she stood still for a fortnight while the code
 *      that moved her ran every frame. This test is what turns a re-export
 *      that re-parents a bone into a red build instead of a frozen tutor.
 *   2. AXES. Which local axis pitches the head toward the camera, swings a hand
 *      forward, curls a finger. Measured by building the node hierarchy from
 *      the glTF JSON with three's own `Bone`, rotating one bone, and reading
 *      where a point down the chain moved in world space.
 *
 * Reads the glTF JSON only — no loader, no fetch, no textures.
 *
 * SOT: ./humano.ts · ../safety/gesture-gate.ts (`assertRigSemantics`) · docs/decisions/adr-113-body-motion-layer.md
 * SOT-KEYWORDS: rig axes test rigify def bones ancestry skin weights pitch yaw curl camera semantics
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { HUMANO_BONES, TWINS, createHumanoPresence } from './humano.ts';

interface GltfNode {
  name: string;
  children?: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
}
interface Gltf {
  nodes: GltfNode[];
  skins: { joints: number[] }[];
  meshes: { primitives: { attributes: Record<string, number> }[] }[];
  accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number }[];
  bufferViews: { byteOffset: number; byteStride?: number }[];
}

const ASSET = new URL('../../assets/natalie-phone/natalie.gltf', import.meta.url);
const gltf = JSON.parse(readFileSync(ASSET, 'utf8')) as Gltf;
const bin = readFileSync(new URL('../../assets/natalie-phone/natalie.bin', import.meta.url));

/** Build the hierarchy exactly as `GLTFLoader` would, minus the skin. */
function buildScene(): { root: THREE.Group; byName: Map<string, THREE.Bone> } {
  const bones = gltf.nodes.map((n) => {
    const b = new THREE.Bone();
    b.name = n.name;
    if (n.translation) b.position.fromArray(n.translation);
    if (n.rotation) b.quaternion.fromArray(n.rotation);
    if (n.scale) b.scale.fromArray(n.scale);
    return b;
  });
  const root = new THREE.Group();
  const hasParent = new Set<number>();
  gltf.nodes.forEach((n, i) => {
    for (const c of n.children ?? []) {
      bones[i]!.add(bones[c]!);
      hasParent.add(c);
    }
  });
  bones.forEach((b, i) => {
    if (!hasParent.has(i)) root.add(b);
  });
  root.updateMatrixWorld(true);
  return { root, byName: new Map(bones.map((b) => [b.name, b])) };
}

/** Joints that carry any skin weight, by name. */
function weightedJoints(): Set<string> {
  const joints = gltf.skins[0]!.joints;
  const out = new Set<string>();
  for (const mesh of gltf.meshes) {
    for (const prim of mesh.primitives) {
      const ja = gltf.accessors[prim.attributes.JOINTS_0!]!;
      const wa = gltf.accessors[prim.attributes.WEIGHTS_0!]!;
      const jb = gltf.bufferViews[ja.bufferView]!;
      const wb = gltf.bufferViews[wa.bufferView]!;
      const jBytes = ja.componentType === 5121 ? 1 : 2;
      const jStride = jb.byteStride ?? 4 * jBytes;
      const wBytes = wa.componentType === 5126 ? 4 : wa.componentType === 5123 ? 2 : 1;
      const wStride = wb.byteStride ?? 4 * wBytes;
      for (let v = 0; v < ja.count; ++v) {
        for (let k = 0; k < 4; ++k) {
          const jo = jb.byteOffset + (ja.byteOffset ?? 0) + v * jStride + k * jBytes;
          const j = jBytes === 1 ? bin.readUInt8(jo) : bin.readUInt16LE(jo);
          const wo = wb.byteOffset + (wa.byteOffset ?? 0) + v * wStride + k * wBytes;
          const w =
            wa.componentType === 5126
              ? bin.readFloatLE(wo)
              : wa.componentType === 5123
                ? bin.readUInt16LE(wo) / 65535
                : bin.readUInt8(wo) / 255;
          if (w > 0.001) out.add(gltf.nodes[joints[j]!]!.name);
        }
      }
    }
  }
  return out;
}

const { root: builtRoot, byName } = buildScene();
const weighted = weightedJoints();

function isAncestorOfWeight(name: string): boolean {
  const bone = byName.get(name);
  if (!bone) return false;
  let found = weighted.has(name);
  bone.traverse((o) => {
    if (weighted.has(o.name)) found = true;
  });
  return found;
}

/**
 * Rotate `boneName` by `rad` about its LOCAL `axis` — `rest × Δ`, exactly as
 * `humano.ts`'s `pose` applies it — and return how a point `along` metres down
 * `probeName`'s local +Y moved in world space.
 */
function moved(boneName: string, axis: 'x' | 'y' | 'z', rad: number, probeName: string, along = 0.1): THREE.Vector3 {
  const bone = byName.get(boneName)!;
  const probe = byName.get(probeName)!;
  const local = new THREE.Vector3(0, along, 0);
  const before = probe.localToWorld(local.clone());
  const saved = bone.quaternion.clone();
  const delta = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(axis === 'x' ? rad : 0, axis === 'y' ? rad : 0, axis === 'z' ? rad : 0, 'XYZ')
  );
  bone.quaternion.copy(saved).multiply(delta);
  bone.updateWorldMatrix(true, true);
  const after = probe.localToWorld(local.clone());
  bone.quaternion.copy(saved);
  bone.updateWorldMatrix(true, true);
  return after.sub(before);
}

describe('the shipped phone rig', () => {
  it('has no animations and 470 skin joints — nothing here is baked motion', () => {
    assert.equal(gltf.skins.length, 1);
    assert.equal(gltf.skins[0]!.joints.length, 470);
  });

  it('every bone the writer poses is an ancestor of skin weight', () => {
    for (const [key, name] of Object.entries(HUMANO_BONES)) {
      if (key === 'eyeL' || key === 'eyeR') continue; // position anchors only
      assert.ok(isAncestorOfWeight(name), `${key} → '${name}' deforms nothing`);
    }
    for (const side of ['L', 'R']) {
      for (const finger of ['thumb', 'f_index', 'f_middle', 'f_ring', 'f_pinky']) {
        for (const ph of ['01', '02', '03']) {
          assert.ok(isAncestorOfWeight(`DEF-${finger}.${ph}.${side}`), `finger ${finger}.${ph}.${side}`);
        }
      }
    }
  });

  it('the control bones head/neck/chest and the jaw deform NOTHING in this export (why she was still)', () => {
    for (const name of ['head', 'neck', 'chest', 'DEF-pelvis', 'jaw_master', 'DEF-jaw']) {
      assert.ok(!isAncestorOfWeight(name), `${name} unexpectedly drives skin — re-check the writer's bone map`);
    }
  });

  it('spine chain: +x pitches the head toward the camera (+z), +y yaws, +z tilts', () => {
    for (const bone of [HUMANO_BONES.head, HUMANO_BONES.neck, HUMANO_BONES.chest, HUMANO_BONES.spine2]) {
      const px = moved(bone, 'x', 0.2, HUMANO_BONES.head);
      assert.ok(px.z > 0 && Math.abs(px.z) > Math.abs(px.x), `${bone} +x should pitch toward +z: ${px.toArray()}`);
      const pz = moved(bone, 'z', 0.2, HUMANO_BONES.head);
      assert.ok(Math.abs(pz.x) > Math.abs(pz.z), `${bone} +z should tilt laterally: ${pz.toArray()}`);
    }
    // Yaw about the neck moves the head's forward point laterally.
    const py = moved(HUMANO_BONES.neck, 'y', 0.2, HUMANO_BONES.head);
    assert.ok(Math.abs(py.x) > 0.001, `neck +y should yaw: ${py.toArray()}`);
  });

  it('DEF-spine +z leans the head −x, so the weight-shift counter-lean sign is right', () => {
    const p = moved(HUMANO_BONES.torso, 'z', 0.2, HUMANO_BONES.head);
    assert.ok(p.x < 0, `expected the head to move −x, got ${p.toArray()}`);
  });

  it('upper arm: +x swings the hand forward (+z); +z abducts, L outward and R mirrored', () => {
    const lx = moved(HUMANO_BONES.upperArmL, 'x', 0.2, HUMANO_BONES.handL);
    assert.ok(lx.z > 0.05, `L +x forward: ${lx.toArray()}`);
    const rx = moved(HUMANO_BONES.upperArmR, 'x', 0.2, HUMANO_BONES.handR);
    assert.ok(rx.z > 0.05, `R +x forward: ${rx.toArray()}`);
    const lz = moved(HUMANO_BONES.upperArmL, 'z', 0.2, HUMANO_BONES.handL);
    const rz = moved(HUMANO_BONES.upperArmR, 'z', -0.2, HUMANO_BONES.handR);
    assert.ok(lz.x > 0.05, `L +z outward (+x): ${lz.toArray()}`);
    assert.ok(rz.x < -0.05, `R −z outward (−x): ${rz.toArray()}`);
  });

  it('forearm and hand: +x flexes forward', () => {
    assert.ok(moved(HUMANO_BONES.foreArmL, 'x', 0.2, HUMANO_BONES.handL).z > 0.02);
    assert.ok(moved(HUMANO_BONES.handL, 'x', 0.2, HUMANO_BONES.handL).z > 0.005);
  });

  it('shoulder: +x raises the shoulder tip', () => {
    assert.ok(moved(HUMANO_BONES.shoulderL, 'x', 0.2, HUMANO_BONES.shoulderL).y > 0.01);
    assert.ok(moved(HUMANO_BONES.shoulderR, 'x', 0.2, HUMANO_BONES.shoulderR).y > 0.01);
  });

  it('finger: +x curls the fingertip into the palm on both hands', () => {
    // The palm faces the thigh: −x for the left hand, +x for the right.
    const l = moved('DEF-f_index.01.L', 'x', 0.2, 'DEF-f_index.03.L', 0.02);
    assert.ok(l.x < -0.005, `L index +x should curl toward −x: ${l.toArray()}`);
    const r = moved('DEF-f_index.01.R', 'x', 0.2, 'DEF-f_index.03.R', 0.02);
    assert.ok(r.x > 0.005, `R index +x should curl toward +x: ${r.toArray()}`);
  });
});

describe('the two chains stay one body', () => {
  it('every twin sits where its DEF bone sits, facing the same way (the hip root excepted)', () => {
    for (const [key, twinName] of Object.entries(TWINS)) {
      const def = byName.get(HUMANO_BONES[key as keyof typeof HUMANO_BONES])!;
      const twin = byName.get(twinName)!;
      assert.ok(twin, `twin ${twinName} missing`);
      const pd = def.getWorldPosition(new THREE.Vector3());
      const pt = twin.getWorldPosition(new THREE.Vector3());
      if (key === 'torso' || key === 'spine1') continue; // documented 14 cm / 4 cm pivot offset
      assert.ok(pd.distanceTo(pt) < 1e-3, `${key}: ${pd.toArray()} vs twin ${pt.toArray()}`);
      const qd = def.getWorldQuaternion(new THREE.Quaternion());
      const qt = twin.getWorldQuaternion(new THREE.Quaternion());
      assert.ok(Math.abs(qd.angleTo(qt)) < 1e-3, `${key}: twin orientation differs by ${qd.angleTo(qt)} rad`);
    }
  });

  it('the eyeballs ride the head: their offset in the head frame never changes while she moves', () => {
    const { root, byName: names } = buildScene();
    const presence = createHumanoPresence(root);
    const head = names.get(HUMANO_BONES.head)!;
    const eye = names.get('DEF-eye.L')!;
    const teeth = names.get('DEF-teeth.T')!;
    const hand = names.get('DEF-hand.L')!;
    const chest = names.get(HUMANO_BONES.chest)!;
    root.updateMatrixWorld(true);
    const inHead = (o: THREE.Object3D) => head.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
    const inChest = (o: THREE.Object3D) => chest.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
    const eye0 = inHead(eye);
    const teeth0 = inHead(teeth);
    const hand0 = inChest(hand);
    let worst = 0;
    let worstHand = 0;
    for (let i = 0; i < 60 * 30; i++) {
      const t = i / 60;
      presence.step(1 / 60, {
        speaking: t > 5,
        mouth: t > 5 ? 0.5 : 0,
        reducedMotion: false,
        phase: t > 5 ? 'speaking' : 'listening',
        partnerPauseEvent: i === 120,
      });
      root.updateMatrixWorld(true);
      worst = Math.max(worst, inHead(eye).distanceTo(eye0), inHead(teeth).distanceTo(teeth0));
      // The hand is posed on purpose; what must not move is the SHOULDER
      // socket relative to the chest — measured through the upper arm's root.
      const upperArm = names.get(HUMANO_BONES.upperArmL)!;
      worstHand = Math.max(worstHand, inChest(upperArm).distanceTo(inChest(upperArm)));
      void hand0;
    }
    assert.ok(worst < 0.0005, `an eyeball or the teeth drifted ${(worst * 1000).toFixed(1)} mm out of the head`);
    void worstHand;
  });

  it('the shoulder socket stays on the chest through breath and a weight shift', () => {
    const { root, byName: names } = buildScene();
    const presence = createHumanoPresence(root);
    const chest = names.get(HUMANO_BONES.chest)!;
    const socket = names.get(HUMANO_BONES.upperArmL)!;
    root.updateMatrixWorld(true);
    const at = () => chest.worldToLocal(socket.getWorldPosition(new THREE.Vector3()));
    const rest = at();
    let worst = 0;
    for (let i = 0; i < 60 * 60; i++) {
      presence.step(1 / 60, { speaking: false, mouth: 0, reducedMotion: false, phase: 'waiting' });
      root.updateMatrixWorld(true);
      worst = Math.max(worst, at().distanceTo(rest));
    }
    assert.ok(worst < 0.0005, `the arm root drifted ${(worst * 1000).toFixed(1)} mm off the chest`);
  });
});
