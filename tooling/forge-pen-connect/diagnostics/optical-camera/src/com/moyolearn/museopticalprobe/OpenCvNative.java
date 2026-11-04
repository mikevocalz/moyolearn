package com.moyolearn.museopticalprobe;
/** Local OpenCV native loading only; no camera, service, or filesystem writes. */
public final class OpenCvNative {
 private static boolean loaded=false;
 public static synchronized void ensureLoaded(){if(!loaded){try{System.loadLibrary("opencv_java4");loaded=true;}catch(LinkageError e){throw new IllegalStateException("Packaged OpenCV native library unavailable",e);}}}
 public static synchronized void loadComputeFixture(String directory){
  if(loaded)throw new IllegalStateException("Fixture native libraries already loaded");
  if(directory==null||!directory.matches("/data/local/tmp/moyo-optical-compute-[a-f0-9]{8,64}"))throw new IllegalArgumentException("Only the owned temporary fixture directory is accepted");
  System.load(directory+"/libc++_shared.so");System.load(directory+"/libopencv_java4.so");loaded=true;
 }
}
