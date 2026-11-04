import assert from 'node:assert/strict';
import test from 'node:test';
import { calibratedPixelRay, projectOpticalPoint, solveRigidOpticalPose, triangulateCalibratedRays, triangulateOpticalPixels } from './muse-optical-geometry.ts';
import type { OpticalCamera, OpticalVector, OpticalCorrespondence } from './muse-optical-geometry.ts';
import { createMuseOpticalController } from './muse-optical.ts';
import type { OpticalStereoFrame } from './muse-optical.ts';
const identity=[1,0,0,0,1,0,0,0,1] as const;
const camera=(id:string,x:number):OpticalCamera=>({id,width:800,height:600,fx:600,fy:600,cx:400,cy:300,pixels:'undistorted',worldFromCamera:{rotation:identity,translationMeters:[x,0,0]}});
const near=(a:readonly number[],b:readonly number[],epsilon=1e-8)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i]!)<epsilon,`${v} != ${b[i]}`));};
const model=[{id:'a',meters:[0,0,0] as const},{id:'b',meters:[0.1,0,0] as const},{id:'c',meters:[0,0.1,0] as const},{id:'d',meters:[0,0,0.1] as const}];
// Independent analytic Rz(90deg) + translation; fixture projection uses pinhole equations directly.
const transform=(v:OpticalVector):OpticalVector=>[-v[1]+0.1,v[0]-0.05,v[2]+2];
const project=(v:OpticalVector,x:number):readonly[number,number]=>[600*(v[0]-x)/v[2]+400,600*v[1]/v[2]+300];
function frame(sequence=0,time=1000):OpticalStereoFrame{return{sessionId:'session-one',calibrationId:'measured-stereo',modelId:'measured-marker',sequence,first:{camera:camera('left',-0.1),capturedAtMs:time},second:{camera:camera('right',0.1),capturedAtMs:time},correspondences:model.map(p=>({id:p.id,firstPixel:project(transform(p.meters),-0.1),secondPixel:project(transform(p.meters),0.1)}))};}
function setup(){let time=1000,mono=0;const controller=createMuseOpticalController({model:{id:'measured-marker',points:model},maxFrameAgeMs:100,maxStereoSkewMs:5,maxFutureMs:2,maxRaySeparationMeters:0.001,minAngleRadians:0.01,maxReprojectionPixels:0.25,maxRigidResidualMeters:0.001,now:()=>time,monotonicNow:()=>mono});const start=()=>controller.startSession({sessionId:'session-one',calibrationId:'measured-stereo',startedAtMs:1000,expiresAtMs:2000});return{controller,start,advance(n:number){time+=n;mono+=n;},setWall(n:number){time=n;}};}

