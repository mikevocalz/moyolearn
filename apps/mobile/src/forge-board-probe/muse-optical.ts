import { createStore } from 'zustand/vanilla';
import { solveRigidOpticalPose, triangulateOpticalPixels } from './muse-optical-geometry.ts';
import type { OpticalCamera, OpticalPixel, OpticalPose, OpticalVector } from './muse-optical-geometry.ts';

/** Independently measured, rigidly attached marker geometry. Unknown pen geometry must not be invented. */
export interface OpticalModel {
  readonly id: string;
  readonly points: readonly { readonly id: string; readonly meters: OpticalVector }[];
}
/** Measured synchronized stereo frame accepted by {@link createMuseOpticalController}. */
export interface OpticalStereoFrame {
  readonly sessionId: string;
  readonly calibrationId: string;
  readonly modelId: string;
  readonly sequence: number;
  readonly first: { readonly camera: OpticalCamera; readonly capturedAtMs: number };
  readonly second: { readonly camera: OpticalCamera; readonly capturedAtMs: number };
  readonly correspondences: readonly { readonly id: string; readonly firstPixel: OpticalPixel; readonly secondPixel: OpticalPixel }[];
}
/** State exposes current measured pose separately from retained historical values. */
export interface OpticalTrackingState {
  readonly phase: 'unavailable' | 'waiting' | 'tracking';
  readonly reason: string;
  readonly sessionId: string | null;
  readonly lastSequence: number;
  readonly acceptedFrames: number;
  readonly currentPose: OpticalPose | null;
  readonly lastMeasuredPose: OpticalPose | null;
  readonly lastCapturedAtMs: number | null;
}
/** Explicit measurement tolerances for {@link createMuseOpticalController}; none are inferred from FOV or a pen image. */
export interface OpticalTrackingOptions {
  readonly model: OpticalModel;
  readonly maxFrameAgeMs: number;
  readonly maxStereoSkewMs: number;
  readonly maxFutureMs: number;
  readonly maxRaySeparationMeters: number;
  readonly minAngleRadians: number;
  readonly maxReprojectionPixels: number;
  readonly maxRigidResidualMeters: number;
  readonly now?: () => number;
  readonly monotonicNow?: () => number;
}
/** Own a finite, per-instance measurement gate. Retain this controller in a ref and call tick while presenting it.
 * Every accepted pose derives from stereo pixels and independently supplied physical geometry.
 * Camera coordinates must already be undistorted, and world extrinsics must be measured at each frame time.
 */
