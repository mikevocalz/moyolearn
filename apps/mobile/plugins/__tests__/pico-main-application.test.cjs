// SOT: ../pico-main-application.js
// SOT-KEYWORDS: pico kotlin feature flag prebuild repeat regression
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { repairPicoMainApplication, PICO_FLAG_GUARD } = require('../pico-main-application');
const committed = readFileSync(join(__dirname, '../../android/app/src/main/java/com/moyolearn/app/MainApplication.kt'), 'utf8');

test('repairs only the installed PICO rewriter residue and keeps the canonical flag override', () => {
  const residue = PICO_FLAG_GUARD.slice(PICO_FLAG_GUARD.indexOf('        object :'));
  for (const repeats of [0, 1, 3]) {
    const generated = committed.replace(PICO_FLAG_GUARD, PICO_FLAG_GUARD + ('\n' + residue).repeat(repeats));
    assert.equal(repairPicoMainApplication(generated), committed);
  }
});

test('fails closed if PICO feature-flag ownership or residue changes', () => {
  for (const contents of [
    committed.replace(PICO_FLAG_GUARD, ''), committed + '\n' + PICO_FLAG_GUARD,
    committed.replace('skipActivityIdentityAssertionOnHostPause(): Boolean = true', 'skipActivityIdentityAssertionOnHostPause(): Boolean = false'),
    committed + '\nobject : ReactNativeNewArchitectureFeatureFlagsDefaults() {}',
  ]) assert.throws(() => repairPicoMainApplication(contents), /PICO MainApplication/);
});
