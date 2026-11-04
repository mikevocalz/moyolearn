package com.moyolearn.museopticalprobe;
/** Camera2 pre-correction pixel calibration -> unrotated stream pixels. No guessed FOV. */
public final class CameraCalibration {
 public final double fx,fy,cx,cy;public final double[] distortion;
 private CameraCalibration(double x,double y,double a,double b,double[] d){fx=x;fy=y;cx=a;cy=b;distortion=d;}
 public static CameraCalibration from(float[] intrinsic,float[] androidDistortion,int[] pre,int[] crop,int width,int height){
  if(intrinsic==null||intrinsic.length!=5||androidDistortion==null||androidDistortion.length!=5||pre==null||pre.length!=4||crop==null||crop.length!=4||width<=0||height<=0)throw new IllegalArgumentException("Calibration unavailable");
  for(float n:intrinsic)if(!Float.isFinite(n))throw new IllegalArgumentException("Nonfinite intrinsics");for(float n:androidDistortion)if(!Float.isFinite(n))throw new IllegalArgumentException("Nonfinite distortion");
  if(intrinsic[0]<=0||intrinsic[1]<=0||Math.abs(intrinsic[4])>1e-6)throw new IllegalArgumentException("Unsupported focal length/skew");
  if(pre[2]<=pre[0]||pre[3]<=pre[1]||crop[0]<0||crop[1]<0||crop[2]>pre[2]-pre[0]||crop[3]>pre[3]-pre[1]||crop[2]<=crop[0]||crop[3]<=crop[1])throw new IllegalArgumentException("Invalid sensor crop");
  double left=crop[0],top=crop[1],w=crop[2]-left,h=crop[3]-top,aspect=(double)width/height;
  if(w/h>aspect){double next=h*aspect;left+=(w-next)/2;w=next;}else{double next=w/aspect;top+=(h-next)/2;h=next;}
  double sx=width/w,sy=height/h;
  // OFF crop and intrinsics both use origin(0,0) at precorrection top-left; pre.left/top are not added.
  // Camera2 centers pixel(i,j) at(i+.5,j+.5); OpenCV indexes those centers at(i,j).
  double cx=(intrinsic[2]-left)*sx-.5,cy=(intrinsic[3]-top)*sy-.5;
  double[] d={androidDistortion[0],androidDistortion[1],androidDistortion[3],androidDistortion[4],androidDistortion[2]};
  return new CameraCalibration(intrinsic[0]*sx,intrinsic[1]*sy,cx,cy,d);
 }
}
