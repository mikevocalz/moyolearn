#!/usr/bin/env python3
"""Build isolated test APK locally. No install/run/adoption; signing material stays outside source."""
import argparse, hashlib, json, os, pathlib, shutil, subprocess, zipfile
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--sdk',default=os.path.expanduser('~/Library/Android/sdk'));p.add_argument('--keystore');p.add_argument('--alias');args=p.parse_args()
root=pathlib.Path(__file__).resolve().parent;out=pathlib.Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
java=pathlib.Path(os.environ.get('JAVA_HOME','/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home'))/'bin';sdk=pathlib.Path(args.sdk);tools=sdk/'build-tools/35.0.0';android=sdk/'platforms/android-36/android.jar'
# Only these build-owned subdirectories are replaced. Keys and receipts are not build outputs.
for name in ['classes','tests','dex']:
 d=out/name
 if d.exists():shutil.rmtree(d)
 d.mkdir()
def run(cmd):subprocess.run([str(c) for c in cmd],check=True)
sources=sorted((root/'src').rglob('*.java'));tests=sorted((root/'tests').rglob('*.java'))
run([java/'javac','--release','8','-cp',android,'-d',out/'classes',*sources]);run([java/'javac','--release','8','-cp',out/'classes','-d',out/'tests',root/'src/com/moyolearn/blereference/ScanPolicy.java',*tests]);run([java/'java','-cp',out/'tests','com.moyolearn.blereference.ScanPolicyTest'])
run([tools/'d8','--min-api','33','--lib',android,'--output',out/'dex',*sorted((out/'classes').rglob('*.class'))]);run([tools/'aapt2','link','-I',android,'--manifest',root/'AndroidManifest.xml','-o',out/'unsigned.apk'])
with zipfile.ZipFile(out/'unsigned.apk','a')as z:z.write(out/'dex/classes.dex','classes.dex')
run([tools/'zipalign','-f','4',out/'unsigned.apk',out/'aligned.apk'])
artifact=out/'aligned.apk'
if args.keystore:
 if not args.alias or 'BLE_REFERENCE_KEYSTORE_PASSWORD' not in os.environ:raise SystemExit('Signing requires explicit alias and BLE_REFERENCE_KEYSTORE_PASSWORD environment variable')
 artifact=out/'ble-reference.apk';run([tools/'apksigner','sign','--ks',pathlib.Path(args.keystore).resolve(),'--ks-key-alias',args.alias,'--ks-pass','env:BLE_REFERENCE_KEYSTORE_PASSWORD','--out',artifact,out/'aligned.apk']);run([tools/'apksigner','verify',artifact])
receipt={'scope':'Build only; no device actions','signed':bool(args.keystore),'artifact':artifact.name,'sha256':hashlib.sha256(artifact.read_bytes()).hexdigest(),'sources':{str(f.relative_to(root)):hashlib.sha256(f.read_bytes()).hexdigest()for f in [root/'AndroidManifest.xml',*sources,*tests]}}
(out/'build-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'artifact':str(artifact),'signed':receipt['signed'],'sha256':receipt['sha256']}))
