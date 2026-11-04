package com.moyolearn.blereference;
import android.Manifest;
import android.app.Activity;
import android.bluetooth.*;
import android.bluetooth.le.*;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.*;
import android.util.SparseArray;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Foreground public scan only. No GATT, bond, association, advertisement or settings-write operations. */
public final class BleReferenceActivity extends Activity {
 private static final String[] PERMISSIONS={Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT,Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION};
 private final Handler main=new Handler(Looper.getMainLooper());
 private final LinkedHashMap<String,JSONObject> devices=new LinkedHashMap<>();
 private boolean foreground,capturing;private long generation,started,startedNs,deadlineWall;private int callbackCount,dropped,failures,staleCallbacks;
 private BluetoothLeScanner scanner;private ScanCallback callback;private TextView status;
 private JSONObject receipt=new JSONObject();private final Runnable deadline=()->stop("completed-15s");
 @Override public void onCreate(Bundle b){super.onCreate(b);
  LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setPadding(24,24,24,24);
  TextView title=new TextView(this);title.setText("BLE reference scan — diagnostic");title.setTextSize(24);layout.addView(title);
  TextView note=new TextView(this);note.setText("15-second foreground scan with normal precise-location permission. This app does not declare neverForLocation. No pairing or device connection. Bluetooth addresses and raw advertisements stay in this app's private receipt.");layout.addView(note);
  Button request=new Button(this);request.setText("Request Bluetooth and precise location access");request.setOnClickListener(v->{if(!capturing)requestPermissions(PERMISSIONS,7);});layout.addView(request);
  Button scan=new Button(this);scan.setText("Scan for 15 seconds");scan.setOnClickListener(v->begin());layout.addView(scan);
  Button stop=new Button(this);stop.setText("Stop scan");stop.setOnClickListener(v->stop("user-stopped"));layout.addView(stop);
  Button show=new Button(this);show.setText("Refresh permission/location status");show.setOnClickListener(v->showPreflight());layout.addView(show);
  status=new TextView(this);layout.addView(status);ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.addView(layout);setContentView(scroll);showPreflight();
 }
 private boolean permitted(){for(String p:PERMISSIONS)if(checkSelfPermission(p)!=PackageManager.PERMISSION_GRANTED)return false;return true;}
 private boolean location(){LocationManager m=getSystemService(LocationManager.class);return m!=null&&m.isLocationEnabled();}
 private JSONObject permissions()throws JSONException {JSONObject p=new JSONObject();for(String name:PERMISSIONS)p.put(name,checkSelfPermission(name)==PackageManager.PERMISSION_GRANTED);return p;}
 private void showPreflight(){status.setText("Bluetooth/location permissions: "+(permitted()?"granted":"not fully granted")+" · Location Services: "+(location()?"on":"off")+". Enable Location Services manually in Quest settings if off. No scan starts automatically.");}
 @Override public void onRequestPermissionsResult(int code,String[] names,int[] grants){super.onRequestPermissionsResult(code,names,grants);showPreflight();}
 private void begin(){
  if(capturing)return;
  if(!foreground||!permitted()||!location()){showPreflight();return;}
  try{
   devices.clear();callbackCount=dropped=failures=staleCallbacks=0;startedNs=SystemClock.elapsedRealtimeNanos();started=startedNs/1000000L;receipt=new JSONObject().put("schemaVersion",1).put("phase","opening");
   BluetoothManager manager=getSystemService(BluetoothManager.class);BluetoothAdapter bt=manager==null?null:manager.getAdapter();if(bt==null||!bt.isEnabled())throw new IllegalStateException("Bluetooth unavailable or off");
   BluetoothLeScanner next=bt.getBluetoothLeScanner();if(next==null)throw new IllegalStateException("Public BLE scanner unavailable");
   devices.clear();callbackCount=dropped=failures=staleCallbacks=0;startedNs=SystemClock.elapsedRealtimeNanos();started=startedNs/1000000L;deadlineWall=System.currentTimeMillis()+ScanPolicy.DURATION_MS;long token=++generation;
   receipt=new JSONObject().put("schemaVersion",1).put("purpose","location-authorized reference scan, not native Muse compatibility").put("package","com.moyolearn.blereference").put("phase","scanning").put("neverForLocationDeclared",false).put("permissions",permissions()).put("locationServicesEnabled",location()).put("durationLimitMs",ScanPolicy.DURATION_MS).put("startedWallTimeMs",System.currentTimeMillis()).put("startedElapsedRealtimeMs",started).put("requestedLegacyOnly",false).put("legacyFallback",false).put("scanMode","LOW_LATENCY").put("filters",JSONObject.NULL).put("deviceConnections",0).put("pairingRequests",0).put("deviceWrites",false).put("freshScanResultsOnly",true);
   callback=new ScanCallback(){
    @Override public void onScanResult(int type,ScanResult result){main.post(()->observe(token,result));}
    @Override public void onBatchScanResults(List<ScanResult> results){main.post(()->{for(ScanResult r:results)observe(token,r);});}
    @Override public void onScanFailed(int error){main.post(()->{if(active(token)){failures++;try{receipt.put("scanErrorCode",error);}catch(JSONException ignored){}stop("scan-error");}});}
   };
   scanner=next;capturing=true;main.postDelayed(deadline,ScanPolicy.DURATION_MS);
   next.startScan(null,new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).setLegacy(false).build(),callback);
   if(!persist()){stop("receipt-error");return;}status.setText("Scanning15seconds. No connection or pairing; no device identity assumed.");
  }catch(Exception e){try{receipt.put("errorType",e.getClass().getSimpleName()).put("error",String.valueOf(e.getMessage()));}catch(JSONException ignored){}stop("start-error");}
 }
 private boolean active(long token){return capturing&&token==generation&&ScanPolicy.accept(foreground,permitted(),location(),started,SystemClock.elapsedRealtime());}
 private static JSONObject bytes(byte[] b)throws JSONException{return new JSONObject().put("hex",b==null?JSONObject.NULL:ScanPolicy.hex(b)).put("byteLength",b==null?0:b.length).put("truncated",b!=null&&b.length>ScanPolicy.MAX_RAW_BYTES);}
 private void observe(long token,ScanResult result){
  if(!capturing||token!=generation)return;
  if(!active(token)){stop("deadline-or-permission-location-foreground-loss");return;}
  try{
   callbackCount++;if(!ScanPolicy.fresh(result.getTimestampNanos(),startedNs,SystemClock.elapsedRealtimeNanos())){staleCallbacks++;return;}BluetoothDevice device=result.getDevice();String address=device.getAddress();boolean known=devices.containsKey(address);if(!ScanPolicy.retain(known,devices.size())){dropped++;return;}
   ScanRecord ad=result.getScanRecord();JSONObject row=new JSONObject().put("address",address).put("rssi",result.getRssi()).put("timestampNanos",result.getTimestampNanos()).put("ageMs",Math.max(0,SystemClock.elapsedRealtimeNanos()-result.getTimestampNanos())/1000000).put("isLegacy",result.isLegacy()).put("isConnectable",result.isConnectable()).put("primaryPhy",result.getPrimaryPhy()).put("secondaryPhy",result.getSecondaryPhy()).put("observedWallTimeMs",System.currentTimeMillis());
   // Names come from the current advertisement, never a cached BluetoothDevice name or old association.
   row.put("advertisedName",ad==null||ad.getDeviceName()==null?JSONObject.NULL:ad.getDeviceName());
   JSONArray uuids=new JSONArray();if(ad!=null&&ad.getServiceUuids()!=null)for(ParcelUuid u:ad.getServiceUuids())if(uuids.length()<32)uuids.put(u.toString());row.put("serviceUuids",uuids).put("serviceUuidCount",ad==null||ad.getServiceUuids()==null?0:ad.getServiceUuids().size());
   JSONArray services=new JSONArray();if(ad!=null&&ad.getServiceData()!=null)for(Map.Entry<ParcelUuid,byte[]> e:ad.getServiceData().entrySet())if(services.length()<16)services.put(bytes(e.getValue()).put("uuid",e.getKey().toString()));row.put("serviceData",services).put("serviceDataCount",ad==null||ad.getServiceData()==null?0:ad.getServiceData().size());
   JSONArray manufacturers=new JSONArray();SparseArray<byte[]> values=ad==null?null:ad.getManufacturerSpecificData();if(values!=null)for(int i=0;i<Math.min(values.size(),16);i++)manufacturers.put(bytes(values.valueAt(i)).put("manufacturerId",values.keyAt(i)));row.put("manufacturerData",manufacturers).put("manufacturerDataCount",values==null?0:values.size()).put("rawAdvertisement",bytes(ad==null?null:ad.getBytes()));
   devices.put(address,row);status.setText("Scan active · "+devices.size()+" fresh advertised peers · callbacks "+callbackCount+" · capped new peers "+dropped+". Results are not Muse identity or compatibility proof.");
  }catch(Exception e){try{receipt.put("callbackError",e.getClass().getSimpleName());}catch(JSONException ignored){}stop("callback-error");}
 }
 private void snapshot()throws JSONException {JSONArray list=new JSONArray();for(JSONObject row:devices.values())list.put(row);receipt.put("devices",list).put("callbackCount",callbackCount).put("retainedDeviceCount",devices.size()).put("droppedNewPeers",dropped).put("scanFailures",failures).put("staleCallbacksRejected",staleCallbacks);}
 private boolean persist(){try{File temp=new File(getFilesDir(),"ble-reference.tmp"),target=new File(getFilesDir(),"ble-reference.json");try(FileOutputStream out=new FileOutputStream(temp)){out.write(receipt.toString().getBytes(StandardCharsets.UTF_8));}if(!temp.renameTo(target))throw new IOException("Receipt rename failed");return true;}catch(IOException e){status.setText("Private receipt failed: "+e.getClass().getSimpleName());return false;}}
 private void stop(String reason){
  boolean wasCapturing=capturing;capturing=false;++generation;main.removeCallbacks(deadline);BluetoothLeScanner old=scanner;ScanCallback owned=callback;scanner=null;callback=null;
  boolean acknowledged=true;if(old!=null&&owned!=null)try{old.stopScan(owned);}catch(Exception e){acknowledged=false;}
  if(wasCapturing||old!=null||"opening".equals(receipt.optString("phase")))try{snapshot();receipt.put("phase",reason).put("stopScanAcknowledged",acknowledged).put("elapsedMs",SystemClock.elapsedRealtime()-started).put("stoppedWallTimeMs",System.currentTimeMillis()).put("deadlineWallTimeMs",deadlineWall);boolean saved=persist();status.setText("Stopped: "+reason+" · "+devices.size()+" fresh peers. Private receipt "+(saved?"saved":"FAILED")+"; no connection/pairing.");}catch(JSONException ignored){}
 }
 @Override protected void onResume(){super.onResume();foreground=true;}
 @Override protected void onPause(){foreground=false;stop("backgrounded");super.onPause();}
 @Override protected void onDestroy(){foreground=false;stop("destroyed");super.onDestroy();}
}
