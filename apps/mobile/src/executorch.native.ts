// Registers ExecuTorch's resource fetcher, once, before any model is requested.
//
// react-native-executorch 0.9 made resource fetching a pluggable adapter and
// ships no default one. Until `initExecutorch` runs, every download path throws
// "ResourceFetcher adapter is not initialized" (RnExecutorchErrorCode 186), and
// because both on-device features funnel their weights through that fetcher,
// both failed identically and quietly: `useOCR({ model: OCR_ENGLISH })` never
// left `isReady === false` so the capture screen sat on "Loading text reader...",
// and `transcribe()` swallows the throw by contract (features/capture/
// transcribe.native.ts) so every voice note returned an empty string.
//
// WHY IT MUST RUN BEFORE THE FIRST RENDER, NOT MERELY BEFORE THE FIRST INFERENCE:
// the adapter is module-level state inside react-native-executorch, and the
// hooks begin fetching during their mount effect — `useOCR`/`useSpeechToText`
// have already lost by the time anyone calls `forward()`. `app/_layout.tsx` is
// the earliest module expo-router evaluates, so this is imported there for its
// side effect, the same lever `src/telemetry.ts` uses for Sentry.
//
// `ExpoResourceFetcher` is the Expo adapter; the bare alternative pulls in
// @dr.pogodin/react-native-fs, which this app does not have. It reads through
// expo-file-system and expo-asset — both already dependencies of `expo` and
// already autolinked — so it adds no native surface and needs no rebuild.
// Weights land in the documents directory under `react-native-executorch/`,
// which is why they survive a force-stop and are not re-downloaded on stage.
//
// SOT: https://docs.swmansion.com/react-native-executorch/docs/next/fundamentals/loading-models
// SOT-KEYWORDS: executorch initExecutorch resource fetcher expo adapter ocr whisper on-device model download
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

initExecutorch({ resourceFetcher: ExpoResourceFetcher });
