package com.moyolearn.museopticalprobe;
import java.nio.ByteBuffer;
public final class BrightBlobDetectorTest {
 public static void main(String[] args){
  byte[] b=new byte[80];b[0]=(byte)255;b[4]=(byte)250;b[32]=(byte)249; // rowStride16, pixelStride2, sampled rows0,2.
  BrightBlobDetector.Result r=BrightBlobDetector.analyze(ByteBuffer.wrap(b),16,2,4,4);
  if(r.brightSamples!=3||r.blobs.size()!=1||r.blobs.get(0).count!=3)throw new AssertionError("Stride/component mismatch");
  if(Math.abs(r.blobs.get(0).x-2.0/3)>0.0001)throw new AssertionError("Centroid mismatch");
  if(BrightBlobDetector.analyze(ByteBuffer.wrap(new byte[16]),4,1,4,4).brightSamples!=0)throw new AssertionError("Dark frame");
  try{BrightBlobDetector.analyze(ByteBuffer.wrap(new byte[1]),4,1,4,4);throw new AssertionError("Truncation accepted");}catch(IllegalArgumentException expected){}
  System.out.println("PASS: padded/pixel stride, component/centroid, dark plane, truncation");
 }
}
