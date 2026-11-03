import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { createPenConnectionController } from '../src/controller.ts';
import type { BlePenPort } from '../src/types.ts';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return {promise, resolve};
};
const selected = {id:'actual-os-selection', name:'Logitech Muse', bonded:false};
const flush = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
function port(chooseDevice: NonNullable<BlePenPort['chooseDevice']>): BlePenPort {
  return {mode:'bluetooth-le', requestAccess:async()=>true, ensureEnabled:async()=>true,
    scan:async()=>[{id:'fresh-scan',name:'Real scanned accessory'}], cancelScan(){},
    chooseDevice, connect:async()=>({disconnect:async()=>{}})};
}

test('system chooser uses its own pairing state and actual selection without readiness or RSSI', async()=>{
  const selection=deferred<typeof selected>();
  const c=createPenConnectionController(port(()=>selection.promise));
  const pending=c.chooseSystemDevice(); await flush();
  assert.equal(c.state.getState().kind,'system-pairing');
  selection.resolve(selected); await pending;
  assert.deepEqual(c.state.getState(),{kind:'found',devices:[selected]});
  assert.equal('rssi' in selected,false);
  c.verifyNativeInput({tracked:true,evidence:'verified-pen-protocol',deviceId:selected.id});
  assert.equal(c.state.getState().kind,'found');
  await c.connect(selected.id);
  assert.equal(c.state.getState().kind,'linked'); c.dispose();
});

test('cancelling permission wait never opens a late OS chooser',async()=>{
  const access=deferred<boolean>(); let opens=0;
  const p=port(async()=>{opens++;return selected;}); p.requestAccess=()=>access.promise;
  const c=createPenConnectionController(p); const pending=c.chooseSystemDevice();
  await c.cancel(); access.resolve(true); await pending;
  assert.equal(opens,0); assert.equal(c.state.getState().kind,'idle'); c.dispose();
});

test('opening system selection releases the previous real link once',async()=>{
  let releases=0; const p=port(async()=>selected);
  p.connect=async()=>({disconnect:async()=>{releases++;}});
  const c=createPenConnectionController(p); await c.begin(); await c.connect('fresh-scan');
  await c.chooseSystemDevice(); assert.equal(releases,1);
  assert.equal(c.state.getState().kind,'found'); c.dispose(); assert.equal(releases,1);
});

test('cancelled or disposed OS selection cannot populate controller state', async()=>{
  for (const dispose of [false,true]) {
    const selection=deferred<typeof selected>();
    const c=createPenConnectionController(port(()=>selection.promise));
    const pending=c.chooseSystemDevice(); await flush();
    if(dispose)c.dispose(); else await c.cancel();
    const state=c.state.getState(); selection.resolve(selected); await pending;
    assert.equal(c.state.getState(),state);
  }
});

test('late OS selection cannot replace a newer actual scan',async()=>{
  const selection=deferred<typeof selected>();
  const c=createPenConnectionController(port(()=>selection.promise));
  const pending=c.chooseSystemDevice(); await flush(); await c.rescan();
  selection.resolve(selected); await pending;
  assert.deepEqual(c.state.getState(),{kind:'found',devices:[{id:'fresh-scan',name:'Real scanned accessory'}]});
  await c.connect(selected.id); assert.equal(c.state.getState().kind,'error'); c.dispose();
});

test('chooser cancellation and malformed candidates do not create a candidate',async()=>{
  for(const choose of [async()=>{throw new Error('System chooser cancelled');},async()=>({...selected,id:''})]) {
    const c=createPenConnectionController(port(choose)); await c.chooseSystemDevice();
    assert.equal(c.state.getState().kind,'error'); c.dispose();
  }
});

