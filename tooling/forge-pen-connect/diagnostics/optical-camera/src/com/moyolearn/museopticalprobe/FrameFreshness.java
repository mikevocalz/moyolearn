package com.moyolearn.museopticalprobe;
/** Prototype-only monotonic Camera2 REALTIME image gate; never guesses a clock offset. */
public final class FrameFreshness {
 public static long imageAge(boolean realtime,long imageTimestamp,long elapsedRealtimeNow){
  if(!realtime)throw new IllegalArgumentException("Unknown/non-REALTIME camera timestamp domain");
  if(imageTimestamp<=0||elapsedRealtimeNow<0)throw new IllegalArgumentException("Invalid image timestamp");
  long age=elapsedRealtimeNow-imageTimestamp;
  if(age< -5000000L||age>500000000L)throw new IllegalArgumentException("Image older than500ms or future by more than5ms");return age;
 }
}
