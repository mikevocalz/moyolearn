package com.moyolearn.museopticalprobe;
/** Compute-only app_process entry point. No Activity, cameras, UiAutomation or persistent output. */
public final class OpticalComputeFixture {
 public static void main(String[] args)throws Exception {
  if(args.length!=1)throw new IllegalArgumentException("Exactly one owned native-library directory required");
  OpenCvNative.loadComputeFixture(args[0]);
  System.out.println("SYNTHETIC_BACKEND_FIXTURE "+MarkerPoseEstimator.syntheticFixture().toString());
 }
}
