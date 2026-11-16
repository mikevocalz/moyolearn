/**
 * Keep PICO account/payment services out of ordinary-mobile and Quest builds.
 * The vendored PICO plugin generates these as global implementation entries;
 * its transitive core service requires API 28, above the phone's API 26 floor.
 * Repair its owned block after prebuild without changing SDK versions or
 * forcing Android to accept a library on an unsupported OS.
 * SOT: docs/decisions/adr-118-pico-build-contract.md
 * SOT-KEYWORDS: pico pps gradle dependency scope flavor mobile minSdk prebuild
 */
const START = '// expo-pico-core: PICO Platform Service SDK (com.pico.pps:*) deps';
const END = '// expo-pico-core: auto-include app/libs/*.aar (PICO Platform SDK)';

function scopePicoPlatformDependencies(contents) {
  const start = contents.indexOf(START);
  const end = contents.indexOf(END, start + START.length);
  if (start < 0 || end < 0 || contents.indexOf(START, start + START.length) !== -1) {
    throw new Error('PICO Platform Service dependency owner is missing, duplicated, or changed');
  }
  const block = contents.slice(start, end);
  let declarations = 0;
  const scoped = block.replace(
    /^([ \t]*)(?:implementation|picoImplementation)([ \t]+["']com\.pico\.pps:[^"'\r\n]+["'][ \t]*)$/gm,
    (_line, indent, coordinate) => {
      declarations += 1;
      return `${indent}picoImplementation${coordinate}`;
    },
  );
  const unrecognized = scoped.split('\n').some((line) =>
    !line.trimStart().startsWith('//') && line.includes('com.pico.pps:')
      && !/^\s*picoImplementation\s+["']com\.pico\.pps:[^"']+["']\s*$/.test(line),
  );
  if (!declarations || unrecognized) {
    throw new Error('PICO Platform Service dependency declarations changed; review their flavor scope');
  }
  return contents.slice(0, start) + scoped + contents.slice(end);
}

module.exports = { scopePicoPlatformDependencies };
