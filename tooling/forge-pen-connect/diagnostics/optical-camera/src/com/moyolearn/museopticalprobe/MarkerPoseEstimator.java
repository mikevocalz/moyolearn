package com.moyolearn.museopticalprobe;
import org.opencv.core.*;
import org.opencv.calib3d.Calib3d;
import org.opencv.objdetect.*;
import org.json.*;
import java.nio.ByteBuffer;
import java.util.*;
/** Optional known-size marker pose in CAMERA coordinates; never a world/headset/Muse pose. */
public final class MarkerPoseEstimator {
 public static final double MAX_ERROR_PX=2.0,MIN_ERROR_GAP_PX=.5,MIN_ERROR_RATIO=2.0;
 private final ArucoDetector detector;private final int id;private final double side;
 public MarkerPoseEstimator(int markerId,double blackSideMeters){if(markerId<0||markerId>=50||!Double.isFinite(blackSideMeters)||blackSideMeters<.005||blackSideMeters>.5)throw new IllegalArgumentException("Explicit DICT_4X4_50 ID0..49 and measured black side5..500mm required");id=markerId;side=blackSideMeters;OpenCvNative.ensureLoaded();detector=new ArucoDetector(Objdetect.getPredefinedDictionary(Objdetect.DICT_4X4_50));}
 public JSONObject analyze(ByteBuffer bytes,int rowStride,int pixelStride,int width,int height,CameraCalibration c)throws JSONException {
  byte[] y=new byte[width*height];int base=bytes.position();for(int r=0;r<height;r++)for(int x=0;x<width;x++){long p=(long)base+(long)r*rowStride+(long)x*pixelStride;if(p>=bytes.limit())throw new IllegalArgumentException("Truncated luma plane");y[r*width+x]=bytes.get((int)p);}
  Mat image=new Mat(height,width,CvType.CV_8UC1),ids=new Mat();List<Mat> corners=new ArrayList<>();
  try{image.put(0,0,y);detector.detectMarkers(image,corners,ids);int selected=-1,matches=0;for(int i=0;i<ids.rows();i++)if((int)ids.get(i,0)[0]==id){selected=i;matches++;}
   if(matches!=1)return unavailable(matches==0?"Configured marker not detected":"Duplicate configured marker ID");
   double[][] pixels=new double[4][2];for(int i=0;i<4;i++){pixels[i]=corners.get(selected).get(0,i);if(pixels[i][0]<0||pixels[i][0]>=width||pixels[i][1]<0||pixels[i][1]>=height)return unavailable("Marker corner outside image");}
   return solveCorners(pixels,c);
  }finally{image.release();ids.release();for(Mat m:corners)m.release();}
 }
 private static JSONObject unavailable(String reason)throws JSONException {return new JSONObject().put("phase","unavailable").put("reason",reason).put("currentPose",JSONObject.NULL);}
 public JSONObject solveCorners(double[][] pixels,CameraCalibration c)throws JSONException {
  if(c==null||pixels==null||pixels.length!=4)return unavailable("Calibration/corners unavailable");for(double[] p:pixels)if(p==null||p.length!=2||!Double.isFinite(p[0])||!Double.isFinite(p[1]))return unavailable("Invalid corner");
  double h=side/2;MatOfPoint3f object=new MatOfPoint3f(new Point3(-h,h,0),new Point3(h,h,0),new Point3(h,-h,0),new Point3(-h,-h,0));MatOfPoint2f observed=new MatOfPoint2f(new Point(pixels[0]),new Point(pixels[1]),new Point(pixels[2]),new Point(pixels[3]));Mat k=Mat.eye(3,3,CvType.CV_64F);k.put(0,0,c.fx);k.put(1,1,c.fy);k.put(0,2,c.cx);k.put(1,2,c.cy);MatOfDouble distortion=new MatOfDouble(c.distortion);List<Mat> rotations=new ArrayList<>(),translations=new ArrayList<>();
  try{Calib3d.solvePnPGeneric(object,observed,k,distortion,rotations,translations,false,Calib3d.SOLVEPNP_IPPE_SQUARE);List<Candidate> candidates=new ArrayList<>();
   for(int i=0;i<rotations.size();i++){Mat r=new Mat();MatOfPoint2f projected=new MatOfPoint2f();try{Calib3d.Rodrigues(rotations.get(i),r);double[] rv=new double[9],t=new double[3];r.get(0,0,rv);translations.get(i).get(0,0,t);boolean valid=true;for(double x:rv)valid&=Double.isFinite(x);for(double x:t)valid&=Double.isFinite(x);for(Point3 p:object.toArray())valid&=rv[6]*p.x+rv[7]*p.y+t[2]>0;
     if(!valid)continue;double determinant=Core.determinant(r);if(!Double.isFinite(determinant)||Math.abs(determinant-1)>1e-5)continue;
     Calib3d.projectPoints(object,rotations.get(i),translations.get(i),k,distortion,projected);Point[] reproj=projected.toArray();double error=0;for(int j=0;j<4;j++)error+=Math.pow(reproj[j].x-pixels[j][0],2)+Math.pow(reproj[j].y-pixels[j][1],2);error=Math.sqrt(error/4);if(Double.isFinite(error))candidates.add(new Candidate(rv,t,error));
    }finally{r.release();projected.release();}}
   candidates.sort(Comparator.comparingDouble(a->a.error));if(candidates.isEmpty()||candidates.get(0).error>MAX_ERROR_PX)return unavailable("Positive-depth/reprojection check failed");
   Candidate best=candidates.get(0);if(candidates.size()<2)return unavailable("IPPE ambiguity could not be evaluated");double alternate=candidates.get(1).error;
   if(alternate-best.error<MIN_ERROR_GAP_PX||alternate<Math.max(best.error,.05)*MIN_ERROR_RATIO)return unavailable("Planar pose ambiguous");
   return new JSONObject().put("phase","camera-relative-marker-pose").put("markerId",id).put("dictionary","DICT_4X4_50").put("measuredBlackSideMeters",side).put("translationMeters",new JSONArray(best.t)).put("rotationRowMajor",new JSONArray(best.r)).put("reprojectionRmsPixels",best.error).put("alternateRmsPixels",alternate).put("axes","camera X right, Y down, Z forward").put("headsetOrWorldPose",false).put("museIdentityEstablished",false);
  }finally{object.release();observed.release();k.release();distortion.release();for(Mat r:rotations)r.release();for(Mat t:translations)t.release();}
 }
 private static final class Candidate{final double[]r,t;final double error;Candidate(double[]a,double[]b,double e){r=a;t=b;error=e;}}
 public static JSONObject syntheticFixture()throws JSONException {
  MarkerPoseEstimator estimator=new MarkerPoseEstimator(7,.04);CameraCalibration c=CameraCalibration.from(new float[]{800,800,320.5f,240.5f,0},new float[5],new int[]{0,0,640,480},new int[]{0,0,640,480},640,480);
  MatOfPoint3f object=new MatOfPoint3f(new Point3(-.02,.02,0),new Point3(.02,.02,0),new Point3(.02,-.02,0),new Point3(-.02,-.02,0));Mat rv=new Mat(3,1,CvType.CV_64F),tv=new Mat(3,1,CvType.CV_64F),k=Mat.eye(3,3,CvType.CV_64F);MatOfDouble d=new MatOfDouble(0,0,0,0,0);MatOfPoint2f projected=new MatOfPoint2f();
  try{rv.put(0,0,.5,.2,.1);tv.put(0,0,.01,.02,.3);k.put(0,0,800);k.put(1,1,800);k.put(0,2,320);k.put(1,2,240);Calib3d.projectPoints(object,rv,tv,k,d,projected);double[][] pixels=new double[4][2];Point[] p=projected.toArray();for(int i=0;i<4;i++)pixels[i]=new double[]{p[i].x,p[i].y};JSONObject result=estimator.solveCorners(pixels,c);if(!"camera-relative-marker-pose".equals(result.optString("phase")))throw new IllegalStateException("Synthetic oblique projection rejected: "+result);JSONArray t=result.getJSONArray("translationMeters");if(Math.abs(t.getDouble(2)-.3)>.001)throw new IllegalStateException("Synthetic depth mismatch");JSONObject passed=new JSONObject().put("scope","SYNTHETIC backend fixture, not live observation").put("passed",true).put("recovered",result);
   rv.put(0,0,0.,0.,0.);tv.put(0,0,0.,0.,.3);Calib3d.projectPoints(object,rv,tv,k,d,projected);p=projected.toArray();for(int i=0;i<4;i++)pixels[i]=new double[]{p[i].x,p[i].y};JSONObject ambiguous=estimator.solveCorners(pixels,c);if(!"unavailable".equals(ambiguous.optString("phase")))throw new IllegalStateException("Ambiguous frontal fixture accepted");passed.put("frontalAmbiguityRejected",true);
   Mat marker=new Mat(),canvas=new Mat(400,400,CvType.CV_8UC1,new Scalar(255)),ids=new Mat();List<Mat> corners=new ArrayList<>();Mat roi=null;
   try{Objdetect.generateImageMarker(Objdetect.getPredefinedDictionary(Objdetect.DICT_4X4_50),7,200,marker);roi=canvas.submat(100,300,100,300);marker.copyTo(roi);estimator.detector.detectMarkers(canvas,corners,ids);if(ids.rows()!=1||(int)ids.get(0,0)[0]!=7)throw new IllegalStateException("Synthetic dictionary detection mismatch");passed.put("generatedMarkerId7Decoded",true);}finally{if(roi!=null)roi.release();marker.release();canvas.release();ids.release();for(Mat corner:corners)corner.release();}return passed;
  }finally{object.release();rv.release();tv.release();k.release();d.release();projected.release();}
 }
}
