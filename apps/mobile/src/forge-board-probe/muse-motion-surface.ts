import type { MotionPointer, MotionSurface } from './muse-motion.ts';

export interface CalibratedMotionSurface {
  readonly identity: object;
  readonly generation: number;
  readonly surfaceVersion: number;
  readonly width: number;
  readonly height: number;
}
interface MountedSurface {
  generation: number;
  surfaceVersion: number;
  ready: boolean;
  foreground: boolean;
  handle: {injectPointer(sample: MotionPointer): void} | null;
}
/** The mount token survives imperative-facade recreation on ordinary React renders. */
export function createCalibratedMotionSurface(generation:number,surfaceVersion:number,width:number,height:number):CalibratedMotionSurface {
  return {identity:{},generation,surfaceVersion,width,height};
}
/** Resolves the current facade only while the calibrated engine mount remains valid. */
export function resolveCalibratedMotionSurface(calibration:CalibratedMotionSurface|null,read:()=>MountedSurface):MotionSurface|null {
  if(!calibration)return null;
  const sameMount=(current:MountedSurface)=>current.generation===calibration.generation&&current.surfaceVersion===calibration.surfaceVersion&&current.handle!==null;
  const current=read();
  if(!sameMount(current)||!current.ready||!current.foreground)return null;
  return {identity:calibration.identity,width:calibration.width,height:calibration.height,
    injectPointer(sample){
      const latest=read();
      // Cancellation may be queued while backgrounded; it must never target a new mount.
      if(!sameMount(latest)||(sample.phase!=='cancel'&&(!latest.ready||!latest.foreground)))throw new Error('Calibrated board mount is unavailable');
      latest.handle?.injectPointer(sample);
    },
  };
}
