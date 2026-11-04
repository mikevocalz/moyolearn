package com.moyolearn.museopticalprobe;
import java.nio.ByteBuffer;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import org.opencv.core.*;
import org.opencv.video.Video;
/** Compute-only SYNTHETIC OpenCV fixture. No camera, pairing, service, or image persistence. */
public final class UnmodifiedPointTrackerFixture {
 private static final int W=128,H=128;private static final long START=1000000000L;
 private static void require(boolean test,String reason){if(!test)throw new AssertionError(reason);}
 private static byte[] texture(){byte[] b=new byte[W*H];new Random(7041).nextBytes(b);return b;}
 /** Three smooth Fourier components, max spatial frequency below the 4x-downsample Nyquist limit.
  * Quantized8-bit synthetic radiance only; not a camera/Muse image. */
 private static byte[] bandlimitedTexture(){byte[] b=new byte[W*H];for(int y=0;y<H;y++)for(int x=0;x<W;x++)b[y*W+x]=(byte)Math.round(128+26*Math.cos(.31*x+.13*y)+22*Math.sin(.17*x-.29*y)+20*Math.cos(.37*x-.23*y));return b;}
 private static byte[] translate(byte[] image,int dx,int dy){byte[] b=new byte[W*H];for(int y=0;y<H;y++)for(int x=0;x<W;x++)if(x-dx>=0&&x-dx<W&&y-dy>=0&&y-dy<H)b[y*W+x]=image[(y-dy)*W+x-dx];return b;}
 private static List<UnmodifiedPointTracker.Seed> seeds(){return Arrays.asList(new UnmodifiedPointTracker.Seed(17,40,40),new UnmodifiedPointTracker.Seed(3,80,45),new UnmodifiedPointTracker.Seed(99,60,80));}
 private static UnmodifiedPointTracker.FrameLuma frame(byte[] bytes,String session,long timestamp,long callback){return new UnmodifiedPointTracker.FrameLuma(ByteBuffer.wrap(bytes),W,1,session,timestamp,callback);}
 private static void lost(UnmodifiedPointTracker.Observation o){require(o.state==UnmodifiedPointTracker.State.LOST&&o.currentPoints.isEmpty(),"Loss must clear ALL current points: "+o.reason);}
 public static String run(){
  AtomicLong clock=new AtomicLong(START);int assertions=0;
  // Retain the actual failing white-noise case as a fail-closed rejection test, not a positive claim.
  byte[] noise=texture();
  try(UnmodifiedPointTracker t=new UnmodifiedPointTracker(W,H,new UnmodifiedPointTracker.Config(),clock::get)){
   require(t.seed(frame(noise,"synthetic-raw-noise",100,START),seeds()).state==UnmodifiedPointTracker.State.TRACKING,"White-noise seed failed");
   clock.addAndGet(33000000);UnmodifiedPointTracker.Observation rejected=t.observe(frame(translate(noise,3,2),"synthetic-raw-noise",33000100,clock.get()));
   lost(rejected);require(rejected.reason.contains("LK"),"White-noise failure was not an LK gate");System.out.println("SYNTHETIC_NEGATIVE white-noise all-points-invalidated: "+rejected.reason);assertions++;
  }
  clock.set(START);byte[] original=bandlimitedTexture(),translated=translate(original,3,2);
  try(UnmodifiedPointTracker t=new UnmodifiedPointTracker(W,H,new UnmodifiedPointTracker.Config(),clock::get)){
   System.out.println("SYNTHETIC_STAGE seed");
   UnmodifiedPointTracker.Observation o=t.seed(frame(original,"synthetic-A",100,START),seeds());require(o.state==UnmodifiedPointTracker.State.TRACKING&&o.currentPoints.size()==3,"Explicit textured seed rejected: "+o.reason);assertions++;
   clock.addAndGet(33000000);System.out.println("SYNTHETIC_STAGE translate");o=t.observe(frame(translated,"synthetic-A",33000100,clock.get()));if(o.state!=UnmodifiedPointTracker.State.TRACKING)diagnoseTranslation(original,translated);require(o.state==UnmodifiedPointTracker.State.TRACKING&&o.currentPoints.size()==3,"Translated synthetic image rejected: "+o.reason);
   for(int i=0;i<3;i++){UnmodifiedPointTracker.Seed s=seeds().get(i);UnmodifiedPointTracker.PointObservation p=o.currentPoints.get(i);require(p.id==s.id&&Math.abs(p.x-s.x-3)<.4&&Math.abs(p.y-s.y-2)<.4&&p.flowMeasured,"Fixed-ID translation mismatch");}assertions++;
   clock.addAndGet(33000000);byte[] occluded=translated.clone();for(int y=20;y<65;y++)for(int x=20;x<65;x++)occluded[y*W+x]=127;lost(t.observe(frame(occluded,"synthetic-A",66000100,clock.get())));assertions++;
   clock.addAndGet(33000000);o=t.observe(frame(translated,"synthetic-A",99000100,clock.get()));require(o.state==UnmodifiedPointTracker.State.LOST&&o.currentPoints.isEmpty(),"Reappearing texture must NOT reacquire automatically");assertions++;
   o=t.seed(frame(original,"synthetic-A",100000000,clock.get()),Arrays.asList(new UnmodifiedPointTracker.Seed(1,40,40),new UnmodifiedPointTracker.Seed(1,80,45),new UnmodifiedPointTracker.Seed(2,60,80)));lost(o);assertions++;
   byte[] flat=new byte[W*H];Arrays.fill(flat,(byte)127);lost(t.seed(frame(flat,"synthetic-A",100000000,clock.get()),seeds()));assertions++;
   require(t.seed(frame(original,"synthetic-A",100000000,clock.get()),seeds()).state==UnmodifiedPointTracker.State.TRACKING,"Explicit reseed failed");clock.addAndGet(33000000);lost(t.observe(frame(translated,"synthetic-B",133000000,clock.get())));assertions++;
   require(t.seed(frame(original,"synthetic-A",200000000,clock.get()),seeds()).state==UnmodifiedPointTracker.State.TRACKING,"Reseed before stale failed");clock.addAndGet(300000000);lost(t.observe(frame(translated,"synthetic-A",233000000,clock.get()-300000000)));assertions++;
   require(t.seed(frame(original,"synthetic-A",300000000,clock.get()),seeds()).state==UnmodifiedPointTracker.State.TRACKING,"Reseed before regression failed");lost(t.observe(frame(translated,"synthetic-A",299999999,clock.get())));assertions++;
   lost(t.seed(frame(original,"synthetic-A",400000000,clock.get()),Arrays.asList(new UnmodifiedPointTracker.Seed(1,Double.NaN,40),new UnmodifiedPointTracker.Seed(2,80,45),new UnmodifiedPointTracker.Seed(3,60,80))));assertions++;
   t.close();t.close();o=t.observe(frame(original,"synthetic-A",500000000,clock.get()));require(o.state==UnmodifiedPointTracker.State.CLOSED&&o.currentPoints.isEmpty(),"Close must be idempotent/final");assertions++;
  }
  return "{\"scope\":\"SYNTHETIC Java/OpenCV compute fixture, not live Muse evidence\",\"passed\":true,\"whiteNoiseReverseFailureRejected\":true,\"bandlimitedTranslationPassed\":true,\"assertionGroups\":"+assertions+",\"museIdentityEstablished\":false,\"depthOrPoseEstablished\":false}";
 }
 private static String json(String value){return "\""+String.valueOf(value).replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n").replace("\r","\\r")+"\"";}
 private static void diagnoseTranslation(byte[] first,byte[] next){
  Mat a=new Mat(H,W,CvType.CV_8UC1),b=new Mat(H,W,CvType.CV_8UC1);MatOfPoint2f p=new MatOfPoint2f(new Point(40,40),new Point(80,45),new Point(60,80)),q=new MatOfPoint2f(),back=new MatOfPoint2f();MatOfByte fs=new MatOfByte(),bs=new MatOfByte();MatOfFloat fe=new MatOfFloat(),be=new MatOfFloat();
  try{a.put(0,0,first);b.put(0,0,next);Video.calcOpticalFlowPyrLK(a,b,p,q,fs,fe,new Size(21,21),3,new TermCriteria(TermCriteria.COUNT|TermCriteria.EPS,30,.01),0,1e-4);Point[] forward=q.toArray();boolean finite=forward.length==3;for(Point v:forward)finite&=Double.isFinite(v.x)&&Double.isFinite(v.y);if(!finite){System.out.println("SYNTHETIC_DIAGNOSTIC incomplete/nonfinite forward LK");return;}Video.calcOpticalFlowPyrLK(b,a,q,back,bs,be,new Size(21,21),3,new TermCriteria(TermCriteria.COUNT|TermCriteria.EPS,30,.01),0,1e-4);Point[] original=p.toArray(),reverse=back.toArray();byte[] sf=fs.toArray(),sb=bs.toArray();float[] ef=fe.toArray(),eb=be.toArray();for(int i=0;i<3;i++)System.out.println("SYNTHETIC_LK point="+i+" forward="+forward[i]+" backward="+reverse[i]+" status="+sf[i]+","+sb[i]+" L1error="+ef[i]+","+eb[i]+" FBpx="+Math.hypot(original[i].x-reverse[i].x,original[i].y-reverse[i].y));
  }finally{a.release();b.release();p.release();q.release();back.release();fs.release();bs.release();fe.release();be.release();}
 }
 public static void main(String[] args){
  try{System.out.println("SYNTHETIC_STAGE process-start");if(args.length!=1)throw new IllegalArgumentException("Require owned compute native-library directory");OpenCvNative.loadComputeFixture(args[0]);System.out.println("SYNTHETIC_STAGE OpenCV-loaded defaultThreads="+Core.getNumThreads());System.out.println(run());}
  catch(Throwable failure){System.out.println("{\"scope\":\"SYNTHETIC Java/OpenCV compute fixture, not live evidence\",\"passed\":false,\"errorType\":"+json(failure.getClass().getSimpleName())+",\"error\":"+json(failure.getMessage())+"}");failure.printStackTrace(System.out);System.out.flush();System.exit(1);}
 }
}
