import { createStore } from 'zustand/vanilla';

export const MUSE_COLLECTOR_APK_SHA256 = '753d9214a51cad2daeed4b90e21447564178e777fd97cc0fb15767c7283a54d3';
export const MUSE_REPORT_MAP_SHA256 = '4708e62215883a297c88be41600d2ddea20345ecfbe41213db47f7d6778b3405';

/** Host-owned, finite test-reader session accepted by {@link createMuseTelemetryController}. */
export interface MuseTelemetrySession {
  schemaVersion: 1;
  sessionId: string;
  collectorApkSha256: string;
  reportMapSha256: string;
  reportReferenceHex: '0201';
  startedAtWallTimeMs: number;
  expiresAtWallTimeMs: number;
  maxSamples: 100;
  capability: 'external-test-telemetry';
}
interface Sample {
  sequence: number;
  gattStatus: number;
  byteLength: number;
  rawHex: string;
  wallTimeMs: number;
  elapsedPollingMs: number;
}
export interface MuseTelemetryCapture {
  schemaVersion: 1;
  sessionId: string;
  collectorApkSha256: string;
  reportMapSha256: string;
  reportReferenceHex: '0201';
  gapCount: number;
  samples: readonly Sample[];
}
export interface MuseTelemetryValues {
  tip: number;
  tipForce: number;
  roundHeld: boolean;
  oval: number;
  ovalForce: number;
}
interface TelemetryState {
  phase: 'unavailable' | 'live' | 'completed';
  reason: string;
  sessionId: string | null;
  samples: number;
  missingSequences: number;
  lastSequence: number;
  lastWallTimeMs: number | null;
  values: MuseTelemetryValues | null;
}
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const pinned = (v: Record<string, unknown>) => v.schemaVersion === 1 && v.collectorApkSha256 === MUSE_COLLECTOR_APK_SHA256 && v.reportMapSha256 === MUSE_REPORT_MAP_SHA256 && v.reportReferenceHex === '0201';

/** Decodes only the independently mapped control fields; vendor/IMU bytes are not retained. */
export function decodeMuseControls(hex: string): MuseTelemetryValues | null {
  if (!/^[0-9a-f]{130}$/i.test(hex)) return null;
  const bytes = [0, 1, 2, 3, 4].map((index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16));
  const [tip, tipForce, oval, ovalForce, bits] = bytes;
  if (tip === undefined || tipForce === undefined || oval === undefined || ovalForce === undefined || bits === undefined ||
      [tip, tipForce, oval, ovalForce].some((value) => value > 100)) return null;
  return { tip, tipForce, oval, ovalForce, roundHeld: (bits & 2) !== 0 };
}

