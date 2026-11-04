import { createHash } from 'node:crypto';

export const COLLECTOR_APK_SHA256 = '753d9214a51cad2daeed4b90e21447564178e777fd97cc0fb15767c7283a54d3';
export const REPORT_MAP_SHA256 = '4708e62215883a297c88be41600d2ddea20345ecfbe41213db47f7d6778b3405';
export const REPORT_REFERENCE_HEX = '0201';
export const CAPTURE_PACKAGE = 'com.moyolearn.museprobe';
export const CAPTURE_FILE = 'files/muse-hid-live-read-test-only.json';
export const CAPABILITY = 'external-test-telemetry';
const integer = (value, name, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
};
function bytes(value, length, name) {
  if (typeof value !== 'string' || value.length !== length * 2 || !/^[0-9a-f]+$/i.test(value)) throw new Error(`Invalid ${name} bytes`);
  return Buffer.from(value, 'hex');
}
function observation(value, length, name) {
  if (!value || value.gattStatus !== 0 || value.byteLength !== length) throw new Error(`Unsuccessful or wrong-length ${name}`);
  return bytes(value.rawHex, length, name);
}

/** Validate actual collector data before any forwarding. No pressure/pose decoding. */
export function validateCapture(capture, armTime, deviceNow) {
  if (!capture || capture.schemaVersion !== 1 || capture.testOnly !== true || capture.productionAccess !== false ||
      capture.inputProducer !== false || capture.package !== CAPTURE_PACKAGE) throw new Error('Collector provenance mismatch');
  integer(capture.wallTimeMs, 'collector start');
  if (capture.wallTimeMs < armTime) return { kind: 'waiting' };
  if (capture.error || capture.completed === false) throw new Error('Collector ended with an error; inspect its original receipt');
  if (capture.pollingReady !== true) return { kind: 'waiting' };
  if (capture.connectionStatus !== 0 || capture.discoveryStatus !== 0 || capture.matchingBondedDeviceCount !== 1 || capture.bondState !== 12) throw new Error('Collector connection/bond evidence mismatch');
  const start = integer(capture.pollingStartWallTimeMs, 'polling start');
  if (start < armTime) return { kind: 'waiting' };
  integer(capture.plannedPollingWindowMs, 'polling duration', 1, 25000);
  if (capture.maxSamples !== 100 || capture.maxRateHz !== 4) throw new Error('Collector sampling bounds mismatch');
  if (!Array.isArray(capture.reportMaps) || capture.reportMaps.length !== 1) throw new Error('Require one actual Report Map');
  const map = capture.reportMaps[0];
  if (createHash('sha256').update(observation(map, 457, 'Report Map')).digest('hex') !== REPORT_MAP_SHA256) throw new Error('Report Map hash mismatch');
  if (!Array.isArray(capture.reportReferences) || capture.reportReferences.length > 32) throw new Error('Invalid report reference list');
  for (const ref of capture.reportReferences) observation(ref, 2, 'Report Reference');
  for (const expected of [REPORT_REFERENCE_HEX, '0203']) {
    const selected = capture.reportReferences.filter((ref) => ref.rawHex.toLowerCase() === expected);
    if (selected.length !== 1 || selected[0].serviceInstanceId !== map.serviceInstanceId) throw new Error('Ambiguous or unrelated Report Reference');
  }
  observation(capture.feature2, 8, 'feature2');
  if (!Array.isArray(capture.samples) || capture.samples.length > 100) throw new Error('Invalid sample list');
  let previous = -1;
  const samples = capture.samples.map((sample) => {
    const sequence = integer(sample.sampleIndex, 'sample sequence', 0, 99);
    if (sequence <= previous) throw new Error('Reordered or duplicate source samples');
    previous = sequence;
    observation(sample, 65, 'input2');
    const wallTimeMs = integer(sample.wallTimeMs, 'sample timestamp');
    const elapsedPollingMs = integer(sample.elapsedPollingMs, 'sample elapsed time', 0, 40000);
    if (Math.abs(wallTimeMs - start - elapsedPollingMs) > 250 || wallTimeMs > deviceNow + 2000) throw new Error('Inconsistent/future sample time');
    return { sequence, gattStatus: 0, byteLength: 65, rawHex: sample.rawHex.toLowerCase(), wallTimeMs, elapsedPollingMs };
  });
  return { kind: 'capture', capture, samples, start };
}

