#!/usr/bin/env node
// Build reviewed private source artifacts; generated bindings must match the host.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pins = { 'bluetooth-v1': 'c213f1ca3f1d604a27ccf922362f0de3e4605831', 'pen-connect': 'c213f1ca3f1d604a27ccf922362f0de3e4605831' };
const nitro = '1.0.0-alpha.nightly.100.g107f6fc66597';
const temporary = mkdtempSync(join(tmpdir(), 'moyo-forge-vendor-'));
const run = (cmd, args, cwd = temporary) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
const repository = process.argv[2] ? resolve(process.argv[2]) : join(temporary, 'source');
if (!process.argv[2]) run('git', ['clone', '--no-checkout', 'git@github.com:mikevocalz/nitro-forge.git', repository]);
const provenance = {};
mkdirSync(join(root, 'vendors'), { recursive: true });
if (process.argv.includes('--bluetooth-only') && process.argv.includes('--pen-connect-only')) throw new Error('Select only one artifact mode');
for (const name of Object.keys(pins).filter((name) =>
  (!process.argv.includes('--bluetooth-only') || name === 'bluetooth-v1') &&
  (!process.argv.includes('--pen-connect-only') || name === 'pen-connect'))) {
  const commit = execFileSync('git', ['rev-parse', `${pins[name]}^{commit}`], { cwd: repository, encoding: 'utf8' }).trim();
  const archive = execFileSync('git', ['archive', commit, `packages/${name}`], { cwd: repository, maxBuffer: 20 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', temporary], { input: archive });
  const directory = join(temporary, 'packages', name);
  const manifestPath = join(directory, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.version = name === 'bluetooth-v1' ? '0.1.0-moyo.15' : '0.1.0-moyo.10';
  manifest.moyoSource = { repository: 'mikevocalz/nitro-forge', commit };
  if (name === 'pen-connect') {
    const path = join(directory, 'src/android-ble.native.ts');
    let source = readFileSync(path, 'utf8');
    source = source.replace('  let cancelPending:', '  let scanGeneration = 0;\n  let cancelPending:');
    source = source.replace('      native.startScan();', '      const generation = ++scanGeneration;\n      native.startScan();');
    source = source.replace('      } finally {\n        native.stopScan();', '      } finally {\n        if (generation === scanGeneration) native.stopScan();');
    source = source.replace('    cancelScan() {\n      cancelPending?.();', '    cancelScan() {\n      ++scanGeneration;\n      cancelPending?.();');
    source = source.replace('  let scanGeneration = 0;', '  let scanGeneration = 0;\n  let connectionGeneration = 0;\n  let pendingConnection: number | undefined;');
    source = source.replace('      ++scanGeneration;\n      cancelPending?.();', '      ++scanGeneration;\n      if (pendingConnection !== undefined) {\n        pendingConnection = undefined;\n        ++connectionGeneration;\n        native.disconnect();\n      }\n      cancelPending?.();');
    source = source.replace('      if (!(await native.connect(id))) throw new Error("Bluetooth GATT connection failed.");', '      const generation = ++connectionGeneration;\n      pendingConnection = generation;\n      try {\n        if (!(await native.connect(id))) throw new Error("Bluetooth GATT connection failed.");\n        if (generation !== connectionGeneration) throw new Error("Bluetooth connection cancelled.");\n      } finally {\n        if (pendingConnection === generation) pendingConnection = undefined;\n      }');
    source = source.replace('            id: d.id, name: d.name,', '            id: d.id, name: d.name,\n            ...(typeof d.bonded === "boolean" ? { bonded: d.bonded } : {}),');
    const typesPath = join(directory, 'src/types.ts');
    writeFileSync(typesPath, readFileSync(typesPath, 'utf8').replace('  readonly rssi?: number;', '  readonly rssi?: number;\n  readonly bonded?: boolean;'));
    writeFileSync(path, source);
    for (const file of ['types.ts', 'android-ble.native.ts', 'controller.ts', 'PenConnectionDialog.native.tsx']) {
      writeFileSync(join(directory, 'src', file), readFileSync(join(root, 'tooling/forge-pen-connect/portable/src', file)));
    }
  }
  if (name === 'bluetooth-v1') {
    // The transport is Android-only; regenerate against the host runtime.
    // Codegen at the host's exact v1 pin prevents two incompatible runtimes.
    for (const field of ['peerDependencies', 'devDependencies']) {
      for (const dependency of ['nitro-core', 'react-native-nitro-modules', 'nitrogen']) {
        if (manifest[field]?.[dependency]) manifest[field][dependency] = nitro;
      }
    }
    for (const file of readdirSync(join(root, 'tooling/forge-pen-connect')).filter((file) => file.endsWith('.kt'))) {
      writeFileSync(join(directory, 'android/src/main/java/com/margelo/nitro/forgebluetooth/ble', file), readFileSync(join(root, 'tooling/forge-pen-connect', file)));
    }
    const manifestXml = join(directory, 'android/src/main/AndroidManifest.xml');
    writeFileSync(manifestXml, readFileSync(manifestXml, 'utf8').replace('<manifest xmlns:android="http://schemas.android.com/apk/res/android">', '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n  <uses-feature android:name="android.software.companion_device_setup" android:required="false" />'));
    const testDirectory = join(directory, 'android/src/test/java/com/margelo/nitro/forgebluetooth/ble');
    mkdirSync(testDirectory, { recursive: true });
    for (const file of readdirSync(join(root, 'tooling/forge-pen-connect/tests'))) {
      writeFileSync(join(testDirectory, file), readFileSync(join(root, 'tooling/forge-pen-connect/tests', file)));
    }
    const specPath = join(directory, 'src/specs/ForgeBluetooth.nitro.ts');
    const spec = readFileSync(specPath, 'utf8').replace('export declare class ForgeBluetooth extends HybridObject {', 'export declare class ForgeBluetooth extends HybridObject {\n  constructor();');
    const diagnosticSpec = spec.replace('  isConnected(): boolean;', `  isConnected(): boolean;
  /** Actual discovered attributes only; no vendor protocol or input decoding. */
  discoverGattServices(): Promise<string>;
  readGattCharacteristic(characteristicKey: string): Promise<string>;
  /** Explicit documented ASA 1.1 host session negotiation, after current version READ. */
  configureSpatialAccessoryHost(): Promise<string>;
  readGattDescriptor(descriptorKey: string): Promise<string>;
  setGattNotification(characteristicKey: string, enabled: boolean): Promise<string>;
  getGattDiagnosticsJson(): string;
  stopGattDiagnostics(): void;
  /** Explicit OS pairing of this selected device; resolves only actual BONDED. */
  requestBond(): Promise<string>;
  isSystemChooserAvailable(): boolean;
  chooseMuseWithSystem(): Promise<string>;
  cancelSystemChooser(): void;
  listAssociatedMuseDevices(): Promise<string>;`);
    writeFileSync(specPath, diagnosticSpec);
    delete manifest.type; // RN CLI loads react-native.config.js as CommonJS.
    // PR20 has no Android Gradle entry; retain this explicit consumer adaptation.
    writeFileSync(join(directory, 'android', 'build.gradle'), readFileSync(join(root, 'tooling/forge-pen-connect/build.gradle')));
    writeFileSync(join(directory, 'react-native.config.js'), `module.exports = { dependency: { platforms: { android: { sourceDir: './android', packageImportPath: 'import com.margelo.nitro.forgebluetooth.ForgeBluetoothPackage;', packageInstance: 'new ForgeBluetoothPackage()', libraryName: null, cmakeListsPath: null }, ios: null } } };\n`);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
    run('pnpm', [`--package=nitrogen@${nitro}`, 'dlx', 'nitrogen'], directory);
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  delete manifest.devDependencies;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  run('pnpm', ['pack', '--pack-destination', join(root, 'vendors')], directory);
  const file = `nitro-forge-${name}-${manifest.version}.tgz`;
  provenance[name] = { ...manifest.moyoSource, file, sha256: createHash('sha256').update(readFileSync(join(root, 'vendors', file))).digest('hex'), ...(name === 'bluetooth-v1' ? { nitrogen: nitro, runtime: nitro, android: 'BLE GATT diagnostics with explicit documented ASA host negotiation; Muse input unverified' } : {}) };
}
const lockPath = join(root, 'vendors', 'forge-source-lock.json');
writeFileSync(lockPath, `${JSON.stringify({ ...JSON.parse(readFileSync(lockPath, 'utf8')), ...provenance }, null, 2)}\n`);
