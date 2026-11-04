package com.moyolearn.museledstate;
public final class LedOutputReportTest {
 private static void reject(byte[] v){try{LedOutputReport.decode(v);throw new AssertionError("Malformed report accepted");}catch(IllegalArgumentException expected){}}
 public static void main(String[] args){
  byte[] v={(byte)255,23,45,67,89,1,2,3,2,100,0x34,0x12,(byte)0xff,0x7f};
  LedOutputReport r=LedOutputReport.decode(v);if(r.mode!=2||!r.modeName().equals("fast-blink")||r.intensity!=100||r.onDurationMicros!=4660||r.offDurationMicros!=32767)throw new AssertionError("Actual layout/LE decoding mismatch");
  byte[] original=v.clone();v[0]=0;v[7]=(byte)255;LedOutputReport opaque=LedOutputReport.decode(v);if(opaque.mode!=r.mode||opaque.onDurationMicros!=r.onDurationMicros)throw new AssertionError("Opaque first8bytes affected fields");
  v=original.clone();v[8]=1;if(!LedOutputReport.decode(v).modeName().equals("led-on"))throw new AssertionError("Mode1");v[8]=3;if(!LedOutputReport.decode(v).modeName().equals("led-off"))throw new AssertionError("Mode3");v[8]=0;reject(v);v[8]=4;reject(v);v=original.clone();v[9]=101;reject(v);v=original.clone();v[13]=(byte)0x80;reject(v);reject(new byte[15]);reject(new byte[13]);reject(null);
  System.out.println("PASS: pinned14B layout, opaque prefix, modes/ranges,16-bitLE durations");
 }
}
