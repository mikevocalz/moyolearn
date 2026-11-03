"""Build isolated Camera2 diagnostic; no dependency install, Moyo edit, or device action."""
from pathlib import Path
import subprocess, tempfile, zipfile, hashlib, json, shutil
root=Path(__file__).resolve().parent
out=Path('/tmp/moyo-optical-camera-build');out.mkdir(exist_ok=True)
sdk=Path('/Users/mikevocalz/Library/Android/sdk');bt=sdk/'build-tools/36.0.0';java=Path('/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home/bin')
def run(*args):subprocess.run([str(a) for a in args],check=True)
for n in ['classes','tests','dex']:
 if (out/n).exists():shutil.rmtree(out/n)
 (out/n).mkdir()  # Owned compile products only; preserve diagnostic signing key and receipts.
cv=Path('/tmp/moyo-optical-opencv-4.12.0');cv.mkdir(exist_ok=True);aar=cv/'opencv-4.12.0.aar'
expected='f71846a313388d9da667a59be1e921669fcf792d1ba264b3898253ca789bc3f0'
if not aar.exists():run('curl','-L','--fail','--max-time','120','https://repo.maven.apache.org/maven2/org/opencv/opencv/4.12.0/opencv-4.12.0.aar','-o',aar)
if hashlib.sha256(aar.read_bytes()).hexdigest()!=expected:raise RuntimeError('Pinned OpenCV AAR integrity failure')
with zipfile.ZipFile(aar) as z:
 for name in ['classes.jar','jni/arm64-v8a/libopencv_java4.so','jni/arm64-v8a/libc++_shared.so']:z.extract(name,cv)
cvjar=cv/'classes.jar' 
blob=root/'src/com/moyolearn/museopticalprobe/BrightBlobDetector.java'
run(java/'javac','--release','8','-Xlint:-options','-d',out/'tests',blob,root/'src/com/moyolearn/museopticalprobe/CameraCalibration.java',root/'src/com/moyolearn/museopticalprobe/FrameFreshness.java',*sorted((root/'tests').rglob('*.java')))
run(java/'java','-cp',out/'tests','com.moyolearn.museopticalprobe.BrightBlobDetectorTest')
run(java/'java','-cp',out/'tests','com.moyolearn.museopticalprobe.CameraCalibrationTest')
run(java/'java','-cp',out/'tests','com.moyolearn.museopticalprobe.FrameFreshnessTest')
run(java/'javac','--release','8','-Xlint:-options','-cp',str(sdk/'platforms/android-36/android.jar')+':'+str(cvjar),'-d',out/'classes',*sorted((root/'src').rglob('*.java')))
run(bt/'d8','--min-api','29','--lib',sdk/'platforms/android-36/android.jar','--output',out/'dex',*sorted((out/'classes').rglob('*.class')),cvjar)
run(bt/'aapt2','link','-I',sdk/'platforms/android-36/android.jar','--manifest',root/'AndroidManifest.xml','-o',out/'unsigned.apk')
with zipfile.ZipFile(out/'unsigned.apk','a') as z:
 z.write(out/'dex/classes.dex','classes.dex')
 for name in ['libopencv_java4.so','libc++_shared.so']:z.write(cv/'jni/arm64-v8a'/name,'lib/arm64-v8a/'+name)
run(bt/'zipalign','-f','4',out/'unsigned.apk',out/'aligned.apk')
key=out/'local-diagnostic.jks'
if not key.exists():run(java/'keytool','-genkeypair','-keystore',key,'-alias','diagnostic','-storepass','android','-keypass','android','-dname','CN=Moyo Optical Diagnostic Only','-keyalg','RSA','-validity','365')
apk=out/'muse-optical-camera.apk'
run(bt/'apksigner','sign','--ks',key,'--ks-key-alias','diagnostic','--ks-pass','pass:android','--key-pass','pass:android','--out',apk,out/'aligned.apk')
run(bt/'apksigner','verify',apk)
files=[root/'AndroidManifest.xml',root/'build.py',*sorted((root/'src').rglob('*.java')),*sorted((root/'tests').rglob('*.java')),apk]
receipt={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files};receipt['OpenCV Maven AAR4.12.0']=expected;(out/'sha256.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'apk':str(apk),'sha256':receipt[str(apk)],'tests':'PASS'},indent=2))

compute=[out/'dex/classes.dex',cv/'jni/arm64-v8a/libc++_shared.so',cv/'jni/arm64-v8a/libopencv_java4.so']
compute_hashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in compute}
(out/'compute-fixture-receipt.json').write_text(json.dumps({'files':compute_hashes,'deviceFixtureDirectory':'/data/local/tmp/moyo-optical-compute-'+compute_hashes[str(compute[0])][:12],'entrypoint':'com.moyolearn.museopticalprobe.OpticalComputeFixture','executedOnDevice':False},indent=2)+'\n')
