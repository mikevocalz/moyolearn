package com.moyolearn.museopticalprobe;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
/** Saturated luma components only. No device identity, correspondence, or pose inference. */
public final class BrightBlobDetector {
 public static final int THRESHOLD=245,STEP=2,MAX_BLOBS=32;
 public static final class Blob {public int count;public double x,y;Blob(int n,double a,double b){count=n;x=a;y=b;}}
 public static final class Result {public final List<Blob> blobs;public final int brightSamples,totalSamples;Result(List<Blob>b,int n,int t){blobs=b;brightSamples=n;totalSamples=t;}}
 public static Result analyze(ByteBuffer bytes,int rowStride,int pixelStride,int width,int height){
  if(width<=0||height<=0||width>2048||height>2048||rowStride<=0||pixelStride<=0)throw new IllegalArgumentException("Invalid luma layout");
  int w=(width+STEP-1)/STEP,h=(height+STEP-1)/STEP,size=Math.multiplyExact(w,h),bright=0;byte[] mask=new byte[size];int base=bytes.position();
  for(int y=0;y<h;y++)for(int x=0;x<w;x++) {long address=(long)base+(long)y*STEP*rowStride+(long)x*STEP*pixelStride;if(address>=bytes.limit())throw new IllegalArgumentException("Truncated luma plane");if((bytes.get((int)address)&255)>=THRESHOLD){mask[y*w+x]=1;bright++;}}
  int[] queue=new int[size];List<Blob> all=new ArrayList<>();
  for(int index=0;index<size;index++)if(mask[index]==1){int start=0,end=0,n=0;long sx=0,sy=0;queue[end++]=index;mask[index]=2;
   while(start<end){int p=queue[start++],x=p%w,y=p/w;n++;sx+=x;sy+=y;int[] neighbors={x>0?p-1:-1,x+1<w?p+1:-1,y>0?p-w:-1,y+1<h?p+w:-1};for(int q:neighbors)if(q>=0&&mask[q]==1){mask[q]=2;queue[end++]=q;}}
   if(n>=2)all.add(new Blob(n,(double)sx/n*STEP,(double)sy/n*STEP));
  }
  all.sort(Comparator.comparingInt((Blob b)->b.count).reversed());return new Result(new ArrayList<>(all.subList(0,Math.min(MAX_BLOBS,all.size()))),bright,size);
 }
}
