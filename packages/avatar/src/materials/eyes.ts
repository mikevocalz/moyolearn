/**
 * The eyes — doc 22 §4 row 3, and the trickiest translation in the port.
 *
 * An eye is not a painted sphere. The iris sits behind a refracting cornea, so
 * it PARALLAXES: look at someone from the side and their pupil appears shifted
 * relative to where the geometry puts it. The reference solved this without
 * per-eye uniforms, which is the clever part and the part worth preserving:
 *
 *   1. Refract the view ray at the cornea (IOR 1.376, the real one).
 *   2. March it `ACD` = 2.5 mm — anterior chamber depth — to the iris plane.
 *   3. Convert that model-space offset into the baked iris-plane UV using a
 *      SCREEN-SPACE COTANGENT FRAME built from `dFdx`/`dFdy` of both the
 *      position and the baked UV.
 *
 * Step 3 is why there are no per-eye uniforms: the frame is derived from the
 * surface itself, so the left and right eye each get their own correct basis
 * for free. It is also the step that made this row risky — `dFdx`/`dFdy` and
 * `refract` all had to exist in TSL, and they do (`three/tsl`, r185).
 *
 * The GLSL is ported line for line from the reference's `src/eyes.ts` rather
 * than from a description of it: every constant here (0.0025, 1/1.376, the two
 * iris browns, the 0.88→1.0 limbal ring, the 1.0→1.18 limbus blur, the
 * 0.0004→0.0013 meniscus band) is the reference's, unchanged. A look is only
 * reproducible if its numbers are.
 *
 * WHAT THE `<sc-if>`-STYLE EARLY RETURN BECAME: the GLSL bailed out of
 * `eyeParallaxUV()` with `if (abs(det) < 1e-12) return vEyeAux.xy;`. TSL builds
 * a graph rather than executing statements, so the guard is a `select()` — both
 * branches are computed and one is chosen, which is what the GPU does anyway.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 row 3
 * SOT-KEYWORDS: eyes iris sclera pupil parallax refract cornea cotangent dfdx meniscus limbus tsl
 */
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import {
  Fn,
  abs,
  attribute,
  cross,
  dFdx,
  dFdy,
  float,
  length,
  mix,
  normalGeometry,
  normalize,
  positionGeometry,
  refract,
  select,
  smoothstep,
  uniform,
  vec2,
  vec3,
} from 'three/tsl';
import { Matrix4, Vector3 } from 'three';

/** Baked per-vertex: (irisU, irisV, lidDistance, lidAO). Float32, vec4. */
export const EYE_AUX_ATTRIBUTE = 'aEyeAux';

/**
 * Same upstream gap as in `./skin.ts`: `attribute()` and `select()` are
 * declared without a type tag, so the swizzles and math operators are not
 * visible on them. Narrowed once, here, rather than scattered through the
 * shading maths where it would read as doubt about the values.
 */
type Vec2 = Node<'vec2'>;
type Vec3 = Node<'vec3'>;
type Vec4 = Node<'vec4'>;
type Float = Node<'float'>;

const asVec2 = (n: unknown): Vec2 => n as Vec2;
const asVec3 = (n: unknown): Vec3 => n as Vec3;
const asVec4 = (n: unknown): Vec4 => n as Vec4;
const asFloat = (n: unknown): Float => n as Float;

/** Anterior chamber depth in model metres — cornea to iris plane. */
const ACD = 0.0025;
/** Cornea IOR. The ray enters a denser medium, so the ratio is inverted. */
const CORNEA_IOR = 1.376;

export interface EyeAuxMeta {
  irisRadius: number;
  pupilRadius: number;
}

/**
 * Shared across all three eye materials, exactly as the reference shared one
 * uniforms object: the camera position must be expressed in MODEL space, and
 * it is written once per frame by the caller (the reference did it from
 * `headMesh.onBeforeRender`).
 */
export function createEyeUniforms(aux: EyeAuxMeta) {
  return {
    cameraModel: uniform(new Vector3()),
    irisRadius: uniform(aux.irisRadius),
    pupilRadius: uniform(aux.pupilRadius),
  };
}

export type EyeUniforms = ReturnType<typeof createEyeUniforms>;

// --- noise ------------------------------------------------------------------
// Direction-keyed value noise. Seam-free around the iris because it is sampled
// on a normalised direction rather than on a wrapping coordinate.

const eyeHash = Fn(([p]: [Vec2]) =>
  p.dot(vec2(127.1, 311.7)).sin().mul(43758.5453123).fract()
);

