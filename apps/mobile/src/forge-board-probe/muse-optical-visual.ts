import type { OpticalPose, OpticalVector } from './muse-optical-geometry.ts';

/** Measured model-space tip/tail and barrel radius. These are supplied by calibration, never inferred from screen size. */
export interface OpticalPenShape {
  readonly tipMeters: OpticalVector;
  readonly tailMeters: OpticalVector;
  readonly barrelRadiusMeters: number;
  /** Display length only; does not participate in pose estimation. */
  readonly rayLengthMeters: number;
}

const add = (a: OpticalVector, b: OpticalVector): OpticalVector => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subtract = (a: OpticalVector, b: OpticalVector): OpticalVector => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (v: OpticalVector, n: number): OpticalVector => [v[0] * n, v[1] * n, v[2] * n];
const cross = (a: OpticalVector, b: OpticalVector): OpticalVector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const validVector = (v: OpticalVector) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const normalize = (v: OpticalVector): OpticalVector => scale(v, 1 / Math.hypot(...v));

/** Small fixed-topology proxy; world vertices avoid ambiguous Euler rotation conventions. */
export const opticalPenTriangles: [number, number, number][] = [
  [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1],
  [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3],
  [3, 7, 8], [3, 8, 4], [4, 8, 5], [4, 5, 1], [5, 8, 7], [5, 7, 6],
];

/** Only call with a current, accepted optical pose. The proxy is a visualization, not a calibrated Muse CAD model. */
export function buildOpticalPenVisual(pose: OpticalPose, shape: OpticalPenShape): {
  vertices: [number, number, number][];
  ray: [[number, number, number], [number, number, number]];
} | null {
  if (!validVector(shape.tipMeters) || !validVector(shape.tailMeters) || !validVector(pose.translationMeters)
    || pose.rotation.length !== 9 || !pose.rotation.every(Number.isFinite)
    || !Number.isFinite(shape.barrelRadiusMeters) || shape.barrelRadiusMeters <= 0
    || !Number.isFinite(shape.rayLengthMeters) || shape.rayLengthMeters <= 0) return null;
  const axis = subtract(shape.tailMeters, shape.tipMeters);
  const length = Math.hypot(...axis);
  if (length <= 1e-6 || shape.barrelRadiusMeters >= length / 2) return null;
  const unit = normalize(axis);
  const right = normalize(cross(unit, Math.abs(unit[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const up = cross(unit, right);
  const transform = (v: OpticalVector): [number, number, number] => {
    const r = pose.rotation, t = pose.translationMeters;
    return [r[0] * v[0] + r[1] * v[1] + r[2] * v[2] + t[0],
      r[3] * v[0] + r[4] * v[1] + r[5] * v[2] + t[1],
      r[6] * v[0] + r[7] * v[1] + r[8] * v[2] + t[2]];
  };
  const local: OpticalVector[] = [shape.tipMeters];
  // The taper is cosmetic. Actual tip, axis, scale and ray origin come from the measured model.
  for (const center of [add(shape.tipMeters, scale(axis, 0.15)), shape.tailMeters]) {
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      local.push(add(center, add(scale(right, x! * shape.barrelRadiusMeters), scale(up, y! * shape.barrelRadiusMeters))));
    }
  }
  const tip = transform(shape.tipMeters);
  const end = transform(subtract(shape.tipMeters, scale(unit, shape.rayLengthMeters)));
  const vertices = local.map(transform);
  return vertices.every(validVector) && validVector(end) ? { vertices, ray: [tip, end] } : null;
}
