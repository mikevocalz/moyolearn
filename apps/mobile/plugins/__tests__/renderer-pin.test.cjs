const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {updateRendererPin,rendererPath,rendererSha256}=require('../renderer-pin');
const root=path.resolve(__dirname,'../../../..');
const oldHash='0'.repeat(64);
const owned=`ext.moyoViroRendererAar = rootProject.file('../../../vendors/old.aar')
moyoViroRendererAar.withInputStream { stream ->
  rendererDigest.update(stream.readAllBytes())
}
if (rendererDigest.digest().encodeHex().toString() != '${oldHash}') { throw new GradleException('checksum') }`;
test('existing generated renderer pin refreshes without rewriting surrounding configuration',()=>{
 const source='before\n'+owned+'\nafter';
 const updated=updateRendererPin(source);
 assert.ok(updated.includes(rendererPath));assert.ok(updated.includes(rendererSha256));
 assert.ok(updated.startsWith('before\n'));assert.ok(updated.endsWith('\nafter'));
 assert.equal(updateRendererPin(updated),updated);
 assert.throws(()=>updateRendererPin('unrelated build config'),/renderer pin owner/);
});
test('foreign digest guards before and after the owned block remain byte-identical',()=>{
 const foreign=`if (rendererDigest.digest().encodeHex().toString() != '${'a'.repeat(64)}') { throw new GradleException('foreign guard') }`;
 const updated=updateRendererPin(foreign+'\n'+owned+'\n'+foreign);
 assert.ok(updated.startsWith(foreign+'\n'));assert.ok(updated.endsWith('\n'+foreign));
 assert.equal(updated.split(rendererSha256).length-1,1);
 assert.equal(updated.includes(oldHash),false);
 assert.throws(()=>updateRendererPin(owned+'\n'+owned),/duplicate renderer pin owner/);
 assert.throws(()=>updateRendererPin(owned.replace('moyoViroRendererAar.withInputStream','foreign.withInputStream')),/renderer-owned input stream/);
});
test('renderer provenance checksum matches exact candidate archive and retains baseline proof',()=>{
 const pin=require(path.join(root,'vendors/viro-renderer-82ad61e74.provenance.json'));
 const sha=(p)=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'vendors',p))).digest('hex');
 assert.equal(sha(pin.file),rendererSha256);assert.equal(sha(pin.baseline_file),pin.original_aar_sha256);
 assert.deepEqual(pin.changed_members,['jni/arm64-v8a/libviro_renderer.so']);
 assert.equal(pin.source_commit,'82ad61e74549073a9dc8ba95ede70f0f854889fc');
 assert.equal(pin.source_baseline,'73c6a923fb63b71a1059fd241cf347e15898fd2d');
 assert.equal(pin.defined_symbols_before,pin.defined_symbols_after);
 assert.deepEqual(pin.missing_jni_symbols,[]);assert.deepEqual(pin.missing_strong_symbols,[]);assert.deepEqual(pin.new_undefined_symbols,[]);
 assert.deepEqual(pin.needed_before,pin.needed_after);assert.ok(pin.load_alignments.every(n=>n>=16384));
});