const eyeNoise = Fn(([p]: [Vec2]) => {
  const i = p.floor();
  const f = p.fract();
  const u = f.mul(f).mul(float(3).sub(f.mul(2)));
  return mix(
    mix(eyeHash(i), eyeHash(i.add(vec2(1, 0))), u.x),
    mix(eyeHash(i.add(vec2(0, 1))), eyeHash(i.add(vec2(1, 1))), u.x),
    u.y
  );
});

const eyeAux = (): Vec4 => asVec4(attribute(EYE_AUX_ATTRIBUTE, 'vec4'));

/**
 * The parallax lookup. Returns the iris-plane UV the fragment should sample,
 * shifted by refraction through the cornea.
 */
function eyeParallaxUV(u: EyeUniforms) {
  const aux = eyeAux();
  const nrm = normalize(normalGeometry);
  const viewDir = normalize(u.cameraModel.sub(positionGeometry));
  const refr = refract(viewDir.negate(), nrm, float(1 / CORNEA_IOR));

  // March to the iris plane. The 0.15 floor stops the offset exploding at
  // grazing angles, where the ray is nearly parallel to the plane.
  const offset = refr.mul(float(ACD).div(refr.negate().dot(nrm).max(0.15)));

  // The screen-space cotangent frame: dp1/dp2 are the position derivatives,
  // duv1/duv2 the baked-UV derivatives, and the cross products invert the
  // 2x3 Jacobian without ever forming it.
  const dp1 = dFdx(positionGeometry);
  const dp2 = dFdy(positionGeometry);
  const duv1 = dFdx(aux.xy);
  const duv2 = dFdy(aux.xy);
  const c2 = cross(dp2, nrm);
  const c1 = cross(nrm, dp1);
  const det = dp1.dot(c2);

  const uvOffset = offset.dot(c2).mul(duv1).add(offset.dot(c1).mul(duv2)).div(det);

  // The GLSL early-returned here; a node graph selects instead. A degenerate
  // frame means the triangle is edge-on, where the unshifted UV is right.
  return asVec2(select(abs(det).lessThan(1e-12), aux.xy, aux.xy.add(uvOffset)));
}

/** The ~1 mm wet band where the lid meets the eyeball. */
function eyeMeniscus() {
  return asFloat(float(1).sub(smoothstep(0.0004, 0.0013, eyeAux().z)));
}

// --- the three surfaces -----------------------------------------------------

function irisColorNode(u: EyeUniforms) {
  const uv = eyeParallaxUV(u);
  const r = length(uv).div(u.irisRadius);
  // Guard the normalise: at dead centre the direction is undefined.
  const dir = asVec2(select(r.greaterThan(1e-4), normalize(uv), vec2(1, 0)));

  // Radial fibres, two octaves. The fine octave drifts with radius so the
  // fibres are not perfectly straight spokes.
  const fibre = eyeNoise(dir.mul(7.3).add(0.5))
    .mul(0.55)
    .add(eyeNoise(dir.mul(17.7).add(r.mul(3.1))).mul(0.45));

  let iris = asVec3(mix(vec3(0.085, 0.042, 0.02), vec3(0.24, 0.13, 0.06), fibre));

  const pupilFrac = u.pupilRadius.div(u.irisRadius);
  // Darker toward the pupil, and darker again INSIDE the parallax-shifted
  // pupil edge — the two smoothsteps are not redundant.
  iris = iris.mul(mix(float(0.4), float(1), smoothstep(pupilFrac, pupilFrac.add(0.32), r)));
  iris = iris.mul(smoothstep(pupilFrac.mul(0.92), pupilFrac.mul(1.06), r));
  // Limbal ring: the dark rim over the outer ~10% of the iris.
  iris = iris.mul(float(1).sub(smoothstep(0.88, 1.0, r).mul(0.75)));
  // The lid shadow falls on the iris too.
  iris = iris.mul(float(1).sub(eyeAux().w.mul(0.5)));
  return iris;
}

