package com.moyolearn.museopticalprobe;
public final class CameraCalibrationTest {
 static void near(double a,double b){if(Math.abs(a-b)>1e-6)throw new AssertionError(a+" != "+b);}
 public static void main(String[] args){
  CameraCalibration c=CameraCalibration.from(new float[]{1000,900,1000,750,0},new float[]{1,2,3,4,5},new int[]{0,0,2000,1500},new int[]{0,0,2000,1500},640,480);near(c.fx,320);near(c.fy,288);near(c.cx,319.5);near(c.cy,239.5);near(c.distortion[2],4);near(c.distortion[4],3);
  c=CameraCalibration.from(new float[]{1000,1000,1000,750,0},new float[5],new int[]{10,20,2010,1520},new int[]{500,250,1500,1250},800,400);near(c.fx,800);near(c.fy,800);near(c.cx,399.5);near(c.cy,199.5);
  CameraCalibration shifted=CameraCalibration.from(new float[]{1000,900,1000,750,0},new float[5],new int[]{37,51,2037,1551},new int[]{0,0,2000,1500},640,480);near(shifted.fx,320);near(shifted.cx,319.5);near(shifted.cy,239.5);
  try{CameraCalibration.from(new float[]{1000,900,1000,750,0},new float[5],new int[]{1000,1000,3000,2500},new int[]{1000,1000,3000,2500},640,480);throw new AssertionError("Fullsensor-absolute crop incorrectly accepted");}catch(IllegalArgumentException expected){}
  try{CameraCalibration.from(null,new float[5],new int[4],new int[4],640,480);throw new AssertionError("Missing calibration accepted");}catch(IllegalArgumentException expected){}
  try{CameraCalibration.from(new float[]{1,1,1,1,.1f},new float[5],new int[]{0,0,2,2},new int[]{0,0,2,2},2,2);throw new AssertionError("Skew accepted");}catch(IllegalArgumentException expected){}
  System.out.println("PASS: synthetic crop/scaling/pixel-center/distortion ordering; missing calibration/skew rejected");
 }
}
