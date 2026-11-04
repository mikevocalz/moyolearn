package com.moyolearn.museledstate;
/** Decoder of the actual pinned 14-byte Output4 report. Does not issue or construct device writes. */
public final class LedOutputReport {
 public final int mode,intensity,onDurationMicros,offDurationMicros;
 private LedOutputReport(int m,int i,int on,int off){mode=m;intensity=i;onDurationMicros=on;offDurationMicros=off;}
 public static LedOutputReport decode(byte[] value){
  if(value==null||value.length!=14)throw new IllegalArgumentException("Expected actual14-byte output payload without report ID");
  int mode=value[8]&255,intensity=value[9]&255,on=(value[10]&255)|((value[11]&255)<<8),off=(value[12]&255)|((value[13]&255)<<8);
  if(mode<1||mode>3||intensity>100||on>32767||off>32767)throw new IllegalArgumentException("Output value outside pinned descriptor logical ranges");
  return new LedOutputReport(mode,intensity,on,off);
 }
 public String modeName(){return mode==1?"led-on":mode==2?"fast-blink":"led-off";}
}
