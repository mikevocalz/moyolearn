const pin = require('../../../vendors/viro-renderer-82ad61e74.provenance.json');
const rendererPath = `../../../vendors/${pin.file}`;
const rendererSha256 = pin.aar_sha256;
/** Refresh only the unique renderer owner and its immediately associated digest guard. */
function updateRendererPin(contents) {
  const owners = [...contents.matchAll(/ext\.moyoViroRendererAar = rootProject\.file\('[^']+'\)/g)];
  if (owners.length !== 1) throw new Error('Missing or duplicate renderer pin owner');
  const owner = owners[0];
  const tail = contents.slice(owner.index + owner[0].length);
  const stream = tail.match(/moyoViroRendererAar\.withInputStream\s*\{[\s\S]*?^\}/m);
  if (!stream) throw new Error('Missing renderer-owned input stream');
  const end = stream.index + stream[0].length;
  const afterStream = tail.slice(end);
  const guard = /^(\s*if \(rendererDigest\.digest\(\)\.encodeHex\(\)\.toString\(\) != ')[a-f0-9]{64}('\))/;
  if (!guard.test(afterStream)) throw new Error('Missing renderer-owned checksum guard');
  return contents.slice(0, owner.index)
    + `ext.moyoViroRendererAar = rootProject.file('${rendererPath}')`
    + tail.slice(0, end)
    + afterStream.replace(guard, (_, prefix, suffix) => prefix + rendererSha256 + suffix);
}
module.exports = { updateRendererPin, rendererPath, rendererSha256 };
