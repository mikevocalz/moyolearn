package com.moyolearn.museopticalprobe;
public final class FrameFreshnessTest {
 static void reject(boolean clock,long time,long now){try{FrameFreshness.imageAge(clock,time,now);throw new AssertionError("Invalid frame accepted");}catch(IllegalArgumentException expected){}}
 public static void main(String[] args){long now=2000000000L;if(FrameFreshness.imageAge(true,now-500000000L,now)!=500000000L)throw new AssertionError("Age boundary");if(FrameFreshness.imageAge(true,now+5000000L,now)!=-5000000L)throw new AssertionError("Future boundary");reject(false,now,now);reject(true,0,now);reject(true,now-500000001L,now);reject(true,now+5000001L,now);System.out.println("PASS: explicit REALTIME domain,500ms age/5ms future boundaries and invalid timestamps");}
}
