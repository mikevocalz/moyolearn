import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createMuseTelemetryController, decodeMuseControls, MUSE_COLLECTOR_APK_SHA256, MUSE_REPORT_MAP_SHA256 } from './muse-telemetry.ts';

const hex = (prefix: string) => prefix + '00'.repeat(60);
function fixture() {
  let clock = 100_000;
  const controller = createMuseTelemetryController(() => clock);
  const meta = {schemaVersion:1,sessionId:'fresh_host_nonce_0001',collectorApkSha256:MUSE_COLLECTOR_APK_SHA256,reportMapSha256:MUSE_REPORT_MAP_SHA256,reportReferenceHex:'0201',startedAtWallTimeMs:clock,expiresAtWallTimeMs:clock+40_000,maxSamples:100,capability:'external-test-telemetry'};
  const sample = (sequence=0,prefix='6464000005') => ({sequence,gattStatus:0,byteLength:65,rawHex:hex(prefix),wallTimeMs:clock,elapsedPollingMs:clock-meta.startedAtWallTimeMs});
  const envelope = (samples=[sample()]) => ({schemaVersion:1,sessionId:meta.sessionId,collectorApkSha256:meta.collectorApkSha256,reportMapSha256:meta.reportMapSha256,reportReferenceHex:'0201',gapCount:0,samples});
  return {controller,meta,sample,envelope,advance:(ms:number)=>{clock+=ms;}};
}

test('decoder pins the acquired descriptor and maps only independently observed control fields',()=>{
  const bytes=readFileSync(new URL('../../../../docs/forge-board/evidence/muse-hid-report-map.bin',import.meta.url));
  assert.equal(bytes.length,457); assert.equal(createHash('sha256').update(bytes).digest('hex'),MUSE_REPORT_MAP_SHA256);
  assert.deepEqual(decodeMuseControls(hex('6464000005')),{tip:100,tipForce:100,roundHeld:false,oval:0,ovalForce:0});
  assert.deepEqual(decodeMuseControls(hex('0000000007')),{tip:0,tipForce:0,roundHeld:true,oval:0,ovalForce:0});
  assert.equal(decodeMuseControls(hex('0000646405'))?.ovalForce,100);
  assert.equal(decodeMuseControls(hex('0000121205'))?.oval,18);
  assert.equal(decodeMuseControls(hex('0000000005'))?.tip,0);
  assert.equal(decodeMuseControls('00'),null); assert.equal(decodeMuseControls('z'.repeat(130)),null);
  assert.equal(decodeMuseControls(hex('ff00000005')),null);
});

test('fresh session accepts measured samples; completion retains historical values and blocks new data',()=>{
  const f=fixture(); assert.equal(f.controller.startSession(f.meta),true);
  assert.equal(f.controller.ingestCapture(f.envelope()),true); f.advance(250);
  assert.equal(f.controller.ingestCapture(f.envelope([f.sample(1,'0000121205')])),true);
  assert.equal(f.controller.finishSession(f.meta.sessionId),true);
  assert.equal(f.controller.state.getState().phase,'completed');
  assert.equal(f.controller.state.getState().values?.oval,18);
  assert.equal(f.controller.ingestCapture(f.envelope([f.sample(2)])),false);
});

test('expiry and stale reader mark unavailable without fabricating zero or release values',()=>{
  for(const elapsed of [3001,40_001]) {
    const f=fixture(); f.controller.startSession(f.meta); f.controller.ingestCapture(f.envelope());
    const measured=f.controller.state.getState().values; f.advance(elapsed); f.controller.tick();
    assert.equal(f.controller.state.getState().phase,'unavailable');
    assert.equal(f.controller.state.getState().values,measured);
    assert.equal(f.controller.state.getState().values?.tip,100);
    assert.equal(f.controller.ingestCapture(f.envelope([f.sample(1)])),false);
  }
});

test('monotonic deadline still expires a session if the wall clock moves backwards',()=>{
  const f=fixture();let wall=100_000,elapsed=0;
  const c=createMuseTelemetryController(()=>wall,()=>elapsed);c.startSession(f.meta);c.ingestCapture(f.envelope());
  wall=90_000;elapsed=40_001;c.tick();
  assert.equal(c.state.getState().phase,'unavailable');assert.equal(c.state.getState().values?.tip,100);
});

