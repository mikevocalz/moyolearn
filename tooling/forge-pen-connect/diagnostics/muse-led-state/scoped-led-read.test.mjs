import assert from 'node:assert/strict';
import test from 'node:test';
import { runScopedLedRead, validateLedConfig, ledReadPlan, verifyLedReadEvidence, PROBE_PACKAGE, PROBE_SELECTOR, WATCHDOG_MS, RESTORE_MS } from './scoped-led-read.mjs';
const config={deviceId:'TEST_QUEST',outputDirectory:'/tmp/moyo-led-unit',approvedFiniteQuestInspectionPause:true,normalGattClosed:true,probeInactive:true,installedApkPullVerified:true};
function harness(mode='success',external){
 let now=0,watchdog;const calls=[];
 const record=(name,args,ms)=>calls.push({name,args,ms});
 const handle={done:Promise.resolve()};
 const io={now:()=>now,setTimer(fn,ms){assert.equal(ms,WATCHDOG_MS);watchdog=fn;return 1;},clearTimer(){record('clear');},
  async preflight(){record('preflight');if(mode==='identity')throw new Error('Wrong installed identity');return{unitFixture:true};},
  async pause(args,ms){record('pause',args,ms);now+=1000;if(mode==='pause-error')throw new Error('Partial pause failure');if(mode==='cancel-pause')external.abort();},
  launchRead(args){record('launch',args);if(mode==='error')return{done:Promise.reject(new Error('Probe failed'))};if(mode==='cancel'){external.abort();return{done:new Promise(()=>{})};}if(mode==='timeout'){now=WATCHDOG_MS;watchdog();return{done:new Promise(()=>{})};}now+=21000;return handle;},
  async stopOwned(h,ms){record('stop-own',h,ms);now+=500;if(mode==='stop-error')throw new Error('Stop unconfirmed');},
  async terminateProbe(args,ms){record('force-own',args,ms);now+=2000;if(mode==='force-error')throw new Error('Own package stop unconfirmed');},
  async restore(args,ms){record('restore',args,ms);now+=RESTORE_MS;if(mode==='restore-error')throw new Error('Inspection unavailable');if(mode==='restore-wrong')return{source:'other',description:'No native acknowledgement'};if(mode==='restore-late')now=60001;return{source:'android-devtools',description:'Actual nonempty tree acknowledgement fixture'};},
 };
 return{io,calls};
}
function restoredOnce(calls){assert.deepEqual(calls.find(c=>c.name==='pause').args,{devices:[config.deviceId]});const r=calls.filter(c=>c.name==='restore');assert.equal(r.length,1);assert.deepEqual(r[0].args,{udid:config.deviceId});assert.equal(r[0].ms,RESTORE_MS);for(const c of calls.filter(c=>c.name==='force-own'))assert.deepEqual(c.args,{deviceId:config.deviceId,packageName:PROBE_PACKAGE});}
test('success stops only owned host handle and restores inspection with measured acknowledgement',async()=>{const h=harness();const r=await runScopedLedRead(config,h.io);assert.equal(r.success,true);assert.equal(r.completed,true);restoredOnce(h.calls);assert.equal(h.calls.some(c=>c.name==='force-own'),false);assert.deepEqual(h.calls.find(c=>c.name==='launch').args,{deviceId:config.deviceId,selector:PROBE_SELECTOR});});
for(const mode of ['error','cancel','timeout'])test(`${mode} stops own probe and restores once within the scoped window`,async()=>{const external=new AbortController(),h=harness(mode,external);const r=await runScopedLedRead(config,h.io,external.signal);assert.equal(r.outcome,mode==='error'?'error':mode==='cancel'?'cancelled':'timeout');assert.equal(r.success,false);restoredOnce(h.calls);assert.equal(h.calls.filter(c=>c.name==='force-own').length,1);assert.equal(r.cleanup.probeForceStopAcknowledged,true);assert.ok(r.restoration.elapsedMs<60000);assert.ok(h.calls.findIndex(c=>c.name==='force-own')<h.calls.findIndex(c=>c.name==='restore'));});
for(const mode of ['pause-error','cancel-pause'])test(`${mode} restores even without launching a read`,async()=>{const external=new AbortController(),h=harness(mode,external);const r=await runScopedLedRead(config,h.io,external.signal);assert.equal(r.success,false);restoredOnce(h.calls);assert.equal(h.calls.some(c=>c.name==='launch'),false);});
for(const mode of ['restore-error','restore-wrong','restore-late','stop-error'])test(`${mode} cannot be claimed a successful cleanup`,async()=>{const h=harness(mode);const r=await runScopedLedRead(config,h.io);assert.equal(r.success,false);restoredOnce(h.calls);if(mode==='stop-error')assert.equal(r.cleanup.hostProcessStopped,false);});
test('missing fresh approval, ownership or installed identity never pauses inspection',async()=>{for(const key of ['approvedFiniteQuestInspectionPause','normalGattClosed','probeInactive','installedApkPullVerified']){const h=harness();await assert.rejects(runScopedLedRead({...config,[key]:false},h.io));assert.equal(h.calls.length,0);}const h=harness('identity');await assert.rejects(runScopedLedRead(config,h.io),/identity/);assert.equal(h.calls.some(c=>c.name==='pause'),false);});
test('already-cancelled run does not preflight/pause and cancellation in preflight stays untouched',async()=>{const external=new AbortController();external.abort();const h=harness();await assert.rejects(runScopedLedRead(config,h.io,external.signal));assert.equal(h.calls.length,0);const controller=new AbortController();h.io.preflight=async()=>{controller.abort();return{};};await assert.rejects(runScopedLedRead(config,h.io,controller.signal));assert.equal(h.calls.some(c=>c.name==='pause'),false);});
test('config cannot replace package, executable, selector or arbitrary output paths; dry plan requires no approval',()=>{assert.throws(()=>validateLedConfig({...config,packageName:'other'}));assert.throws(()=>validateLedConfig({...config,metaCliPath:'/arbitrary'}));assert.throws(()=>validateLedConfig({...config,outputDirectory:'/tmp/../private/file'}));const p=ledReadPlan({...config,approvedFiniteQuestInspectionPause:false});assert.equal(p.executionAuthorized,false);assert.equal(p.selector,PROBE_SELECTOR);assert.deepEqual(p.pause.args,{devices:[config.deviceId]});assert.equal(p.read.arguments.at(-1),PROBE_SELECTOR);});
const receipt={completed:true,cleanupCompleted:true,reportMapSha256:'4708e62215883a297c88be41600d2ddea20345ecfbe41213db47f7d6778b3405',outputReportReadStatus:0,outputReportReferenceHex:'0402',outputPayloadByteLength:14,deviceWrites:false,productionAccess:false,opticalEmissionVerified:false};
const evidence=r=>JSON.stringify({evidence_id:'unit-evidence-not-hardware',operation:'capture_process_scenario',normalized_result:{exit:{reason:'exited',code:0},truncated:false,cleanup:{owned_process_group:'verified'},frames:[{data:'INSTRUMENTATION_RESULT: resultJson='+JSON.stringify(r)+'\r\n'}],rendered_frames:[]}});
test('actual raw JSON receipt is required, not exit0 or a synthetic/clipped renderer success label',()=>{assert.equal(verifyLedReadEvidence(evidence(receipt)).receipt.completed,true);for(const r of [{...receipt,completed:false},{...receipt,cleanupCompleted:false},{...receipt,outputReportReadStatus:5},{...receipt,reportMapSha256:'wrong'}])assert.throws(()=>verifyLedReadEvidence(evidence(r)));const e=JSON.parse(evidence(receipt));e.normalized_result.frames=[];e.normalized_result.rendered_frames=[{lines:['completed:true cleanup:true']}];assert.throws(()=>verifyLedReadEvidence(JSON.stringify(e)));e.normalized_result.truncated=true;assert.throws(()=>verifyLedReadEvidence(JSON.stringify(e)));});
test('unconfirmed own-package stop still restores and remains explicitly unconfirmed',async()=>{const h=harness('error');h.io.terminateProbe=async()=>{throw new Error('Device stop failed');};const r=await runScopedLedRead(config,h.io);assert.equal(r.success,false);assert.equal(r.cleanup.probeForceStopAcknowledged,false);assert.match(r.cleanup.probeForceStopError,/failed/);restoredOnce(h.calls);});

