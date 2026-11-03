import assert from 'node:assert/strict';
import test from 'node:test';
import { createCalibratedMotionSurface, resolveCalibratedMotionSurface } from './muse-motion-surface.ts';

test('ordinary facade rerenders keep calibration and dispatch through the current handle',()=>{
  const calls:string[]=[];
  const current={generation:2,surfaceVersion:3,ready:true,foreground:true,handle:{injectPointer(){calls.push('old');}}};
  const calibration=createCalibratedMotionSurface(2,3,800,400);
  const before=resolveCalibratedMotionSurface(calibration,()=>current);
  current.handle={injectPointer(){calls.push('new');}};
  const after=resolveCalibratedMotionSurface(calibration,()=>current);
  assert.ok(before&&after);assert.equal(before.identity,after.identity);
  before.injectPointer({phase:'begin',x:400,y:200});
  assert.deepEqual(calls,['new']);
});
test('real mount changes and unavailable surfaces reject rather than injecting into a replacement',()=>{
  for(const field of ['generation','surfaceVersion','ready','foreground'] as const){
    let writes=0;
    const current={generation:2,surfaceVersion:3,ready:true,foreground:true,handle:{injectPointer(){writes++;}}};
    const calibration=createCalibratedMotionSurface(2,3,800,400);
    const active=resolveCalibratedMotionSurface(calibration,()=>current);assert.ok(active);
    if(field==='generation'||field==='surfaceVersion')current[field]++;else current[field]=false;
    assert.equal(resolveCalibratedMotionSurface(calibration,()=>current),null);
    assert.throws(()=>active.injectPointer({phase:'move',x:1,y:1}));assert.equal(writes,0);
  }
});
test('background cancellation may close only the same mounted engine',()=>{
  let cancels=0;
  const current={generation:1,surfaceVersion:1,ready:true,foreground:true,handle:{injectPointer(){cancels++;}}};
  const active=resolveCalibratedMotionSurface(createCalibratedMotionSurface(1,1,800,400),()=>current);assert.ok(active);
  current.foreground=false;active.injectPointer({phase:'cancel',x:1,y:1});assert.equal(cancels,1);
  current.surfaceVersion++;assert.throws(()=>active.injectPointer({phase:'cancel',x:1,y:1}));assert.equal(cancels,1);
});
