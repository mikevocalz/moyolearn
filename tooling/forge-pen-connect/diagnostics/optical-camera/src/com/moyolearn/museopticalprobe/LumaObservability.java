package com.moyolearn.museopticalprobe;
import java.nio.ByteBuffer;
import java.util.*;
/** Full-resolution intensity/component observations only; no object identity or pose assignment. */
public final class LumaObservability {
 public static final int[] THRESHOLDS={220,235,245};public static final int LIMIT=32,SMALL_MAX_PIXELS=64;
 private byte[] luma=new byte[0],visited=new byte[0];private int[] queue=new int[0];private final int[] histogram=new int[256];
 public static final class Blob {public final int count,left,top,right,bottom,peak;public final double x,y,mean;public final boolean touchesEdge;final long score;
  Blob(int n,int l,int t,int r,int b,int p,long sx,long sy,long sum,long rank,int width,int height){count=n;left=l;top=t;right=r;bottom=b;peak=p;x=(double)sx/n;y=(double)sy/n;mean=(double)sum/n;score=rank;touchesEdge=l==0||t==0||r==width-1||b==height-1;}}
 public static final class Threshold {public final int threshold;public int brightPixels,singletons,smallTotal,largeTotal;public final List<Blob> small=new ArrayList<>(),large=new ArrayList<>();Threshold(int t){threshold=t;}}
 public static final class Result {public final int[] histogram;public final int maxY,p50,p95,p99;public final List<Threshold> thresholds;Result(int[] h,List<Threshold> t,int n){histogram=h;thresholds=t;int max=255;while(max>0&&h[max]==0)max--;maxY=max;p50=percentile(h,n,.5);p95=percentile(h,n,.95);p99=percentile(h,n,.99);}}
 private static int percentile(int[] h,int n,double p){int limit=(int)Math.ceil(n*p),count=0;for(int i=0;i<256;i++){count+=h[i];if(count>=limit)return i;}return 255;}
 private static void retain(PriorityQueue<Blob> heap,int n,int l,int t,int r,int b,int peak,long sx,long sy,long sum,long score,int width,int height){if(heap.size()>=LIMIT&&heap.peek().score>=score)return;if(heap.size()==LIMIT)heap.poll();heap.add(new Blob(n,l,t,r,b,peak,sx,sy,sum,score,width,height));}
 public Result analyze(ByteBuffer source,int rowStride,int pixelStride,int width,int height){
  if(width<=0||height<=0||width>1280||height>960||rowStride<=0||pixelStride<=0)throw new IllegalArgumentException("Invalid bounded luma layout");int size=Math.multiplyExact(width,height);
  if(luma.length!=size){luma=new byte[size];visited=new byte[size];queue=new int[size];}Arrays.fill(histogram,0);int base=source.position();
  for(int y=0;y<height;y++)for(int x=0;x<width;x++){long p=(long)base+(long)y*rowStride+(long)x*pixelStride;if(p>=source.limit())throw new IllegalArgumentException("Truncated luma plane");byte raw=source.get((int)p);luma[y*width+x]=raw;histogram[raw&255]++;}
  List<Threshold> results=new ArrayList<>();for(int threshold:THRESHOLDS){Arrays.fill(visited,(byte)0);Threshold result=new Threshold(threshold);PriorityQueue<Blob> small=new PriorityQueue<>(Comparator.comparingLong(a->a.score)),large=new PriorityQueue<>(Comparator.comparingLong(a->a.score));
   for(int index=0;index<size;index++){if(visited[index]!=0||(luma[index]&255)<threshold)continue;int start=0,end=0,n=0,left=width,top=height,right=0,bottom=0,peak=0;long sx=0,sy=0,sum=0;queue[end++]=index;visited[index]=1;
    while(start<end){int p=queue[start++],x=p%width,y=p/width,v=luma[p]&255;n++;sx+=x;sy+=y;sum+=v;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);peak=Math.max(peak,v);
     if(x>0&&visited[p-1]==0&&(luma[p-1]&255)>=threshold){visited[p-1]=1;queue[end++]=p-1;}
     if(x+1<width&&visited[p+1]==0&&(luma[p+1]&255)>=threshold){visited[p+1]=1;queue[end++]=p+1;}
     if(y>0&&visited[p-width]==0&&(luma[p-width]&255)>=threshold){visited[p-width]=1;queue[end++]=p-width;}
     if(y+1<height&&visited[p+width]==0&&(luma[p+width]&255)>=threshold){visited[p+width]=1;queue[end++]=p+width;}
    }
    result.brightPixels+=n;if(n==1)result.singletons++;if(n<=SMALL_MAX_PIXELS){result.smallTotal++;long score=((long)peak<<32)+(sum-(long)threshold*n);retain(small,n,left,top,right,bottom,peak,sx,sy,sum,score,width,height);}else{result.largeTotal++;long score=((long)n<<16)+peak;retain(large,n,left,top,right,bottom,peak,sx,sy,sum,score,width,height);}
   }
   result.small.addAll(small);result.large.addAll(large);result.small.sort((a,b)->Long.compare(b.score,a.score));result.large.sort((a,b)->Long.compare(b.score,a.score));results.add(result);
  }
  return new Result(histogram.clone(),results,size);
 }
}
