import assert from 'node:assert/strict';
import test from 'node:test';
import { Store, type ShapeRecord } from '@quickdrawjs/core';
import { createBoardDoc } from '../../../../packages/app/features/tutor/board-doc.ts';
import { createMuseMotionController, readMuseAcceleration, type MotionPointer } from './muse-motion.ts';
import { MUSE_COLLECTOR_APK_SHA256, MUSE_REPORT_MAP_SHA256 } from './muse-telemetry.ts';

function fixture(sink?:(sample:MotionPointer)=>void) {
  let now=100000,sequence=0;
  const events:MotionPointer[]=[],identity={};
  const controller=createMuseMotionController(()=>({identity,width:800,height:400,injectPointer(p){events.push(p);sink?.(p);}}),()=>now);
  const meta={schemaVersion:1,sessionId:'motion_nonce_fixture_001',collectorApkSha256:MUSE_COLLECTOR_APK_SHA256,reportMapSha256:MUSE_REPORT_MAP_SHA256,reportReferenceHex:'0201',startedAtWallTimeMs:now,expiresAtWallTimeMs:now+40000,maxSamples:100,capability:'external-test-telemetry'};
  const sample=(tip=0,x=0,z=2008,round=false,gapCount=0)=>{
    const bytes=new Uint8Array(65),view=new DataView(bytes.buffer);bytes[0]=tip;bytes[1]=tip;bytes[4]=round?7:5;view.setInt16(5,x,true);view.setInt16(9,z,true);
    const envelope={...meta,gapCount,samples:[{sequence:sequence++,gattStatus:0,byteLength:65,rawHex:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),wallTimeMs:now,elapsedPollingMs:now-meta.startedAtWallTimeMs}]};
    const accepted=controller.ingestCapture(envelope);now+=250;return accepted;
  };
  return {controller,meta,sample,events,skip:()=>{sequence++;},advance:(ms:number)=>{now+=ms;}};
}
test('measured tilt moves a bounded client cursor; actual tip release ends a stroke',()=>{
  const f=fixture();assert.equal(f.controller.startSession(f.meta),false);f.controller.arm();assert.equal(f.controller.startSession(f.meta),true);
  f.sample();f.sample(100);f.sample(80,500,1945);f.sample(0,500,1945);
  assert.deepEqual(f.events.map(x=>x.phase),['begin','move','end']);
  assert.ok(f.events[1]!.x>f.events[0]!.x);assert.ok(f.events.every(x=>x.x>=0&&x.x<=800&&x.y>=0&&x.y<=400));
  assert.equal(f.events[1]!.pressure,0.8);assert.equal(f.controller.state.getState().pointerUp,1);
});
test('gap while held cancels and requires a measured release before another stroke',()=>{
  const f=fixture();f.controller.arm();f.controller.startSession(f.meta);f.sample();f.sample(100);f.skip();f.sample(100,200,1998,false,1);
  assert.deepEqual(f.events.map(x=>x.phase),['begin','cancel']);
  f.sample(100,300,1985,false,1);assert.equal(f.events.length,2);
  f.sample(0,300,1985,false,1);f.sample(100,300,1985,false,1);assert.equal(f.events.at(-1)?.phase,'begin');
});
test('a gap inside one accepted batch cannot join two held intervals',()=>{
  const f=fixture();f.controller.arm();f.controller.startSession(f.meta);f.sample();f.sample(100);
  const bytes=new Uint8Array(65);bytes[0]=100;bytes[1]=100;bytes[4]=5;new DataView(bytes.buffer).setInt16(9,2008,true);
  const rawHex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const sample=(sequence:number,time:number)=>({sequence,gattStatus:0,byteLength:65,rawHex,wallTimeMs:100000+time,elapsedPollingMs:time});
  assert.equal(f.controller.ingestCapture({...f.meta,gapCount:1,samples:[sample(2,500),sample(4,750)]}),true);
  assert.deepEqual(f.events.map(x=>x.phase),['begin','cancel']);
  assert.equal(f.controller.state.getState().needsTipRelease,true);
  assert.equal(f.controller.arm(),false,'live capture cannot be recalibrated/rearmed');
});
test('round recenter, dynamic rejection and finite-session finish cancel without forged release',()=>{
  for(const action of ['round','dynamic','finish','stale']){
    const f=fixture();f.controller.arm();f.controller.startSession(f.meta);f.sample();f.sample(100);
    if(action==='round')f.sample(100,0,2008,true);
    if(action==='dynamic')f.sample(100,0,30000);
    if(action==='finish')f.controller.finishSession(f.meta.sessionId);
    if(action==='stale'){f.advance(4000);f.controller.tick();}
    assert.deepEqual(f.events.map(x=>x.phase),['begin','cancel']);assert.equal(f.events.at(-1)?.pressure,undefined);
    assert.equal(f.controller.state.getState().pointerUp,0);
  }
});
test('pointer-model engine edits use the real Yjs authority and preserve undo/redo',()=>{
  const doc=createBoardDoc(),engine=new Store();let shape:ShapeRecord|null=null;
  const stop=engine.listen((diff,source)=>{if(source==='user')doc.applyDiff(diff,'local');});
  const f=fixture((p)=>{
    if(p.phase==='begin'){doc.beginGesture();engine.beginBatch();shape={id:'measured-input',typeName:'shape',type:'draw',x:0,y:0,z:1,rot:0,props:{pts:[p.x,p.y,p.pressure??0],color:'black',size:'m',dash:'draw'}};engine.put(shape);}
    else if(p.phase==='move'&&shape){shape={...shape,props:{...shape.props,pts:[...shape.props.pts,p.x,p.y,p.pressure??0]}};engine.update(shape.id,{props:shape.props});}
    else if(p.phase==='end'||p.phase==='cancel'){if(p.phase==='cancel'&&shape)engine.remove([shape.id]);engine.endBatch();doc.endGesture();shape=null;}
  });
  f.controller.arm();f.controller.startSession(f.meta);f.sample();f.sample(100);f.sample(80,500,1945);f.sample(0,500,1945);
  const ids=()=>Object.keys((doc.snapshot() as {document:{store:object}}).document.store);
  assert.deepEqual(ids(),['measured-input']);doc.undo();assert.deepEqual(ids(),[]);doc.redo();assert.deepEqual(ids(),['measured-input']);
  stop();doc.destroy();
});
test('acceleration decoder reads signed little-endian measured bytes only',()=>{
  const bytes=new Uint8Array(65);new DataView(bytes.buffer).setInt16(5,-1234,true);new DataView(bytes.buffer).setInt16(7,80,true);new DataView(bytes.buffer).setInt16(9,2008,true);
  assert.deepEqual(readMuseAcceleration(Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')),[-1234,80,2008]);assert.equal(readMuseAcceleration('00'),null);
});
