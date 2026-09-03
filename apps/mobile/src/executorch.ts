// Web half of the ExecuTorch bootstrap — deliberately empty.
//
// This app also builds for web (`app.config.ts` -> web.bundler: metro), and the
// capture feature already forks away from ExecuTorch there: `ocr-web.ts` uses
// tesseract and `transcribe.web.ts` uses the browser path. Importing
// react-native-executorch into the web bundle would pull its native specs in for
// nothing and break the build, so the platform fork happens at the bootstrap,
// not behind a runtime `Platform.OS` branch.
//
// The anchor's extension MUST stay `.ts` to match `executorch.native.ts`: Metro
// tries every `.ts` variant before any `.tsx` one, so a mismatched anchor wins
// on device and ships this no-op to Android. `_layout.tsx` must also import it
// WITHOUT a file extension, or resolution is literal and never forks.
//
// SOT: apps/mobile/src/executorch.native.ts
// SOT-KEYWORDS: executorch initExecutorch web fork no-op resource fetcher
export {};