function scleraColorNode(u: EyeUniforms) {
  const aux = eyeAux();
  const uv = aux.xy;
  const rs = length(uv).div(u.irisRadius); // 1 at the limbus, ~2.4 at the poles

  // Warm off-white. A white sclera is the single fastest way to make a face
  // look synthetic.
  let sclera: Vec3 = vec3(0.7, 0.63, 0.54);

  // Red-brown toward the canthi (the horizontal corners).
  const corner = smoothstep(1.15, 2.2, abs(uv.x).div(u.irisRadius));
  sclera = asVec3(mix(sclera, vec3(0.46, 0.235, 0.16), corner.mul(0.5)));

  // Faint large-scale veining, stronger away from the cornea.
  const vein = eyeNoise(uv.mul(900)).mul(eyeNoise(uv.mul(337).add(5.7)));
  sclera = asVec3(mix(sclera, vec3(0.5, 0.21, 0.16), vein.mul(0.3).mul(smoothstep(1.0, 1.8, rs))));

  // The limbus blur. The iris/sclera boundary is a majority-vote triangle
  // group, so the geometric edge is a sawtooth — fading both sides to the same
  // dark brown over rs 1.0→1.18 is what stops it showing.
  sclera = asVec3(mix(vec3(0.03, 0.018, 0.012), sclera, smoothstep(1.0, 1.18, rs)));

  sclera = sclera.mul(float(1).sub(aux.w.mul(0.68))); // baked lid-contact AO
  sclera = sclera.mul(float(1).sub(eyeMeniscus().mul(0.3))); // wet-line darkening
  return sclera;
}

function pupilColorNode(u: EyeUniforms) {
  const uv = eyeParallaxUV(u);
  const r = length(uv).div(u.pupilRadius.max(1e-6));
  // Near-black, but parallax lets a hint of iris brown creep in past the
  // geometric edge when the shifted lookup exits the disc.
  const pupil = asVec3(
    mix(vec3(0.004, 0.003, 0.003), vec3(0.045, 0.024, 0.012), smoothstep(0.96, 1.35, r))
  );
  return pupil.mul(float(1).sub(eyeAux().w.mul(0.5)));
}

/** Roughness with the wet meniscus punched in — a tight specular at the lid line. */
function eyeRoughnessNode(base: number) {
  return mix(float(base), float(0.03), eyeMeniscus());
}

export type EyeSurface = 'sclera' | 'iris' | 'pupil';

/**
 * Material order matters: these are three groups of ONE mesh, and the reference
 * reorders the geometry's material groups to match. Keep this order.
 */
export const EYE_SURFACES: readonly EyeSurface[] = Object.freeze(['sclera', 'iris', 'pupil']);

export interface EyeMaterials {
  sclera: MeshPhysicalNodeMaterial;
  iris: MeshPhysicalNodeMaterial;
  pupil: MeshPhysicalNodeMaterial;
  uniforms: EyeUniforms;
  /**
   * Writes the model-space camera position. Call once per frame, before render
   * — the reference did it from `headMesh.onBeforeRender`.
   */
  update(cameraWorldPosition: Vector3, meshWorldMatrixInverse: Matrix4): void;
  ordered(): MeshPhysicalNodeMaterial[];
  dispose(): void;
}

export function makeEyeMaterials(aux: EyeAuxMeta): EyeMaterials {
  const uniforms = createEyeUniforms(aux);

  // Wet cornea / tear film: a low-roughness clearcoat produces the tight
  // catchlight from the scene's own lights, rather than a painted highlight.
  const sclera = new MeshPhysicalNodeMaterial({
    roughness: 0.32,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.12,
    specularIntensity: 0.9,
  });
  sclera.colorNode = scleraColorNode(uniforms);
  sclera.roughnessNode = eyeRoughnessNode(0.32);

  const iris = new MeshPhysicalNodeMaterial({
    roughness: 0.28,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    ior: CORNEA_IOR,
    specularIntensity: 1,
  });
  iris.colorNode = irisColorNode(uniforms);
  iris.roughnessNode = eyeRoughnessNode(0.28);

  const pupil = new MeshPhysicalNodeMaterial({
    roughness: 0.24,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    ior: CORNEA_IOR,
    specularIntensity: 1,
  });
  pupil.colorNode = pupilColorNode(uniforms);
  pupil.roughnessNode = eyeRoughnessNode(0.24);

  const materials = { sclera, iris, pupil };

  return {
    ...materials,
    uniforms,

    update(cameraWorldPosition: Vector3, meshWorldMatrixInverse: Matrix4) {
      // The parallax maths is entirely in model space, so the camera is brought
      // there once per frame — doing it per fragment would be the same value
      // recomputed 17,821 times.
      uniforms.cameraModel.value.copy(cameraWorldPosition).applyMatrix4(meshWorldMatrixInverse);
    },

    ordered() {
      return EYE_SURFACES.map((name) => materials[name]);
    },

    dispose() {
      sclera.dispose();
      iris.dispose();
      pupil.dispose();
    },
  };
}
