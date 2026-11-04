package com.moyolearn.museopticalprobe;
import java.io.*;import java.nio.file.*;
public final class CaptureJournalTest {
 public static void main(String[] args)throws Exception {
  File dir=Files.createTempDirectory("optical-journal-test").toFile();CaptureJournal a=new CaptureJournal(dir);
  a.finish("idle",true);if(dir.list().length!=0)throw new AssertionError("Idle stop wrote receipt");
  String first=a.begin(123);a.write("frame");a.finish("completed",true);String pointer=a.historicalSummary();
  CaptureJournal recreated=new CaptureJournal(dir);recreated.finish("backgrounded",false);recreated.inventory("inventory");
  if(!pointer.equals(recreated.historicalSummary()))throw new AssertionError("Recreation overwrote completed");
  String second=recreated.begin(123);if(first.equals(second))throw new AssertionError("Capture identity reused");
  recreated.write("new-opening");recreated.finish("backgrounded",false);
  if(!pointer.equals(recreated.historicalSummary()))throw new AssertionError("Incomplete replaced completed");
  if(!new String(Files.readAllBytes(new File(dir,first+"-terminal.json").toPath())).equals("completed"))throw new AssertionError("Terminal changed");
  System.out.println("CaptureJournalTest PASS");
 }
}
