package com.moyolearn.museopticalprobe;
import java.io.*;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.UUID;
/** Immutable capture snapshots; only successful terminal captures publish latest-completed. */
final class CaptureJournal {
 private final File root; private String id; private int sequence; private boolean active;
 CaptureJournal(File root){this.root=root;}
 synchronized String begin(long startNs){if(active)throw new IllegalStateException("Capture already active");id="capture-"+startNs+"-"+UUID.randomUUID();sequence=0;active=true;return id;}
 synchronized boolean active(){return active;}
 synchronized void write(String json)throws IOException {if(!active)return;immutable(new File(root,id+"-"+(sequence++)+".json"),json);}
 synchronized void finish(String json,boolean completed)throws IOException {
  if(!active)return;
  write(json);File terminal=new File(root,id+"-terminal.json");immutable(terminal,json);active=false;
  if(completed){synchronized(CaptureJournal.class){try(RandomAccessFile lock=new RandomAccessFile(new File(root,"capture-publication.lock"),"rw");FileLock held=lock.getChannel().lock()){
   atomic(new File(root,"optical-latest-completed.json"),"{\"captureFile\":\""+terminal.getName()+"\",\"historical\":true}");
  }}}
 }
 void inventory(String json)throws IOException {atomic(new File(root,"optical-inventory.json"),json);}
 String historicalSummary(){File f=new File(root,"optical-latest-completed.json");try{return f.exists()?new String(Files.readAllBytes(f.toPath()),StandardCharsets.UTF_8):null;}catch(IOException e){return null;}}
 private static void immutable(File target,String data)throws IOException {Files.write(target.toPath(),data.getBytes(StandardCharsets.UTF_8),java.nio.file.StandardOpenOption.CREATE_NEW,java.nio.file.StandardOpenOption.WRITE);}
 private static void save(File target,String data)throws IOException {try(FileOutputStream out=new FileOutputStream(target,false)){out.write(data.getBytes(StandardCharsets.UTF_8));out.getFD().sync();}}
 static void atomic(File target,String data)throws IOException {File temp=File.createTempFile("optical-", ".tmp",target.getParentFile());try{save(temp,data);if(!temp.renameTo(target))throw new IOException("Atomic receipt rename failed");}finally{temp.delete();}}
}
