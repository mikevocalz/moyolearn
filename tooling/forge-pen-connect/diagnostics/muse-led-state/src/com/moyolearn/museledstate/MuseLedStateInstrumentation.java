package com.moyolearn.museledstate;

import android.Manifest;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.bluetooth.*;
import android.content.Context;
import android.os.Bundle;
import android.os.SystemClock;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;

/** TEST ONLY. One verified Output4 READ. No characteristic/descriptor writes, pairing, notifications or production grants. */
public final class MuseLedStateInstrumentation extends Instrumentation {
 private static final String MAP_SHA="4708e62215883a297c88be41600d2ddea20345ecfbe41213db47f7d6778b3405";
 private static final UUID HID=uuid("1812"),MAP=uuid("2a4b"),REPORT=uuid("2a4d"),REF=uuid("2908"),DIS=uuid("180a"),MODEL=uuid("2a24"),MAKER=uuid("2a29");
 private final BlockingQueue<Event> events=new LinkedBlockingQueue<>(32);
 private final Object resourceLock=new Object();
 private BluetoothGatt owned;private UiAutomation automation;private boolean adopted;private volatile boolean closed;
 private boolean cleanupStarted;private volatile boolean cleanupSucceeded;private final CountDownLatch cleanupFinished=new CountDownLatch(1);
 private long started,deadline;
 private static UUID uuid(String s){return UUID.fromString("0000"+s+"-0000-1000-8000-00805f9b34fb");}
 private static final class Event {final String kind;final int status;final Object attribute;final byte[] value;Event(String k,int s,Object a,byte[] v){kind=k;status=s;attribute=a;value=v==null?null:v.clone();}}
 private void offer(BluetoothGatt g,Event e){synchronized(resourceLock){if(!closed&&g==owned)events.offer(e);}}
 private final BluetoothGattCallback callbacks=new BluetoothGattCallback(){
  @Override public void onConnectionStateChange(BluetoothGatt g,int status,int state){offer(g,new Event(state==BluetoothProfile.STATE_CONNECTED?"connected":"disconnected",status,null,null));}
  @Override public void onServicesDiscovered(BluetoothGatt g,int status){offer(g,new Event("services",status,null,null));}
  @Override public void onCharacteristicRead(BluetoothGatt g,BluetoothGattCharacteristic c,byte[] value,int status){offer(g,new Event("characteristic",status,c,value));}
  @Override public void onDescriptorRead(BluetoothGatt g,BluetoothGattDescriptor d,int status,byte[] value){offer(g,new Event("descriptor",status,d,value));}
 };
 private void bounded(){if(SystemClock.elapsedRealtime()>=deadline||closed)throw new IllegalStateException("Overall20-second read-only diagnostic deadline reached");}
 private Event await(String kind,Object attribute)throws Exception {
  bounded();Event e=events.poll(Math.max(0,deadline-SystemClock.elapsedRealtime()),TimeUnit.MILLISECONDS);bounded();
  if(e==null)throw new TimeoutException("Overall20-second read-only diagnostic deadline reached");
  if(!kind.equals(e.kind)||attribute!=e.attribute)throw new IllegalStateException("Unexpected owned callback: "+e.kind+" status="+e.status);
  if(e.status!=BluetoothGatt.GATT_SUCCESS)throw new IllegalStateException("GATT read/connection failed status="+e.status);
  return e;
 }
 private Event read(BluetoothGatt g,BluetoothGattCharacteristic c)throws Exception {bounded();if(c==null||(c.getProperties()&BluetoothGattCharacteristic.PROPERTY_READ)==0||!g.readCharacteristic(c))throw new IllegalStateException("Required READ characteristic unavailable/not initiated");return await("characteristic",c);}
 private static String hex(byte[] v){StringBuilder b=new StringBuilder();for(byte n:v)b.append(String.format(Locale.ROOT,"%02x",n&255));return b.toString();}
 private static String text(Event e){return e.value==null?"":new String(e.value,StandardCharsets.UTF_8);}
 /** Resource identity is removed before closing. No reconnect, bond or remote CCCD cleanup operation occurs. */
 private boolean cleanup(){
  BluetoothGatt g=null;UiAutomation a=null;boolean drop=false,first;
  synchronized(resourceLock){first=!cleanupStarted;if(first){cleanupStarted=true;closed=true;g=owned;owned=null;a=automation;drop=adopted;adopted=false;}}
  if(!first){try{cleanupFinished.await(Math.max(0,started+20000-SystemClock.elapsedRealtime()),TimeUnit.MILLISECONDS);}catch(InterruptedException e){Thread.currentThread().interrupt();return false;}return cleanupFinished.getCount()==0&&cleanupSucceeded;}
  boolean success=true;
  try{if(g!=null)try{g.close();}catch(Exception e){success=false;}if(drop&&a!=null)try{a.dropShellPermissionIdentity();}catch(Exception e){success=false;}}
  finally{cleanupSucceeded=success;cleanupFinished.countDown();}
  return success;
 }
 @Override public void onCreate(Bundle arguments){super.onCreate(arguments);start();}
 @Override public void onStart(){
  started=SystemClock.elapsedRealtime();deadline=started+19000; // Reserve the final second for cleanup; own-process watchdog at20s.
  ScheduledExecutorService watchdog=Executors.newScheduledThreadPool(2);
  watchdog.schedule(()->{cleanup();events.offer(new Event("deadline",-1,null,null));},19,TimeUnit.SECONDS);
  watchdog.schedule(()->android.os.Process.killProcess(android.os.Process.myPid()),20,TimeUnit.SECONDS);
  JSONObject result=new JSONObject();Bundle summary=new Bundle();int outcome=0;
  try {
   result.put("schemaVersion",1).put("testOnly",true).put("productionAccess",false).put("readsOnly",true).put("durationLimitMs",20000).put("startedWallTimeMs",System.currentTimeMillis()).put("operations","temporary named test identity; select already-bonded unique Muse; connect/discover; READ model/manufacturer/report-map/report-references/output4; close/drop identity").put("deviceWrites",false).put("notifications",false).put("pairing",false);
   bounded();UiAutomation a=getUiAutomation(UiAutomation.FLAG_DONT_USE_ACCESSIBILITY);
   synchronized(resourceLock){bounded();automation=a;a.adoptShellPermissionIdentity(Manifest.permission.BLUETOOTH_CONNECT,Manifest.permission.BLUETOOTH_PRIVILEGED);adopted=true;}
   BluetoothManager manager=(BluetoothManager)getContext().getSystemService(Context.BLUETOOTH_SERVICE);BluetoothAdapter adapter=manager==null?null:manager.getAdapter();if(adapter==null||!adapter.isEnabled())throw new IllegalStateException("Bluetooth unavailable");
   List<BluetoothDevice> candidates=new ArrayList<>();for(BluetoothDevice d:adapter.getBondedDevices())if("Logitech Muse".equalsIgnoreCase(d.getName())&&d.getBondState()==BluetoothDevice.BOND_BONDED)candidates.add(d);
   result.put("matchingBondedMuseCount",candidates.size());if(candidates.size()!=1)throw new IllegalStateException("Require exactly one currently bonded Logitech Muse; no guessed identity or pairing");
   BluetoothDevice device=candidates.get(0);bounded();synchronized(resourceLock){bounded();owned=device.connectGatt(getContext(),false,callbacks,BluetoothDevice.TRANSPORT_LE);}
   BluetoothGatt g=owned;if(g==null)throw new IllegalStateException("connectGatt returned null");await("connected",null);bounded();if(device.getBondState()!=BluetoothDevice.BOND_BONDED)throw new IllegalStateException("Bond lost");
   if(!g.discoverServices())throw new IllegalStateException("Discovery not initiated");await("services",null);
   List<BluetoothGattService> hid=new ArrayList<>(),dis=new ArrayList<>();for(BluetoothGattService s:g.getServices()){if(HID.equals(s.getUuid()))hid.add(s);if(DIS.equals(s.getUuid()))dis.add(s);}if(hid.size()!=1||dis.size()!=1)throw new IllegalStateException("Require unique HID and Device Information services");
   String model=text(read(g,dis.get(0).getCharacteristic(MODEL))),maker=text(read(g,dis.get(0).getCharacteristic(MAKER)));if(!"Muse".equals(model)||!"Logi".equals(maker))throw new IllegalStateException("Actual model/manufacturer does not match retained Muse identity");result.put("model",model).put("manufacturer",maker).put("bondState",device.getBondState());
   List<BluetoothGattCharacteristic> maps=new ArrayList<>();for(BluetoothGattCharacteristic c:hid.get(0).getCharacteristics())if(MAP.equals(c.getUuid()))maps.add(c);if(maps.size()!=1)throw new IllegalStateException("Require unique actual Report Map");Event map=read(g,maps.get(0));if(map.value==null||!MAP_SHA.equals(hex(MessageDigest.getInstance("SHA-256").digest(map.value))))throw new IllegalStateException("Fresh Report Map hash differs from pinned descriptor");result.put("reportMapSha256",MAP_SHA).put("reportMapByteLength",map.value.length).put("reportMapReadStatus",map.status);
   BluetoothGattCharacteristic output=null;int matches=0;JSONArray refs=new JSONArray();result.put("actualReportReferences",refs);
   for(BluetoothGattCharacteristic c:hid.get(0).getCharacteristics())if(REPORT.equals(c.getUuid())){
    List<BluetoothGattDescriptor> descriptors=new ArrayList<>();for(BluetoothGattDescriptor d:c.getDescriptors())if(REF.equals(d.getUuid()))descriptors.add(d);if(descriptors.size()!=1)throw new IllegalStateException("Report Reference missing or ambiguous");bounded();BluetoothGattDescriptor d=descriptors.get(0);if(!g.readDescriptor(d))throw new IllegalStateException("Report Reference read not initiated");Event ref=await("descriptor",d);if(ref.value==null||ref.value.length!=2)throw new IllegalStateException("Invalid actual Report Reference");refs.put(new JSONObject().put("referenceHex",hex(ref.value)).put("characteristicInstanceId",c.getInstanceId()).put("properties",c.getProperties()).put("readStatus",ref.status));
    if(ref.value[0]==4&&ref.value[1]==2){output=c;matches++;}
   }
   if(matches!=1||output==null||(output.getProperties()&BluetoothGattCharacteristic.PROPERTY_READ)==0)throw new IllegalStateException("Unique READ-capable actual Output4 reference0402 not found");
   bounded();if(device.getBondState()!=BluetoothDevice.BOND_BONDED)throw new IllegalStateException("Bond changed before output READ");Event value=read(g,output);
   result.put("outputReportReadStatus",value.status).put("outputReportReferenceHex","0402").put("outputCharacteristicInstanceId",output.getInstanceId()).put("outputProperties",output.getProperties()).put("outputPayloadByteLength",value.value==null?0:value.value.length).put("outputRawHex",value.value==null?JSONObject.NULL:hex(value.value)).put("opaquePrefixBytes",8).put("opaquePrefixDecoded",false).put("opticalEmissionVerified",false);
   LedOutputReport decoded=LedOutputReport.decode(value.value);
   result.put("reportedMode",decoded.mode).put("reportedModeName",decoded.modeName()).put("reportedIntensity",decoded.intensity).put("reportedOnDurationMicros",decoded.onDurationMicros).put("reportedOffDurationMicros",decoded.offDurationMicros).put("opticalEmissionVerified",false).put("completed",true);outcome=1;
  }catch(Exception e){try{result.put("completed",false).put("errorType",e.getClass().getSimpleName()).put("error",String.valueOf(e.getMessage()));}catch(JSONException ignored){}}
  finally {
   boolean dropped=cleanup();if(!dropped)outcome=0;
   try{result.put("cleanupCompleted",dropped).put("elapsedMs",SystemClock.elapsedRealtime()-started);File output=new File(getContext().getFilesDir(),"muse-led-state-read-only.json");try(FileOutputStream out=new FileOutputStream(output)){out.write(result.toString(2).getBytes(StandardCharsets.UTF_8));}summary.putString("resultJson",result.toString());summary.putString("resultFile",output.getAbsolutePath());}catch(Exception e){outcome=0;summary.putString("receiptError",e.getClass().getSimpleName());}
   // Keep the20s watchdog armed until finish returns; it kills ONLY this isolated test process on stuck cleanup/finish.
   try{finish(outcome,summary);watchdog.shutdownNow();}catch(Exception e){android.os.Process.killProcess(android.os.Process.myPid());}
  }
 }
}
