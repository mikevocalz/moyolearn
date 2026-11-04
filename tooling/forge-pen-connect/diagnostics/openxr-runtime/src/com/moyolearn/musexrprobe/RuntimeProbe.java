package com.moyolearn.musexrprobe;
import android.app.Instrumentation;
import android.os.Bundle;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
public final class RuntimeProbe extends Instrumentation {
 static { System.loadLibrary("musexrprobe"); }
 private static native String enumerate(android.content.Context context);
 @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }
 @Override public void onStart() {
  Bundle receipt=new Bundle();
  try {
   String json=enumerate(getTargetContext());
   File file=new File(getTargetContext().getFilesDir(),"runtime-extensions.json");
   try(FileOutputStream out=new FileOutputStream(file)){out.write(json.getBytes(StandardCharsets.UTF_8));}
   receipt.putString("runtimeExtensions",json);finish(0,receipt);
  } catch(Throwable e){receipt.putString("error",e.toString());finish(1,receipt);}
 }
}
