package com.moyolearn.blereference;
/** Finite reference-scan policy, independent of Android and never an identity or compatibility assertion. */
public final class ScanPolicy {
 public static final long DURATION_MS=15000;
 public static final int MAX_DEVICES=256,MAX_RAW_BYTES=512;
 private ScanPolicy(){}
 public static boolean accept(boolean foreground,boolean permissionsGranted,boolean locationEnabled,long startedMs,long nowMs){return foreground&&permissionsGranted&&locationEnabled&&startedMs>=0&&nowMs>=startedMs&&nowMs-startedMs<DURATION_MS;}
 public static boolean fresh(long stamp,long started,long now){return stamp>0&&stamp>=started&&stamp<=now+5000000L&&now-stamp<=2000000000L;}
 public static boolean retain(boolean alreadySeen,int count){return alreadySeen||(count>=0&&count<MAX_DEVICES);}
 public static String hex(byte[] bytes){if(bytes==null)return null;StringBuilder b=new StringBuilder();String digits="0123456789abcdef";for(int i=0;i<Math.min(MAX_RAW_BYTES,bytes.length);i++){int n=bytes[i]&255;b.append(digits.charAt(n>>>4)).append(digits.charAt(n&15));}return b.toString();}
}
