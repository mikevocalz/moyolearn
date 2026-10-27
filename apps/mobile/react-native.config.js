// Native autolinking policy for targets whose SDK support differs from iOS.
// The published ExecuTorch and Dawn (react-native-webgpu) XCFrameworks have no
// xros slices; keeping them linked makes CocoaPods select framework directories
// that do not exist, and the Moyo link step fails with
// `ld: library 'webgpu_dawn' not found`. iOS and Android retain the production
// on-device OCR, tutor and WebGPU implementations.
// SOT-KEYWORDS: react native autolinking visionos executorch xros native dependency
const visionOS = process.env.MOYO_VISIONOS_BUILD === '1';

// `@viro-external/native-panels` (the native QuickDraw board and the native
// Rive panel behind the Round 2 device-validation switches) is JS-only unless
// a build sets MOYO_NATIVE_PANELS=1. Nitro is no longer the reason: the app
// and the package both run Nitro 1.0 alpha. The reason left is viro. The
// package's Kotlin imports `com.viromedia.bridge.canvas.CanvasSurfaces`
// (WhiteboardRenderLoop.kt, SurfaceSlot.kt, RiveSurfaceLink.kt), and the
// react_viro AAR in this app's viro 3.0.1-moyo.1 has no such class, so linking
// it fails the Android compile. It peers viro >=3.0.3-moyo.1. Drop this gate in
// the change that moves the app to that viro. Unlinked, the switches stay
// inert: `nativePanelsLinked` reports false.
const nativePanels = process.env.MOYO_NATIVE_PANELS === '1';

module.exports = {
  dependencies: {
    'react-native-executorch': visionOS ? { platforms: { ios: null } } : {},
    'react-native-keyboard-controller': visionOS ? { platforms: { ios: null } } : {},
    'react-native-pulsar': visionOS ? { platforms: { ios: null } } : {},
    'react-native-webgpu': visionOS ? { platforms: { ios: null } } : {},
    // AVCaptureVideoPreviewLayer, AVMetadataObject and the focus/exposure modes
    // VisionCamera builds on are unavailable in the visionOS SDK.
    'react-native-vision-camera': visionOS ? { platforms: { ios: null } } : {},
    '@viro-external/native-panels': nativePanels ? {} : { platforms: { android: null, ios: null } },
  },
};
