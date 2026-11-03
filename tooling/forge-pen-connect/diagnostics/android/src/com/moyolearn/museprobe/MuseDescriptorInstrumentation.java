package com.moyolearn.museprobe;

import android.Manifest;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.bluetooth.*;
import android.content.Context;
import android.os.Bundle;
import android.os.SystemClock;
import org.json.*;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** TEST ONLY. No production input provider. Reads only HID Report Map and Report Reference. */
public final class MuseDescriptorInstrumentation extends Instrumentation {
 private static final UUID HID = uuid("1812"), MAP = uuid("2a4b"), REPORT = uuid("2a4d"), REF = uuid("2908");
 private final BlockingQueue<Event> events = new LinkedBlockingQueue<>(32);
 private volatile BluetoothGatt owned;
 private volatile boolean closed;
 private long deadline;
 private static UUID uuid(String s) { return UUID.fromString("0000" + s + "-0000-1000-8000-00805f9b34fb"); }
 private static final class Event {
  final String kind; final int status; final Object attribute; final byte[] bytes;
  Event(String k,int s,Object a,byte[] b){kind=k;status=s;attribute=a;bytes=b==null?null:b.clone();}
 }
 private synchronized void offer(BluetoothGatt g, Event event) {
  if (!closed && g == owned) events.offer(event);
 }
 private final BluetoothGattCallback callback = new BluetoothGattCallback() {
  @Override public void onConnectionStateChange(BluetoothGatt g,int status,int state) {
   offer(g,new Event(state==BluetoothProfile.STATE_CONNECTED?"connected":"disconnected",status,null,null));
  }
  @Override public void onServicesDiscovered(BluetoothGatt g,int status){offer(g,new Event("services",status,null,null));}
  @Override public void onCharacteristicRead(BluetoothGatt g,BluetoothGattCharacteristic c,byte[] value,int status){offer(g,new Event("characteristic",status,c,value));}
  @Override public void onDescriptorRead(BluetoothGatt g,BluetoothGattDescriptor d,int status,byte[] value){offer(g,new Event("descriptor",status,d,value));}
 };
 private Event await(String kind,Object attribute) throws Exception {
  long remaining=deadline-SystemClock.elapsedRealtime();
  Event e=events.poll(Math.max(0,remaining),TimeUnit.MILLISECONDS);
  if(e==null)throw new TimeoutException("Overall 40-second diagnostic deadline exceeded");
  if(!e.kind.equals(kind)||e.attribute!=attribute)throw new IllegalStateException("Unexpected callback: "+e.kind+" status="+e.status);
  return e;
 }
 private static String hex(byte[] bytes){if(bytes==null)return null;StringBuilder b=new StringBuilder();for(byte v:bytes)b.append(String.format(Locale.ROOT,"%02x",v&255));return b.toString();}
 private JSONObject observation(Event e) throws JSONException {
  return new JSONObject().put("gattStatus",e.status).put("byteLength",e.bytes==null?0:e.bytes.length).put("rawHex",e.bytes==null?JSONObject.NULL:hex(e.bytes));
 }
 @Override public void onCreate(Bundle args){super.onCreate(args);start();}
 @Override public void onStart(){
  JSONObject result=new JSONObject();Bundle summary=new Bundle();UiAutomation automation=null;boolean adopted=false;
  int outcome=0;
  try {
   if(android.os.Build.VERSION.SDK_INT<33)throw new IllegalStateException("Requires API33+ value-bearing callbacks");
   result.put("schemaVersion",1).put("testOnly",true).put("productionAccess",false).put("inputProducer",false)
    .put("wallTimeMs",System.currentTimeMillis()).put("sdkInt",android.os.Build.VERSION.SDK_INT)
    .put("package","com.moyolearn.museprobe").put("operations","connect,discover,read1812/2A4B,read1812/2A4D/2908")
    .put("permissionScope","UiAutomation named BLUETOOTH_CONNECT and BLUETOOTH_PRIVILEGED; temporary instrumentation only");
   automation=getUiAutomation(UiAutomation.FLAG_DONT_USE_ACCESSIBILITY);
   automation.adoptShellPermissionIdentity(Manifest.permission.BLUETOOTH_CONNECT,Manifest.permission.BLUETOOTH_PRIVILEGED);adopted=true;
   BluetoothManager manager=(BluetoothManager)getContext().getSystemService(Context.BLUETOOTH_SERVICE);
   BluetoothAdapter adapter=manager.getAdapter();
   if(adapter==null||!adapter.isEnabled())throw new IllegalStateException("Bluetooth adapter unavailable or disabled");
   List<BluetoothDevice> candidates=new ArrayList<>();
   for(BluetoothDevice d:adapter.getBondedDevices())if("Logitech Muse".equalsIgnoreCase(d.getName()))candidates.add(d);
   result.put("matchingBondedDeviceCount",candidates.size());
   if(candidates.size()!=1)throw new IllegalStateException("Require exactly one bonded device named Logitech Muse; no pairing or guessed selection");
   BluetoothDevice device=candidates.get(0);result.put("deviceName",device.getName()).put("bondState",device.getBondState());
   deadline=SystemClock.elapsedRealtime()+40000;
   if(device.getBondState()!=BluetoothDevice.BOND_BONDED)throw new IllegalStateException("Bond changed before connect; no pairing attempted");
   synchronized(this){owned=device.connectGatt(getContext(),false,callback,BluetoothDevice.TRANSPORT_LE);}
   if(owned==null)throw new IllegalStateException("connectGatt returned null");
   Event connected=await("connected",null);result.put("connectionStatus",connected.status);
   if(connected.status!=BluetoothGatt.GATT_SUCCESS)throw new IllegalStateException("Connection status "+connected.status);
   if(!owned.discoverServices())throw new IllegalStateException("Service discovery not initiated");
   Event discovered=await("services",null);result.put("discoveryStatus",discovered.status);
   if(discovered.status!=BluetoothGatt.GATT_SUCCESS)throw new IllegalStateException("Service discovery failed");
   JSONArray maps=new JSONArray(),refs=new JSONArray();result.put("reportMaps",maps).put("reportReferences",refs);
   for(BluetoothGattService service:owned.getServices())if(HID.equals(service.getUuid())){
    for(BluetoothGattCharacteristic c:service.getCharacteristics()){
     if(MAP.equals(c.getUuid())){
      if(!owned.readCharacteristic(c))throw new IllegalStateException("Report Map read not initiated");
      Event read=await("characteristic",c);
      maps.put(observation(read).put("serviceInstanceId",service.getInstanceId()).put("characteristicInstanceId",c.getInstanceId()));
      if(read.status!=BluetoothGatt.GATT_SUCCESS || read.bytes==null || read.bytes.length==0)throw new IllegalStateException("Report Map read failed or empty: "+read.status);
     }
     if(REPORT.equals(c.getUuid()))for(BluetoothGattDescriptor d:c.getDescriptors())if(REF.equals(d.getUuid())){
      if(!owned.readDescriptor(d))throw new IllegalStateException("Report Reference read not initiated");
      Event read=await("descriptor",d);
      refs.put(observation(read).put("serviceInstanceId",service.getInstanceId()).put("characteristicInstanceId",c.getInstanceId()));
      if(read.status!=BluetoothGatt.GATT_SUCCESS)throw new IllegalStateException("Report Reference read failed: "+read.status);
     }
    }
   }
   if(maps.length()==0)throw new IllegalStateException("No actual HID Report Map discovered");
   result.put("completed",true);outcome=1;
  }catch(Exception e){try{result.put("completed",false).put("errorType",e.getClass().getSimpleName()).put("error",String.valueOf(e.getMessage()));}catch(JSONException ignored){}}
  finally{
   closed=true;BluetoothGatt g=owned;owned=null;if(g!=null){try{g.close();}catch(Exception ignored){}}
   if(adopted&&automation!=null){try{automation.dropShellPermissionIdentity();}catch(Exception e){outcome=0;summary.putString("cleanupError",e.getClass().getSimpleName());}}
   try{
    File output=new File(getContext().getFilesDir(),"muse-hid-report-map-test-only.json");
    try(FileOutputStream stream=new FileOutputStream(output)){stream.write(result.toString(2).getBytes(StandardCharsets.UTF_8));}
    summary.putString("resultFile",output.getAbsolutePath());summary.putString("resultJson",result.toString());
   }catch(Exception e){outcome=0;summary.putString("outputError",e.getClass().getSimpleName());}
   try { finish(outcome,summary); }
   catch(Exception finishError) {
    // Keep the original diagnostic error intact. Publish and persist cleanup failure separately.
    summary.putString("finishError",finishError.getClass().getSimpleName()+": "+finishError.getMessage());
    try {
     result.put("finishError",summary.getString("finishError"));
     try(FileOutputStream stream=new FileOutputStream(new File(getContext().getFilesDir(),"muse-hid-report-map-test-only.json"))){stream.write(result.toString(2).getBytes(StandardCharsets.UTF_8));}
    } catch(Exception ignored) {}
    try { sendStatus(-2,summary); } catch(Exception ignored) {}
    // Public API, own isolated test process only: prevent a stuck instrumentation on finish failure.
    android.os.Process.killProcess(android.os.Process.myPid());
   }
  }
 }
}
