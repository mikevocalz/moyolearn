import test from 'node:test';
import assert from 'node:assert/strict';
import {createTiltReference,projectGravityTilt,type TiltAcceleration} from './muse-tilt.ts';
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('measured recenter maps to center and tolerates actual resting magnitude changes',()=>{
 const reference=createTiltReference([-1352,-1026,-1069]);assert.ok(reference);
 const point=projectGravityTilt(reference,[-1352,-1026,-1069]);assert.ok(point);close(point.u,0.5);close(point.v,0.5);
 assert.ok(projectGravityTilt(reference,[-1344,-1024,-1081]));
});
test('calibrated tangent rotations produce edges and clamp larger tilt without inventing position',()=>{
 const reference=createTiltReference([0,0,2008]);assert.ok(reference);
 const tilt=(degrees:number):TiltAcceleration=>[2008*Math.sin(degrees*Math.PI/180),0,2008*Math.cos(degrees*Math.PI/180)];
 close(projectGravityTilt(reference,tilt(30))!.u,1);close(projectGravityTilt(reference,tilt(-30))!.u,0);
 close(projectGravityTilt(reference,tilt(60))!.u,1);
 const vertical=projectGravityTilt(reference,[0,1004,2008*Math.cos(Math.PI/6)])!;close(vertical.v,0);
});
test('reference basis remains orthogonal when gravity is parallel to the default device axis',()=>{
 for(const acceleration of [[2008,0,0],[-2008,0,0],[0,2008,0],[0,0,-2008]] as TiltAcceleration[]){
  const reference=createTiltReference(acceleration);assert.ok(reference);const point=projectGravityTilt(reference,acceleration);assert.ok(point);close(point.u,0.5);close(point.v,0.5);
 }
});
test('rejects absent, nonfinite, dynamically contaminated, reversed and invalid-sensitivity samples',()=>{
 const reference=createTiltReference([0,0,2008]);assert.ok(reference);
 for(const sample of [[0,0,0],[NaN,0,2008],[Infinity,0,0],[0,0,4155],[0,0,1490],[0,0,-2008]] as TiltAcceleration[])assert.equal(projectGravityTilt(reference,sample),null);
 assert.equal(createTiltReference([0,0,4155]),null);assert.equal(createTiltReference([0,0,0]),null);
 for(const sensitivity of [0,-1,90,NaN])assert.equal(projectGravityTilt(reference,[0,0,2008],sensitivity),null);
});
test('explicit stationary calibration allows a different sensor scale without assigning physical units',()=>{
 const reference=createTiltReference([0,0,1000],1000);assert.ok(reference);close(projectGravityTilt(reference,[0,0,1000])!.u,0.5);
});
