package com.moyolearn.museopticalprobe;

import java.nio.ByteBuffer;
import java.util.*;
import java.util.function.LongSupplier;
import org.opencv.core.*;
import org.opencv.video.Video;

/** User-seeded 2D visual observations ONLY. No Muse recognition, depth, pose, or reacquisition.
 * Single owner thread. Raw sensor timestamps are compared only within the same session.
 * Callback age is NOT exposure age. Any failed gate clears ALL points until explicit reseed.
 */
public final class UnmodifiedPointTracker implements AutoCloseable {
 public enum State { NEEDS_SEED, TRACKING, LOST, CLOSED }
 public static final class Config {
  public final long maxCallbackAgeNs,maxSensorGapNs;
  public final double maxStepPixels,maxForwardBackwardPixels,maxLkError,maxSeedPatchError;
  public Config(){this(250000000L,750000000L,32,1,12,20);}
  public Config(long age,long gap,double step,double fb,double lk,double patch){
   if(age<=0||age>1000000000L||gap<=0||gap>1000000000L||!finitePositive(step)||step>64||!finitePositive(fb)||fb>2||!finitePositive(lk)||lk>30||!finitePositive(patch)||patch>40)throw new IllegalArgumentException("Invalid bounded tracking gates");
   maxCallbackAgeNs=age;maxSensorGapNs=gap;maxStepPixels=step;maxForwardBackwardPixels=fb;maxLkError=lk;maxSeedPatchError=patch;
  }
 }
 public static final class Seed {
  public final int id;public final double x,y;
  public Seed(int id,double x,double y){this.id=id;this.x=x;this.y=y;}
 }
 public static final class FrameLuma {
  public final ByteBuffer luma;public final int rowStride,pixelStride;
  public final String sessionId;public final long sensorTimestampNs,callbackElapsedRealtimeNs;
  public FrameLuma(ByteBuffer luma,int rowStride,int pixelStride,String sessionId,long sensorTimestampNs,long callbackElapsedRealtimeNs){this.luma=luma;this.rowStride=rowStride;this.pixelStride=pixelStride;this.sessionId=sessionId;this.sensorTimestampNs=sensorTimestampNs;this.callbackElapsedRealtimeNs=callbackElapsedRealtimeNs;}
 }
 public static final class PointObservation {
  public final int id;public final boolean flowMeasured;public final double x,y,forwardBackwardPixels,lkError,seedPatchError;
  PointObservation(int id,Point p,double fb,double lk,double patch,boolean measured){this.id=id;flowMeasured=measured;x=p.x;y=p.y;forwardBackwardPixels=fb;lkError=lk;seedPatchError=patch;}
 }
 public static final class Observation {
  public final State state;public final String sessionId,reason;
  public final long sensorTimestampNs,callbackAgeNs;
  public final boolean exposureAgeVerified=false,museIdentityEstablished=false,depthOrPoseEstablished=false;
  public final List<PointObservation> currentPoints;
  Observation(State s,FrameLuma f,long age,String why,List<PointObservation> points){state=s;sessionId=f==null?null:f.sessionId;sensorTimestampNs=f==null?0:f.sensorTimestampNs;callbackAgeNs=age;reason=why;currentPoints=Collections.unmodifiableList(points);}
 }
 private static final int MAX_POINTS=32,RADIUS=4,MARGIN=11;
 private final int width,height;private final Config config;private final LongSupplier elapsedRealtimeNs;
 private final byte[] pixels;private final double[][] seedPatches=new double[MAX_POINTS][81];
 private final Mat previous,current;
 private final MatOfPoint2f previousPoints,forward,backward;
 private final MatOfByte forwardStatus,backwardStatus;
 private final MatOfFloat forwardError,backwardError;
 private final Size window=new Size(21,21);private final TermCriteria criteria=new TermCriteria(TermCriteria.COUNT|TermCriteria.EPS,30,.01);
 private State state=State.NEEDS_SEED;private String session;private int[] ids=new int[0];private long lastSensor,lastCallback;
 public UnmodifiedPointTracker(int width,int height,Config config,LongSupplier elapsedRealtimeNs){
  if(width<32||height<32||width>1280||height>1280||config==null||elapsedRealtimeNs==null)throw new IllegalArgumentException("Fixed bounded resolution/config/clock required");
  this.width=width;this.height=height;this.config=config;this.elapsedRealtimeNs=elapsedRealtimeNs;pixels=new byte[Math.multiplyExact(width,height)];
  OpenCvNative.ensureLoaded();previous=new Mat();current=new Mat();previousPoints=new MatOfPoint2f();forward=new MatOfPoint2f();backward=new MatOfPoint2f();forwardStatus=new MatOfByte();backwardStatus=new MatOfByte();forwardError=new MatOfFloat();backwardError=new MatOfFloat();
  previous.create(height,width,CvType.CV_8UC1);current.create(height,width,CvType.CV_8UC1);
 }
 private static boolean finitePositive(double v){return Double.isFinite(v)&&v>0;}
 private boolean inside(Point p){return Double.isFinite(p.x)&&Double.isFinite(p.y)&&p.x>=MARGIN&&p.y>=MARGIN&&p.x<width-MARGIN&&p.y<height-MARGIN;}
 private long callbackAge(FrameLuma f){long now=elapsedRealtimeNs.getAsLong();if(f.callbackElapsedRealtimeNs<=0||now<f.callbackElapsedRealtimeNs)throw new IllegalArgumentException("Invalid callback clock");long age=now-f.callbackElapsedRealtimeNs;if(age>config.maxCallbackAgeNs)throw new IllegalArgumentException("Stale callback; exposure age remains unverified");return age;}
 private void copy(FrameLuma f){
  if(f==null||f.luma==null||f.sessionId==null||f.sessionId.isEmpty()||f.sessionId.length()>128||f.sensorTimestampNs<=0||f.rowStride<=0||f.pixelStride<=0||(long)f.rowStride<(long)(width-1)*f.pixelStride+1)throw new IllegalArgumentException("Invalid frame layout/session/timestamp");
  ByteBuffer b=f.luma.duplicate();int base=b.position();long last=(long)base+(long)(height-1)*f.rowStride+(long)(width-1)*f.pixelStride;if(last>=b.limit())throw new IllegalArgumentException("Truncated luma plane");
  for(int y=0;y<height;y++)for(int x=0;x<width;x++)pixels[y*width+x]=b.get(base+y*f.rowStride+x*f.pixelStride);
 }
 private double sample(double x,double y){int a=(int)Math.floor(x),b=(int)Math.floor(y);double u=x-a,v=y-b;return (1-v)*((1-u)*(pixels[b*width+a]&255)+u*(pixels[b*width+a+1]&255))+v*((1-u)*(pixels[(b+1)*width+a]&255)+u*(pixels[(b+1)*width+a+1]&255));}
 private boolean textured(Point p){
  double sum=0,squared=0,gxx=0,gxy=0,gyy=0;
  for(int y=-RADIUS;y<=RADIUS;y++)for(int x=-RADIUS;x<=RADIUS;x++){double value=sample(p.x+x,p.y+y);sum+=value;squared+=value*value;if(Math.abs(x)<RADIUS&&Math.abs(y)<RADIUS){double gx=(sample(p.x+x+1,p.y+y)-sample(p.x+x-1,p.y+y))/510,gy=(sample(p.x+x,p.y+y+1)-sample(p.x+x,p.y+y-1))/510;gxx+=gx*gx;gxy+=gx*gy;gyy+=gy*gy;}}
  double eigen=(gxx+gyy-Math.sqrt((gxx-gyy)*(gxx-gyy)+4*gxy*gxy))/98;
  return squared/81-Math.pow(sum/81,2)>=25&&eigen>=1e-4;
 }
 private double patchError(Point p,double[] reference,boolean store){double total=0;int i=0;for(int y=-RADIUS;y<=RADIUS;y++)for(int x=-RADIUS;x<=RADIUS;x++){double v=sample(p.x+x,p.y+y);if(store)reference[i]=v;else total+=Math.abs(v-reference[i]);i++;}return total/81;}
 private void clearPoints(){ids=new int[0];session=null;lastSensor=lastCallback=0;previousPoints.release();forward.release();backward.release();forwardStatus.release();backwardStatus.release();forwardError.release();backwardError.release();previous.setTo(Scalar.all(0));current.setTo(Scalar.all(0));for(double[] patch:seedPatches)Arrays.fill(patch,0);}
 private Observation lost(FrameLuma f,String reason){clearPoints();state=State.LOST;return new Observation(state,f,-1,reason,Collections.emptyList());}
 private Observation empty(FrameLuma f){return new Observation(state,f,-1,state==State.CLOSED?"Tracker closed":"Explicit user reseed required",Collections.emptyList());}
 public Observation seed(FrameLuma f,List<Seed> seeds){
  if(state==State.CLOSED)return empty(f);clearPoints();state=State.NEEDS_SEED;
  try{copy(f);long age=callbackAge(f);if(seeds==null||seeds.size()<3||seeds.size()>MAX_POINTS)throw new IllegalArgumentException("Require3..32 explicit user-selected feature IDs");Set<Integer> unique=new HashSet<>();Point[] points=new Point[seeds.size()];int[] selectedIds=new int[points.length];
   for(int i=0;i<points.length;i++){Seed s=seeds.get(i);if(s==null||s.id<0||!unique.add(s.id))throw new IllegalArgumentException("Unique nonnegative explicit IDs required");Point p=new Point(s.x,s.y);if(!inside(p)||!textured(p))throw new IllegalArgumentException("Seed outside patch bounds or non-textured");for(int j=0;j<i;j++)if(Math.hypot(p.x-points[j].x,p.y-points[j].y)<3)throw new IllegalArgumentException("Seed pixels must be distinct");points[i]=p;selectedIds[i]=s.id;patchError(p,seedPatches[i],true);}
   age=callbackAge(f);previous.put(0,0,pixels);previousPoints.fromArray(points);ids=selectedIds;session=f.sessionId;lastSensor=f.sensorTimestampNs;lastCallback=f.callbackElapsedRealtimeNs;state=State.TRACKING;List<PointObservation> out=new ArrayList<>();for(int i=0;i<points.length;i++)out.add(new PointObservation(ids[i],points[i],0,0,0,false));return new Observation(state,f,age,"User-selected seed observations; no motion estimated",out);
  }catch(RuntimeException e){return lost(f,e.getClass().getSimpleName()+": "+e.getMessage());}
 }
 public Observation observe(FrameLuma f){
  if(state!=State.TRACKING)return empty(f);
  try{copy(f);long age=callbackAge(f);if(!session.equals(f.sessionId)||f.sensorTimestampNs<=lastSensor||f.sensorTimestampNs-lastSensor>config.maxSensorGapNs||f.callbackElapsedRealtimeNs<lastCallback)throw new IllegalArgumentException("Session changed, sensor gap, or non-increasing timestamp");current.put(0,0,pixels);
   Video.calcOpticalFlowPyrLK(previous,current,previousPoints,forward,forwardStatus,forwardError,window,3,criteria,0,1e-4);
   Point[] from=previousPoints.toArray(),to=forward.toArray();byte[] fs=forwardStatus.toArray();float[] fe=forwardError.toArray();int n=ids.length;
   if(from.length!=n||to.length!=n||fs.length!=n||fe.length!=n)throw new IllegalStateException("Incomplete forward LK output");
   for(int i=0;i<n;i++)if(fs[i]==0||!inside(to[i])||!Float.isFinite(fe[i])||fe[i]<0||fe[i]>config.maxLkError)throw new IllegalStateException("Forward LK gate failed id="+ids[i]+" status="+fs[i]+" point="+to[i]+" inBounds="+inside(to[i])+" fe="+fe[i]+" maxLk="+config.maxLkError);
   Video.calcOpticalFlowPyrLK(current,previous,forward,backward,backwardStatus,backwardError,window,3,criteria,0,1e-4);
   Point[] back=backward.toArray();byte[] bs=backwardStatus.toArray();float[] be=backwardError.toArray();
   if(from.length!=n||to.length!=n||back.length!=n||fs.length!=n||bs.length!=n||fe.length!=n||be.length!=n)throw new IllegalStateException("Incomplete LK output");List<PointObservation> out=new ArrayList<>();
   for(int i=0;i<n;i++){double fb=Math.hypot(from[i].x-back[i].x,from[i].y-back[i].y),step=Math.hypot(from[i].x-to[i].x,from[i].y-to[i].y);boolean range=inside(to[i])&&inside(back[i]),texture=inside(to[i])&&textured(to[i]);double patch=inside(to[i])?patchError(to[i],seedPatches[i],false):Double.NaN;String detail=" id="+ids[i]+" fs="+fs[i]+" bs="+bs[i]+" forward="+to[i]+" backward="+back[i]+" fb="+fb+" maxFb="+config.maxForwardBackwardPixels+" step="+step+" maxStep="+config.maxStepPixels+" fe="+fe[i]+" be="+be[i]+" maxLk="+config.maxLkError+" range="+range+" texture="+texture+" patch="+patch+" maxPatch="+config.maxSeedPatchError;
    if(fs[i]==0||bs[i]==0)throw new IllegalStateException("LK status gate failed"+detail);
    if(!range||!Double.isFinite(fb)||fb>config.maxForwardBackwardPixels||step>config.maxStepPixels)throw new IllegalStateException("LK range/forward-backward/motion gate failed"+detail);
    if(!Float.isFinite(fe[i])||!Float.isFinite(be[i])||fe[i]<0||be[i]<0||fe[i]>config.maxLkError||be[i]>config.maxLkError)throw new IllegalStateException("LK photometric gate failed"+detail);
    if(!texture)throw new IllegalStateException("LK texture gate failed"+detail);
    if(!Double.isFinite(patch)||patch>config.maxSeedPatchError)throw new IllegalStateException("Seed patch appearance gate failed"+detail);out.add(new PointObservation(ids[i],to[i],fb,fe[i],patch,true));}
   long completedAge=callbackAge(f);current.copyTo(previous);previousPoints.fromArray(to);lastSensor=f.sensorTimestampNs;lastCallback=f.callbackElapsedRealtimeNs;return new Observation(state,f,completedAge,"2D LK observations only; physical identity and exposure age unverified",out);
  }catch(RuntimeException e){return lost(f,e.getClass().getSimpleName()+": "+e.getMessage());}
 }
 @Override public void close(){if(state==State.CLOSED)return;clearPoints();previous.release();current.release();state=State.CLOSED;}
}