test('sessions reject old metadata, reused nonces, wrong pins/references and overlong capability windows',()=>{
  const f=fixture();
  for(const patch of [{collectorApkSha256:'wrong'},{reportMapSha256:'wrong'},{reportReferenceHex:'0202'},{capability:'normal-production'},{expiresAtWallTimeMs:140001},{startedAtWallTimeMs:90000},{maxSamples:101},{sessionId:'short'}]) {
    assert.equal(f.controller.startSession({...f.meta,...patch}),false);
  }
  assert.equal(f.controller.startSession(f.meta),true); assert.equal(f.controller.startSession(f.meta),false);
  f.controller.finishSession(f.meta.sessionId);
  assert.equal(f.controller.startSession({...f.meta,sessionId:'fresh_host_nonce_0002'}),true);
  assert.equal(f.controller.ingestCapture(f.envelope()),false);
  assert.equal(f.controller.state.getState().samples,0);
});

test('active session owns the viewer until completed or unavailable; old data cannot enter a replacement',()=>{
  const f=fixture();f.controller.startSession(f.meta);f.controller.ingestCapture(f.envelope());
  const previous=f.controller.state.getState();
  const next={...f.meta,sessionId:'fresh_host_nonce_0002'};
  assert.equal(f.controller.startSession(next),false);
  assert.equal(f.controller.state.getState(),previous);
  assert.equal(f.controller.finishSession(f.meta.sessionId),true);
  assert.equal(f.controller.startSession(next),true);
  assert.equal(f.controller.ingestCapture(f.envelope()),false);
  assert.equal(f.controller.finishSession(next.sessionId),true);
  const completed=f.controller.state.getState();
  assert.equal(f.controller.ingestCapture(f.envelope()),false);
  assert.equal(f.controller.state.getState(),completed);
});

test('malformed/reordered batches are rejected atomically and cannot overwrite the last measurement',()=>{
  const f=fixture();f.controller.startSession(f.meta);f.controller.ingestCapture(f.envelope());f.advance(250);
  const before=f.controller.state.getState();
  for(const patch of [{sequence:0},{sequence:100},{gattStatus:5},{byteLength:64},{rawHex:'00'},{elapsedPollingMs:10000},{wallTimeMs:99999},{wallTimeMs:Infinity}]) {
    assert.equal(f.controller.ingestCapture(f.envelope([f.sample(1),{...f.sample(2),...patch}])),false);
    assert.equal(f.controller.state.getState(),before);
  }
  assert.equal(f.controller.ingestCapture({...f.envelope(),sessionId:'stale_host_nonce_9999'}),false);
});

test('one hundred sequential actual-shape samples are bounded and complete automatically',()=>{
  const f=fixture();f.controller.startSession(f.meta);
  for(let i=0;i<100;i++) {
    if(i)f.advance(250);
    assert.equal(f.controller.ingestCapture(f.envelope([f.sample(i)])),true);
  }
  assert.equal(f.controller.state.getState().phase,'completed');
  assert.equal(f.controller.state.getState().samples,100);
  assert.equal(f.controller.finishSession(f.meta.sessionId),true);
  assert.equal(f.controller.ingestCapture(f.envelope([f.sample(100)])),false);
});

test('fresh subset records initial and internal sequence gaps instead of claiming a complete stream',()=>{
  const f=fixture();f.controller.startSession(f.meta);
  assert.equal(f.controller.ingestCapture(f.envelope([f.sample(5)])),true);f.advance(250);
  assert.equal(f.controller.ingestCapture(f.envelope([f.sample(8)])),true);
  assert.equal(f.controller.state.getState().samples,2);
  assert.equal(f.controller.state.getState().missingSequences,7);
  assert.equal(f.controller.state.getState().lastSequence,8);
});

test('host gap receipts remain monotonic and do not double count later observed sequence gaps',()=>{
  const f=fixture();f.controller.startSession(f.meta);
  assert.equal(f.controller.ingestCapture({...f.envelope(),gapCount:4}),true);f.advance(250);
  assert.equal(f.controller.ingestCapture({...f.envelope([f.sample(5)]),gapCount:4}),true);
  assert.equal(f.controller.state.getState().missingSequences,4);
  f.advance(250);
  assert.equal(f.controller.ingestCapture({...f.envelope([f.sample(6)]),gapCount:3}),false);
  assert.equal(f.controller.state.getState().samples,2);
});
