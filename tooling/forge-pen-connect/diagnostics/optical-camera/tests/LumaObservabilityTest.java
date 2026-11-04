package com.moyolearn.museopticalprobe;
import java.nio.ByteBuffer;
public final class LumaObservabilityTest {
 public static void main(String[]args){LumaObservability detector=new LumaObservability();byte[] b=new byte[48];b[0]=(byte)250;b[4]=(byte)240;b[24]=(byte)221;LumaObservability.Result r=detector.analyze(ByteBuffer.wrap(b),12,2,4,4);if(r.histogram[250]!=1||r.maxY!=250||r.thresholds.get(0).brightPixels!=3||r.thresholds.get(1).brightPixels!=2||r.thresholds.get(2).brightPixels!=1)throw new AssertionError("Histogram/threshold/stride");if(r.thresholds.get(2).singletons!=1||r.thresholds.get(2).small.get(0).left!=0||!r.thresholds.get(2).small.get(0).touchesEdge)throw new AssertionError("Singleton/bbox/edge");
  byte[] many=new byte[400];for(int y=0;y<20;y+=2)for(int x=0;x<20;x+=2)many[y*20+x]=(byte)255;r=detector.analyze(ByteBuffer.wrap(many),20,1,20,20);if(r.thresholds.get(2).smallTotal!=100||r.thresholds.get(2).small.size()!=32)throw new AssertionError("Explicit bucket cap/truncation");
  java.util.Arrays.fill(many,(byte)255);r=detector.analyze(ByteBuffer.wrap(many),20,1,20,20);if(r.thresholds.get(2).largeTotal!=1||r.thresholds.get(2).large.get(0).count!=400||r.p50!=255)throw new AssertionError("Large component/percentile");
  r=detector.analyze(ByteBuffer.wrap(new byte[400]),20,1,20,20);if(r.maxY!=0||r.thresholds.get(0).brightPixels!=0)throw new AssertionError("Reused buffers stale");
  try{detector.analyze(ByteBuffer.wrap(new byte[1]),20,1,20,20);throw new AssertionError("Truncated accepted");}catch(IllegalArgumentException expected){}
  System.out.println("PASS: full-luma stride/histogram/threshold/singleton/bbox/caps/large/percentile/reuse/truncation");
 }
}
