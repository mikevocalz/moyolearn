"""Compile actual Java/OpenCV synthetic fixture only. Never invokes a device or camera."""
from pathlib import Path
import hashlib,json,subprocess,tempfile,zipfile
root=Path(__file__).resolve().parents[1];sdk=Path('/Users/mikevocalz/Library/Android/sdk');java=Path('/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home/bin');cv=Path('/tmp/moyo-optical-opencv-4.12.0');out=Path(tempfile.mkdtemp(prefix='moyo-unmodified-tracker-fixture-',dir='/tmp'));classes=out/'classes';classes.mkdir();dex=out/'dex';dex.mkdir()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(cv/'opencv-4.12.0.aar')=='f71846a313388d9da667a59be1e921669fcf792d1ba264b3898253ca789bc3f0','Reviewed existing OpenCV AAR mismatch; no download attempted'
sources=[root/'src/com/moyolearn/museopticalprobe'/f'{name}.java' for name in ['OpenCvNative','UnmodifiedPointTracker','UnmodifiedPointTrackerFixture']]
commands=[]
with (out/'build.log').open('w') as log:
 command=[str(java/'javac'),'--release','8','-cp',str(cv/'classes.jar'),'-d',str(classes),*map(str,sources)];commands.append(command);subprocess.run(command,stdout=log,stderr=log,check=True)
 compiled=sorted(classes.rglob('*.class'))
 assert any(p.name=='UnmodifiedPointTrackerFixture.class' for p in compiled),'Missing compiled fixture entry'
 command=[str(sdk/'build-tools/36.0.0/d8'),'--min-api','29','--lib',str(sdk/'platforms/android-36/android.jar'),'--output',str(dex),*map(str,compiled),str(cv/'classes.jar')];commands.append(command);subprocess.run(command,stdout=log,stderr=log,check=True)
assert b'Lcom/moyolearn/museopticalprobe/UnmodifiedPointTrackerFixture;' in (dex/'classes.dex').read_bytes(),'Fixture entry absent from DEX'
files=[dex/'classes.dex',cv/'jni/arm64-v8a/libc++_shared.so',cv/'jni/arm64-v8a/libopencv_java4.so']
receipt={'scope':'Compiled SYNTHETIC Java/OpenCV fixture. Not yet executed; not live pen/identity/depth/pose evidence.','outputDirectory':str(out),'entryClass':'com.moyolearn.museopticalprobe.UnmodifiedPointTrackerFixture','requiresOwnedNativeDirectoryArgument':'/data/local/tmp/moyo-optical-compute-<8..64 lowercase hex>','deviceActionsPerformed':False,'sourceHashes':{str(p):sha(p) for p in sources},'artifacts':{str(p):sha(p) for p in files},'commands':commands,'opencvVersion':'4.12.0'}
(out/'receipt.json').write_text(json.dumps(receipt,indent=2));print(out/'receipt.json')