/** Finite DEV telemetry sink. It never emits board input or verifies production pen readiness. */
export function createMuseTelemetryController(now: () => number = Date.now, monotonic: () => number = () => performance.now()) {
  const state = createStore<TelemetryState>(() => ({phase:'unavailable',reason:'No external test session',sessionId:null,samples:0,missingSequences:0,lastSequence:-1,lastWallTimeMs:null,values:null}));
  const used = new Set<string>();
  let session: MuseTelemetrySession | null = null;
  let lastElapsed = -1;
  let deadline = 0;
  let sequenceGaps = 0;
  let reportedGaps = 0;
  const expire = () => {
    if (session && (now() >= session.expiresAtWallTimeMs || monotonic() >= deadline) && state.getState().phase === 'live') {
      state.setState({phase:'unavailable',reason:'Expired; last values are historical'});
    } else if (state.getState().phase === 'live' && state.getState().lastWallTimeMs !== null && now() - (state.getState().lastWallTimeMs ?? now()) > 3000) {
      state.setState({phase:'unavailable',reason:'Telemetry stale; last values are historical'});
    }
  };
  return {
    state,
    startSession(input: unknown): boolean {
      expire();
      if (state.getState().phase === 'live') return false;
      if (!object(input) || !pinned(input) || input.capability !== 'external-test-telemetry' || input.maxSamples !== 100 ||
          typeof input.sessionId !== 'string' || !/^[a-z0-9_-]{16,128}$/i.test(input.sessionId) || used.has(input.sessionId) || used.size >= 64 ||
          !finite(input.startedAtWallTimeMs) || !finite(input.expiresAtWallTimeMs) ||
          !Number.isSafeInteger(input.startedAtWallTimeMs) || !Number.isSafeInteger(input.expiresAtWallTimeMs) ||
          now() - input.startedAtWallTimeMs > 3000 || input.startedAtWallTimeMs - now() > 2000 || input.expiresAtWallTimeMs <= now() ||
          input.expiresAtWallTimeMs <= input.startedAtWallTimeMs || input.expiresAtWallTimeMs - input.startedAtWallTimeMs > 40_000) return false;
      session = {...input} as unknown as MuseTelemetrySession;
      deadline = monotonic() + Math.min(40_000, session.expiresAtWallTimeMs - now());
      used.add(session.sessionId); lastElapsed = -1; sequenceGaps = 0; reportedGaps = 0;
      state.setState({phase:'live',reason:'External test reader; awaiting measured samples',sessionId:session.sessionId,samples:0,missingSequences:0,lastSequence:-1,lastWallTimeMs:null,values:null},true);
      return true;
    },
    ingestCapture(input: unknown): boolean {
      expire();
      if (!session || state.getState().phase !== 'live' || !object(input) || !pinned(input) || input.sessionId !== session.sessionId ||
          typeof input.gapCount !== 'number' || !Number.isSafeInteger(input.gapCount) || input.gapCount < reportedGaps || input.gapCount > 100 ||
          !Array.isArray(input.samples) || input.samples.length === 0 || input.samples.length + state.getState().samples > 100) return false;
      let sequence = state.getState().lastSequence;
      let wall = state.getState().lastWallTimeMs ?? session.startedAtWallTimeMs;
      let elapsed = lastElapsed;
      let missingSequences = sequenceGaps;
      let values: MuseTelemetryValues | null = null;
      for (const raw of input.samples) {
        if (!object(raw) || !Number.isSafeInteger(raw.sequence) || typeof raw.sequence !== 'number' || raw.sequence < 0 || raw.sequence >= 100 || raw.sequence <= sequence ||
            raw.gattStatus !== 0 || raw.byteLength !== 65 || typeof raw.rawHex !== 'string' ||
            !finite(raw.wallTimeMs) || !finite(raw.elapsedPollingMs) || raw.elapsedPollingMs < 0 || raw.elapsedPollingMs <= elapsed ||
            !Number.isSafeInteger(raw.wallTimeMs) || !Number.isSafeInteger(raw.elapsedPollingMs) ||
            raw.wallTimeMs < wall || raw.wallTimeMs < session.startedAtWallTimeMs || raw.wallTimeMs >= session.expiresAtWallTimeMs ||
            raw.wallTimeMs > now() + 2000 || now() - raw.wallTimeMs > 3000 || Math.abs(raw.wallTimeMs - session.startedAtWallTimeMs - raw.elapsedPollingMs) > 250) return false;
        values = decodeMuseControls(raw.rawHex);
        if (!values) return false;
        missingSequences += raw.sequence - sequence - 1;
        sequence = raw.sequence; wall = raw.wallTimeMs; elapsed = raw.elapsedPollingMs;
      }
      lastElapsed = elapsed;
      sequenceGaps = missingSequences; reportedGaps = input.gapCount;
      state.setState({samples:state.getState().samples + input.samples.length,missingSequences:Math.max(sequenceGaps,reportedGaps),lastSequence:sequence,lastWallTimeMs:wall,values,
        ...(state.getState().samples + input.samples.length === 100 ? {phase:'completed' as const,reason:'Completed capture; values are historical'} : {reason:'Measured external test telemetry'})});
      return true;
    },
    finishSession(sessionId: string): boolean {
      expire();
      if (!session || sessionId !== session.sessionId) return false;
      if (state.getState().phase === 'completed') return true;
      if (state.getState().phase !== 'live') return false;
      state.setState({phase:'completed',reason:'Completed capture; values are historical'});
      return true;
    },
    tick: expire,
    stop() { if (state.getState().phase === 'live') state.setState({phase:'unavailable',reason:'Viewer closed; last values are historical'}); },
  };
}
export type MuseTelemetryController = ReturnType<typeof createMuseTelemetryController>;
