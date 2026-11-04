package com.moyolearn.blereference;
public final class ScanPolicyTest {
 public static void main(String[] args){
  if(!ScanPolicy.accept(true,true,true,100,15099)||ScanPolicy.accept(true,true,true,100,15100)||ScanPolicy.accept(false,true,true,100,101)||ScanPolicy.accept(true,false,true,100,101)||ScanPolicy.accept(true,true,false,100,101)||ScanPolicy.accept(true,true,true,100,99))throw new AssertionError("Foreground/permission/location/deadline policy");
  if(!ScanPolicy.fresh(1000000000L,900000000L,1100000000L)||ScanPolicy.fresh(800000000L,900000000L,1100000000L)||ScanPolicy.fresh(1000000000L,900000000L,3100000000L)||ScanPolicy.fresh(0,0,1)||ScanPolicy.fresh(1200000000L,900000000L,1100000000L))throw new AssertionError("Stale/pre-scan/future advertisement accepted");
  if(ScanPolicy.retain(false,256)||!ScanPolicy.retain(true,256)||!ScanPolicy.retain(false,255))throw new AssertionError("Cap must retain updates to known peers");
  byte[] bytes=new byte[600];bytes[0]=(byte)255;bytes[1]=1;if(ScanPolicy.hex(bytes).length()!=1024||!ScanPolicy.hex(bytes).startsWith("ff01")||ScanPolicy.hex(null)!=null)throw new AssertionError("Bounded measured bytes");
  System.out.println("PASS:15s boundary, foreground/permission/location loss, candidate cap updates, bounded hex");
 }
}