test('explicit calibrated pixel generates forward metric ray and rejects invented/invalid calibration',()=>{
 const c=camera('left',0);near(calibratedPixelRay({camera:c,pixel:[400,300]})!.direction,[0,0,1]);
 const rotated={...c,worldFromCamera:{rotation:[0,0,1,0,1,0,-1,0,0] as const,translationMeters:[2,3,4] as const}};
 const ray=calibratedPixelRay({camera:rotated,pixel:[400,300]});assert.ok(ray);near(ray.direction,[1,0,0]);near(ray.originMeters,[2,3,4]);
 for(const bad of [{...c,fx:0},{...c,pixels:'distorted'},{...c,worldFromCamera:{...c.worldFromCamera,rotation:[-1,0,0,0,1,0,0,0,1]}}])assert.equal(calibratedPixelRay({camera:bad as OpticalCamera,pixel:[400,300]}),null);
 assert.equal(calibratedPixelRay({camera:c,pixel:[800,0]}),null);assert.equal(projectOpticalPoint({camera:c,pointMeters:[0,0,-1]}),null);
});
test('stereo recovers independently projected depth; rejects parallel, behind, skew and reprojection mismatch',()=>{
 const first={camera:camera('left',-0.1),pixel:project([0.15,0.2,2],-0.1)},second={camera:camera('right',0.1),pixel:project([0.15,0.2,2],0.1)};
 const limits={maxRaySeparationMeters:0.001,minAngleRadians:0.01,maxReprojectionPixels:0.25};near(triangulateOpticalPixels({first,second,...limits})!,[0.15,0.2,2]);
 const a={originMeters:[-0.1,0,0] as const,direction:[0,0,1] as const};
 assert.equal(triangulateCalibratedRays({first:a,second:{...a,originMeters:[0.1,0,0]},...limits}),null);
 assert.equal(triangulateCalibratedRays({first:{...a,direction:[-0.1,0,1]},second:{originMeters:[0.1,0,0],direction:[0.1,0,1]},...limits}),null);
 assert.equal(triangulateOpticalPixels({first,second:{...second,pixel:[second.pixel[0],second.pixel[1]+10]},...limits}),null);
 // Permit skew in meter space, but independently enforce its large image-space reprojection error.
 assert.equal(triangulateOpticalPixels({first,second:{...second,pixel:[second.pixel[0],second.pixel[1]+10]},...limits,maxRaySeparationMeters:1}),null);
});
test('known noncollinear rigid geometry recovers proper rotation and all correspondences verify',()=>{
 const points=model.map(p=>({id:p.id,physicalPointMeters:p.meters,worldPointMeters:transform(p.meters)}));
 const pose=solveRigidOpticalPose({correspondences:points,maxResidualMeters:1e-8});assert.ok(pose);near(pose.rotation,[0,-1,0,1,0,0,0,0,1]);near(pose.translationMeters,[0.1,-0.05,2]);
 const corrupted=points.map(p=>({...p}));corrupted[3]={...corrupted[3]!,worldPointMeters:[1,2,3]};assert.equal(solveRigidOpticalPose({correspondences:corrupted,maxResidualMeters:0.001}),null);
 const reflected=points.map(p=>({...p,worldPointMeters:[-p.worldPointMeters[0],p.worldPointMeters[1],p.worldPointMeters[2]] as const}));assert.equal(solveRigidOpticalPose({correspondences:reflected,maxResidualMeters:0.001}),null);
});
test('a tip, line, duplicate IDs or collinear geometry cannot become a 6DoF pose',()=>{
 const points=model.map(p=>({id:p.id,physicalPointMeters:p.meters,worldPointMeters:transform(p.meters)}));
 for(const input of [points.slice(0,1),points.slice(0,2),[points[0]!,points[0]!,points[2]!],[0,1,2].map(x=>({id:String(x),physicalPointMeters:[x,0,0],worldPointMeters:[x,0,1]}))])assert.equal(solveRigidOpticalPose({correspondences:input as OpticalCorrespondence[],maxResidualMeters:0.001}),null);
});
test('only fresh stereo measurements produce current pose; loss preserves historical values without output',()=>{
 const {controller:c,start,advance}=setup();assert.equal(start(),true);assert.equal(c.state.getState().currentPose,null);
 assert.equal(c.ingestStereoFrame(frame()),true);const measured=c.state.getState().currentPose;assert.ok(measured);assert.equal(c.state.getState().phase,'tracking');
 c.reportLoss('wrong-owner');assert.equal(c.state.getState().currentPose,measured);c.reportLoss('session-one');assert.equal(c.state.getState().currentPose,null);assert.equal(c.state.getState().lastMeasuredPose,measured);
 advance(10);assert.equal(c.ingestStereoFrame(frame(1,1010)),true);advance(101);c.tick();assert.equal(c.state.getState().currentPose,null);assert.equal(c.state.getState().phase,'unavailable');assert.ok(c.state.getState().lastMeasuredPose);
});
test('session/calibration ownership, replay, stereo skew and expiry fail closed',()=>{
 const {controller:c,start,advance}=setup();assert.equal(start(),true);assert.equal(start(),false);assert.equal(c.ingestStereoFrame(frame()),true);
 assert.equal(c.ingestStereoFrame({...frame(1),sessionId:'other'}),false);assert.ok(c.state.getState().currentPose);
 assert.equal(c.ingestStereoFrame(frame()),false);assert.equal(c.state.getState().currentPose,null);
 advance(10);assert.equal(c.ingestStereoFrame({...frame(1,1010),calibrationId:'other'}),false);
 assert.equal(c.ingestStereoFrame({...frame(1,1010),second:{...frame().second,capturedAtMs:1000}}),false);
 assert.equal(c.ingestStereoFrame(frame(1,1010)),true);advance(990);c.tick();assert.equal(c.state.getState().currentPose,null);assert.equal(c.ingestStereoFrame(frame(2,2000)),false);assert.equal(start(),false);
});
test('clock rollback cannot keep a stale pose alive and late previous-session frames cannot revive it',()=>{
 const {controller:c,start,advance,setWall}=setup();assert.ok(start());assert.ok(c.ingestStereoFrame(frame()));advance(101);setWall(1000);c.tick();assert.equal(c.state.getState().currentPose,null);
 c.finishSession('session-one');assert.equal(c.startSession({sessionId:'session-two',calibrationId:'measured-stereo',startedAtMs:1000,expiresAtMs:1800}),true);assert.equal(c.ingestStereoFrame(frame(1,1001)),false);assert.equal(c.state.getState().phase,'waiting');
});
test('unknown physical identity and invalid observations clear current pose instead of extrapolating',()=>{
 const {controller:c,start,advance}=setup();assert.ok(start());assert.ok(c.ingestStereoFrame(frame()));advance(10);
 const f=frame(1,1010);assert.equal(c.ingestStereoFrame({...f,correspondences:[{...f.correspondences[0]!,id:'unmeasured'},...f.correspondences.slice(1)]}),false);assert.equal(c.state.getState().currentPose,null);
 assert.equal(c.ingestStereoFrame(f),false);assert.equal(c.state.getState().acceptedFrames,1);
});

test('invalid finite session windows cannot arm',()=>{
 const {controller:c}=setup();assert.equal(c.startSession({sessionId:'invalid-window',calibrationId:'measured-stereo',startedAtMs:1002,expiresAtMs:1001}),false);assert.equal(c.state.getState().sessionId,null);
 assert.equal(c.startSession({sessionId:'too-long',calibrationId:'measured-stereo',startedAtMs:1000,expiresAtMs:62000}),false);
});

test('malformed current-owner transport data clears output without throwing',()=>{
 const {controller:c,start}=setup();assert.ok(start());assert.ok(c.ingestStereoFrame(frame()));
 assert.equal(c.ingestStereoFrame({...frame(1),first:undefined} as unknown as OpticalStereoFrame),false);assert.equal(c.state.getState().currentPose,null);
 assert.equal(c.ingestStereoFrame({...frame(1),correspondences:[null]} as unknown as OpticalStereoFrame),false);
});