export function sessionMetadata(capture, sessionId, armTime, deviceNow) {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(sessionId)) throw new Error('Invalid session nonce');
  if (capture.completed === true) throw new Error('Completed captures cannot start a LIVE session');
  const startedAtWallTimeMs = capture.pollingStartWallTimeMs;
  if (capture.wallTimeMs < armTime || startedAtWallTimeMs < armTime) throw new Error('Capture predates arming');
  if (deviceNow - startedAtWallTimeMs > 3000 || startedAtWallTimeMs > deviceNow + 2000) throw new Error('First snapshot is not fresh enough for LIVE');
  const expiresAtWallTimeMs = Math.min(startedAtWallTimeMs + 40000, capture.wallTimeMs + 40000);
  if (expiresAtWallTimeMs <= deviceNow) throw new Error('Capture window already expired');
  return { schemaVersion: 1, sessionId, collectorApkSha256: COLLECTOR_APK_SHA256, reportMapSha256: REPORT_MAP_SHA256,
    reportReferenceHex: REPORT_REFERENCE_HEX, startedAtWallTimeMs, expiresAtWallTimeMs, maxSamples: 100, capability: CAPABILITY };
}

/** Source snapshots are cumulative; count stale/absent samples only once. */
export function freshEnvelope(validated, session, cursor, deviceNow) {
  const next = { ...cursor };
  const samples = [];
  for (const sample of validated.samples) {
    if (sample.sequence <= next.lastObservedSequence) continue;
    next.gapCount += sample.sequence - next.lastObservedSequence - 1;
    next.lastObservedSequence = sample.sequence;
    if (deviceNow - sample.wallTimeMs > 3000 || sample.wallTimeMs >= session.expiresAtWallTimeMs) next.gapCount++;
    else samples.push(sample);
  }
  if (next.gapCount > 100) throw new Error('Sample gap limit exceeded');
  return { cursor: next, envelope: { schemaVersion: 1, sessionId: session.sessionId, collectorApkSha256: COLLECTOR_APK_SHA256,
    reportMapSha256: REPORT_MAP_SHA256, reportReferenceHex: REPORT_REFERENCE_HEX, gapCount: next.gapCount, samples } };
}

/** Locator is trusted operator code; all device-derived values are serialized data. */
export function evaluationExpression(locator, method, payload) {
  if (typeof locator !== 'string' || !locator.trim() || locator.length > 12000) throw new Error('Provide a trusted controller expression');
  if (!['probe', 'startSession', 'ingestCapture', 'finishSession'].includes(method)) throw new Error('Forbidden bridge method');
  const sanitizedState = `const readViewer=()=>{const s=c.state.getState();const v=s.values;const n=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max?x:null;return {phase:["live","completed","unavailable"].includes(s.phase)?s.phase:null,samples:n(s.samples,0,100),lastSequence:n(s.lastSequence,-1,99),missingSequences:n(s.missingSequences,0,100),values:v?{tip:n(v.tip,0,100),tipForce:n(v.tipForce,0,100),roundHeld:typeof v.roundHeld==="boolean"?v.roundHeld:null,oval:n(v.oval,0,100),ovalForce:n(v.ovalForce,0,100)}:null};};`;
  const operation = method === 'probe' ? 'return {ready:true,now:Date.now(),viewer:readViewer()};'
    : `const accepted=c.${method}(${JSON.stringify(payload)});return {accepted:${method === 'finishSession' ? 'accepted!==false' : 'accepted===true'},now:Date.now(),viewer:readViewer()};`;
  return `(()=>{const c=(${locator});if(!c||typeof c.startSession!=="function"||typeof c.ingestCapture!=="function"||typeof c.finishSession!=="function"||typeof c.state?.getState!=="function")throw new Error("DEV telemetry controller unavailable");${sanitizedState}${operation}})()`;
}
