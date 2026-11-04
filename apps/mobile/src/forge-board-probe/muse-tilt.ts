/** Gravity-direction tilt control only. No position, yaw, pose or physical-distance estimate. */
export type TiltAcceleration = readonly [number, number, number];
export interface TiltReference {
  readonly gravity: TiltAcceleration;
  readonly right: TiltAcceleration;
  readonly up: TiltAcceleration;
  readonly magnitude: number;
}
const STATIONARY_RAW_MAGNITUDE = 2008;
const dot = (a: TiltAcceleration, b: TiltAcceleration) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a: TiltAcceleration, b: TiltAcceleration): TiltAcceleration => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function normalized(a: TiltAcceleration): {vector:TiltAcceleration;magnitude:number}|null {
  if (!Array.isArray(a) || a.length!==3 || !a.every(Number.isFinite)) return null;
  const magnitude=Math.hypot(...a);
  if (!Number.isFinite(magnitude) || magnitude<1e-6) return null;
  return {vector:[a[0]/magnitude,a[1]/magnitude,a[2]/magnitude],magnitude};
}
const stableMagnitude = (value:number, baseline:number) => value>=baseline*0.75 && value<=baseline*1.25;

/** Recenter from a measured near-stationary sample; the optional raw baseline is calibration, not units. */
export function createTiltReference(acceleration:TiltAcceleration, stationaryMagnitude=STATIONARY_RAW_MAGNITUDE):TiltReference|null {
  if (!Number.isFinite(stationaryMagnitude) || stationaryMagnitude<=0) return null;
  const sample=normalized(acceleration);
  if (!sample || !stableMagnitude(sample.magnitude,stationaryMagnitude)) return null;
  const gravity=sample.vector;
  // Project a deterministic device axis into the tangent plane; avoid the parallel-axis singularity.
  const axis:TiltAcceleration=Math.abs(gravity[0])<0.9?[1,0,0]:[0,1,0];
  const component=dot(axis,gravity);
  const right=normalized([axis[0]-component*gravity[0],axis[1]-component*gravity[1],axis[2]-component*gravity[2]])?.vector;
  if (!right) return null;
  const up=normalized(cross(gravity,right))?.vector;
  return up?{gravity,right,up,magnitude:sample.magnitude}:null;
}

/** Returns normalized board coordinates or null when the sensor sample cannot support tilt control.
 * Magnitude rejection catches some dynamic acceleration; it cannot distinguish every motion from gravity.
 * sensitivityDegrees is center-to-edge tilt on each tangent axis. Never integrate translation or yaw.
 */
export function projectGravityTilt(reference:TiltReference, acceleration:TiltAcceleration, sensitivityDegrees=30):{u:number;v:number}|null {
  if (!Number.isFinite(sensitivityDegrees) || sensitivityDegrees<=0 || sensitivityDegrees>=90 || !Number.isFinite(reference.magnitude) || reference.magnitude<=0) return null;
  const sample=normalized(acceleration);
  if (!sample || !stableMagnitude(sample.magnitude,reference.magnitude)) return null;
  if (![reference.gravity,reference.right,reference.up].every((vector)=>normalized(vector)!==null)) return null;
  const forward=dot(sample.vector,reference.gravity);
  // Opposite/perpendicular gravity is beyond this local tilt control's calibrated hemisphere.
  if (forward<=0) return null;
  const limit=sensitivityDegrees*Math.PI/180;
  const horizontal=Math.atan2(dot(sample.vector,reference.right),forward);
  const vertical=Math.atan2(dot(sample.vector,reference.up),forward);
  const clamp=(value:number)=>Math.max(0,Math.min(1,value));
  return {u:clamp(0.5+horizontal/(2*limit)),v:clamp(0.5-vertical/(2*limit))};
}