function adapter(native: Record<string,unknown>, api = 34) {
  const source=readFileSync(new URL('../src/android-ble.native.ts',import.meta.url),'utf8')
    .replace(/import[^;]+;/g,'');
  const js=stripTypeScriptTypes(source).replace('export function createAndroidBlePenPort','function createAndroidBlePenPort');
  const context=vm.createContext({Platform:{OS:'android',Version:api},PermissionsAndroid:{},setTimeout,clearTimeout,setInterval,clearInterval});
  vm.runInContext(js+'\nglobalThis.createPort = createAndroidBlePenPort;',context);
  return context.createPort(native) as BlePenPort;
}
test('Android chooser validates native provenance and preserves unknown signal strength',async()=>{
  for(const invalid of [{...selected,selectionSource:'invented'},{...selected,selectionSource:'companion-device-manager',bonded:undefined},{...selected,selectionSource:'companion-device-manager',id:''}]) {
    const p=adapter({isSystemChooserAvailable:()=>true,cancelSystemChooser(){},chooseMuseWithSystem:async()=>JSON.stringify(invalid)});
    await assert.rejects(()=>p.chooseDevice!(),/Invalid system/);
  }
  const p=adapter({isSystemChooserAvailable:()=>true,cancelSystemChooser(){},chooseMuseWithSystem:async()=>JSON.stringify({...selected,selectionSource:'companion-device-manager'})});
  const actual=await p.chooseDevice!(); assert.equal(actual.id,selected.id); assert.equal('rssi' in actual,false);
  assert.equal(adapter({isSystemChooserAvailable:()=>false}).chooseDevice,undefined);
});

test('adapter cancellation rejects a late OS selection and cancels native chooser once',async()=>{
  let cancels=0; const selection=deferred<string>();
  const p=adapter({isSystemChooserAvailable:()=>true,cancelSystemChooser(){cancels++;},stopScan(){},chooseMuseWithSystem:()=>selection.promise});
  const pending=p.chooseDevice!(); p.cancelScan();
  selection.resolve(JSON.stringify({...selected,selectionSource:'companion-device-manager'}));
  await assert.rejects(()=>pending,/cancelled/); assert.equal(cancels,1);
});

const historical = {...selected,selectionSource:'association-history' as const,associationId:2};
test('association history remains historical and requires explicit reconnect',async()=>{
  let connects=0;
  const p=port(async()=>selected); p.loadAssociatedDevices=async()=>[historical,historical];
  p.connect=async()=>{connects++;return{disconnect:async()=>{}};};
  const c=createPenConnectionController(p); await c.loadAssociatedDevices();
  assert.deepEqual(c.state.getState(),{kind:'found',devices:[historical],source:'association-history'});
  assert.equal(connects,0);
  c.verifyNativeInput({tracked:true,evidence:'verified-pen-protocol',deviceId:historical.id});
  assert.equal(c.state.getState().kind,'found');
  await c.connect(historical.id); assert.equal(connects,1); assert.equal(c.state.getState().kind,'linked'); c.dispose();
});

test('late association history cannot replace cancellation or a newer scan',async()=>{
  for(const rescan of [false,true]) {
    const history=deferred<readonly typeof historical[]>();
    const p=port(async()=>selected); p.loadAssociatedDevices=()=>history.promise;
    const c=createPenConnectionController(p); const pending=c.loadAssociatedDevices(); await flush();
    assert.equal(c.state.getState().kind,'loading-associated');
    if(rescan)await c.rescan(); else await c.cancel();
    const before=c.state.getState(); history.resolve([historical]); await pending;
    assert.equal(c.state.getState(),before); c.dispose();
  }
});

test('native association parser requires real history provenance and omits stale RSSI',async()=>{
  const native={isSystemChooserAvailable:()=>true,listAssociatedMuseDevices:async()=>JSON.stringify([{...historical,rssi:-60}])};
  const p=adapter(native); const devices=await p.loadAssociatedDevices!();
  assert.equal(adapter(native,32).loadAssociatedDevices,undefined);
  assert.equal(devices.length,1); assert.equal(devices[0].associationId,2); assert.equal('rssi' in devices[0],false);
  for(const invalid of [{...historical,selectionSource:'nearby'},{...historical,associationId:0},{...historical,bonded:undefined}]) {
    const bad=adapter({...native,listAssociatedMuseDevices:async()=>JSON.stringify([invalid])});
    await assert.rejects(()=>bad.loadAssociatedDevices!(),/Invalid association history/);
  }
  const history=deferred<string>(); const late=adapter({...native,stopScan(){},listAssociatedMuseDevices:()=>history.promise});
  const pending=late.loadAssociatedDevices!(); late.cancelScan(); history.resolve(JSON.stringify([historical]));
  await assert.rejects(()=>pending,/cancelled/);
});