export function createMuseOpticalController(options: OpticalTrackingOptions) {
  const positive=(n:number)=>Number.isFinite(n)&&n>0;
  if(!options.model.id||options.model.points.length>32||!solveRigidOpticalPose({correspondences:options.model.points.map(p=>({id:p.id,physicalPointMeters:p.meters,worldPointMeters:p.meters})),maxResidualMeters:1e-9}))throw new Error('At least three identified, noncollinear measured model points are required');
  if(![options.maxFrameAgeMs,options.maxStereoSkewMs,options.maxRaySeparationMeters,options.minAngleRadians,options.maxReprojectionPixels,options.maxRigidResidualMeters].every(positive)||!Number.isFinite(options.maxFutureMs)||options.maxFutureMs<0||options.minAngleRadians>=Math.PI/2)throw new Error('Invalid optical measurement tolerances');
  const modelId=options.model.id;
  const model=new Map(options.model.points.map(p=>[p.id,[...p.meters] as unknown as OpticalVector]));
  const now=options.now??Date.now,monotonicNow=options.monotonicNow??(()=>performance.now());
  const state=createStore<OpticalTrackingState>(()=>({phase:'unavailable',reason:'No optical session',sessionId:null,lastSequence:-1,acceptedFrames:0,currentPose:null,lastMeasuredPose:null,lastCapturedAtMs:null}));
  const seen=new Set<string>();
  let session:{id:string;calibrationId:string;startedAtMs:number;expiresAtMs:number;deadline:number}|null=null;
  let lastAcceptedMonotonic:number|null=null;
  const unavailable=(reason:string)=>state.setState({phase:'unavailable',reason,currentPose:null});
  function tick():void {
    if(!session)return;
    if(now()>=session.expiresAtMs||monotonicNow()>=session.deadline){session=null;unavailable('Optical session expired');return;}
    const s=state.getState();
    if(s.currentPose&&s.lastCapturedAtMs!==null&&(now()-s.lastCapturedAtMs>options.maxFrameAgeMs||(lastAcceptedMonotonic!==null&&monotonicNow()-lastAcceptedMonotonic>options.maxFrameAgeMs)))unavailable('Optical observations stale');
  }
  return {
    state,
    /** Start only from a fresh camera session; old nonces cannot be reused on this controller. */
    startSession(input:{sessionId:string;calibrationId:string;startedAtMs:number;expiresAtMs:number}):boolean {
      tick();
      if(session||seen.size>=256||!input.sessionId||input.sessionId.length>128||seen.has(input.sessionId)||!input.calibrationId||!Number.isFinite(input.startedAtMs)||!Number.isFinite(input.expiresAtMs)||input.startedAtMs>now()+options.maxFutureMs||now()-input.startedAtMs>options.maxFrameAgeMs||input.expiresAtMs<=now()||input.expiresAtMs<=input.startedAtMs||input.expiresAtMs-input.startedAtMs>60000)return false;
      seen.add(input.sessionId);session={...input,id:input.sessionId,deadline:monotonicNow()+input.expiresAtMs-now()};lastAcceptedMonotonic=null;
      state.setState({phase:'waiting',reason:'Awaiting measured optical correspondences',sessionId:input.sessionId,lastSequence:-1,acceptedFrames:0,currentPose:null,lastMeasuredPose:null,lastCapturedAtMs:null});return true;
    },
    /** Returns false and clears the current pose on invalid current-session measurements. */
    ingestStereoFrame(frame:OpticalStereoFrame):boolean {
      tick();if(!session||!frame||typeof frame!=='object'||frame.sessionId!==session.id)return false;
      const fail=(reason:string)=>{unavailable(reason);return false;};
      if(!frame.first||!frame.second||!frame.first.camera||!frame.second.camera||!Array.isArray(frame.correspondences)||frame.correspondences.some(p=>!p||typeof p.id!=='string'||!Array.isArray(p.firstPixel)||!Array.isArray(p.secondPixel)))return fail('Malformed optical frame');
      if(frame.calibrationId!==session.calibrationId||frame.modelId!==modelId)return fail('Optical calibration or model changed');
      const s=state.getState(),a=frame.first.capturedAtMs,b=frame.second.capturedAtMs;
      if(!Number.isSafeInteger(frame.sequence)||frame.sequence<=s.lastSequence||![a,b].every(Number.isFinite)||Math.abs(a-b)>options.maxStereoSkewMs||Math.min(a,b)<session.startedAtMs||Math.max(a,b)>now()+options.maxFutureMs||now()-Math.min(a,b)>options.maxFrameAgeMs||Math.max(a,b)>session.expiresAtMs||(s.lastCapturedAtMs!==null&&Math.min(a,b)<=s.lastCapturedAtMs))return fail('Stale, reordered or unsynchronized optical frame');
      // Consume the frame sequence even if geometric evidence fails; replay cannot repair an observed loss.
      state.setState({lastSequence:frame.sequence});
      if(frame.correspondences.length<3||frame.correspondences.length>32||new Set(frame.correspondences.map(p=>p.id)).size!==frame.correspondences.length)return fail('Insufficient distinct physical correspondences');
      const points=[];
      for(const p of frame.correspondences){
        const physicalPointMeters=model.get(p.id);if(!physicalPointMeters)return fail('Unknown physical correspondence');
        const worldPointMeters=triangulateOpticalPixels({first:{camera:frame.first.camera,pixel:p.firstPixel},second:{camera:frame.second.camera,pixel:p.secondPixel},maxRaySeparationMeters:options.maxRaySeparationMeters,minAngleRadians:options.minAngleRadians,maxReprojectionPixels:options.maxReprojectionPixels});
        if(!worldPointMeters)return fail('Stereo geometry or reprojection rejected');
        points.push({id:p.id,physicalPointMeters,worldPointMeters});
      }
      const pose=solveRigidOpticalPose({correspondences:points,maxResidualMeters:options.maxRigidResidualMeters});if(!pose)return fail('Rigid optical geometry rejected');
      lastAcceptedMonotonic=monotonicNow();
      state.setState({phase:'tracking',reason:'Measured stereo optical pose',acceptedFrames:s.acceptedFrames+1,currentPose:pose,lastMeasuredPose:pose,lastCapturedAtMs:Math.min(a,b)});return true;
    },
    /** Explicit occlusion/detection loss never fabricates a pose, release, or zero-valued measurement. */
    reportLoss(sessionId:string,reason='Optical target lost'):void {if(session?.id===sessionId)unavailable(reason);},
    /** End camera ownership; historical pose remains labelled separately from current output. */
    finishSession(sessionId:string):void {if(session?.id===sessionId){session=null;unavailable('Optical session ended');}},
    tick,
  };
}
