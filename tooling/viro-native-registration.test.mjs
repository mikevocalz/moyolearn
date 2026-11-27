// Compile and execute the exact generated Kotlin guard across process ABI and
// library-resolution cases. This is a registration contract, not a device pass.
// SOT: apps/mobile/plugins/viro-native-registration.js
// SOT-KEYWORDS: viro native registration kotlin process abi capability regression
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { VIRO_NATIVE_REGISTRATION } = require('../apps/mobile/plugins/viro-native-registration');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('the actual Kotlin guard omits only unsupported mobile x86 and keeps ARM, headset and unknown failures visible', (t) => {
  const fixture = mkdtempSync(join(tmpdir(), 'moyo-viro-kotlin-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  writeFileSync(join(fixture, 'settings.gradle'), "rootProject.name = 'moyo-viro-registration-contract'\n");
  writeFileSync(join(fixture, 'build.gradle'), "tasks.register('reportCompilerHome') { doLast { println('MOYO_GRADLE_HOME=' + gradle.gradleHomeDir) } }\n");
  const wrapper = process.env.MOYO_TEST_GRADLE || join(root, 'apps/mobile/android/gradlew');
  const invoke = (program, args, timeout = 180_000) => {
    const result = spawnSync(program, args, { encoding: 'utf8', timeout, maxBuffer: 1024 * 1024 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result.stdout;
  };
  const home = invoke('bash', [wrapper, '-p', fixture, 'reportCompilerHome', '--no-daemon', '--console=plain', '--quiet'])
    .match(/^MOYO_GRADLE_HOME=(.+)$/m)?.[1];
  assert.ok(home, 'use the reviewed wrapper distribution and its Kotlin compiler');
  const libs = join(home, 'lib');
  const stdlib = readdirSync(libs).find((name) => /^kotlin-stdlib-[\d.]+\.jar$/.test(name));
  assert.ok(stdlib);
  const loader = join(fixture, 'BaseDexClassLoader.kt');
  writeFileSync(loader, `package dalvik.system
open class BaseDexClassLoader(private val library: String?) : ClassLoader() {
  public override fun findLibrary(name: String): String? {
    check(name == "viro_renderer")
    return library
  }
}
`);
  const source = join(fixture, 'MainApplication.kt');
  writeFileSync(source, `package com.moyolearn.app
object BuildConfig { var FLAVOR = "mobile" }
data class ApplicationInfo(val nativeLibraryDir: String?)
class ReactViroPackage(val platform: ViroPlatform) {
  enum class ViroPlatform { AR, QUEST }
  companion object { var brokenRenderer = false }
  init { if (brokenRenderer) throw UnsatisfiedLinkError("renderer load failure remains visible") }
}
class MainApplication(val applicationInfo: ApplicationInfo, val classLoader: ClassLoader) {
  fun packages() = mutableListOf<ReactViroPackage>().apply {
${VIRO_NATIVE_REGISTRATION}
  }
}
fun main() {
  var checks = 0
  for (flavor in listOf("mobile", "quest", "pico")) {
    BuildConfig.FLAVOR = flavor
    for (abi in listOf("x86", "x86_64", "arm", "arm64", "unexpected")) {
      for (present in listOf(false, true)) {
        val app = MainApplication(ApplicationInfo("/data/app/test/lib/" + abi),
          dalvik.system.BaseDexClassLoader(if (present) "/data/app/base.apk!/lib/" + abi + "/libviro_renderer.so" else null))
        val expected = if (flavor == "mobile" && (abi == "x86" || abi == "x86_64") && !present) 0 else 2
        check(app.packages().size == expected) { "registration mismatch: " + flavor + "/" + abi + "/" + present }
        checks++
      }
    }
  }
  BuildConfig.FLAVOR = "mobile"
  for (directory in listOf(null, "/unknown-layout", "/data/app/test/lib/arm64")) {
    check(MainApplication(ApplicationInfo(directory), dalvik.system.BaseDexClassLoader(null)).packages().size == 2)
    checks++
  }
  check(MainApplication(ApplicationInfo("/data/app/test/lib/x86_64"), object : ClassLoader() {}).packages().size == 2)
  checks++
  ReactViroPackage.brokenRenderer = true
  for ((flavor, abi, library) in listOf(
    Triple("mobile", "arm64", null), Triple("mobile", "x86_64", "/present-but-broken.so"),
    Triple("quest", "x86_64", null), Triple("pico", "arm64", null))) {
    BuildConfig.FLAVOR = flavor
    try {
      MainApplication(ApplicationInfo("/data/app/test/lib/" + abi), dalvik.system.BaseDexClassLoader(library)).packages()
      error("renderer failure was hidden: " + flavor + "/" + abi)
    } catch (error: UnsatisfiedLinkError) { checks++ }
  }
  println("MOYO_VIRO_REGISTRATION_CHECKS=" + checks)
}
`);
  const output = join(fixture, 'classes'); mkdirSync(output);
  const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin/java') : 'java';
  invoke(java, ['-cp', join(libs, '*'), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect',
    '-classpath', join(libs, stdlib), '-d', output, loader, source]);
  const result = invoke(java, ['-cp', [output, join(libs, stdlib)].join(delimiter), 'com.moyolearn.app.MainApplicationKt'], 10_000);
  assert.match(result, /^MOYO_VIRO_REGISTRATION_CHECKS=38$/m);
});