test('unverified REA owned process-group cleanup cannot become successful read evidence',()=>{const e=JSON.parse(evidence(receipt));e.normalized_result.cleanup.owned_process_group='unverified';assert.throws(()=>verifyLedReadEvidence(JSON.stringify(e)));});

import { launchOwnedLedCommand } from './scoped-led-read.mjs';
const ignoresTermination = "process.on('SIGTERM',()=>{});setInterval(()=>{},1000);";
function assertGone(pid){assert.throws(()=>process.kill(pid,0),error=>error.code==='ESRCH');}
test('real timed-out child ignoring SIGTERM closes before done rejects and before restoration can start',async()=>{
 const child=launchOwnedLedCommand(process.execPath,['-e',ignoresTermination],{timeoutMs:1000});
 assert.ok(child.pid);const start=performance.now();
 await assert.rejects(child.done,/deadline/);assertGone(child.pid);assert.ok(performance.now()-start>=1150);
 // A pause adapter awaiting done cannot start restoration before the child is gone.
 const h=harness();let pauseChild;h.io.pause=()=>{pauseChild=launchOwnedLedCommand(process.execPath,['-e',ignoresTermination],{timeoutMs:1000});return pauseChild.done;};h.io.restore=async()=>{assertGone(pauseChild.pid);return{source:'android-devtools',description:'Unit restoration acknowledgement'};};
 const result=await runScopedLedRead(config,h.io);assert.equal(result.outcome,'error');assert.equal(result.restoration.acknowledged,true);
});
test('real output-bound child also closes before rejection; explicit stop waits for close',async()=>{
 const flood=launchOwnedLedCommand(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>process.stdout.write('0123456789'),5);"],{maxBytes:20});
 await assert.rejects(flood.done,/output bound/);assertGone(flood.pid);
 const stopped=launchOwnedLedCommand(process.execPath,['-e',ignoresTermination]);await new Promise(resolve=>setTimeout(resolve,150));await stopped.stop();assertGone(stopped.pid);
});
test('spawn failure settles through close without hanging cleanup',async()=>{const child=launchOwnedLedCommand('/not/an/executable',[],{timeoutMs:500});await assert.rejects(child.done,/ENOENT/);await child.stop();});
