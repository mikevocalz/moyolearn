// Native autolinking policy for targets whose SDK support differs from iOS.
// The published ExecuTorch and Dawn (react-native-webgpu) XCFrameworks have no
// xros slices; keeping them linked makes CocoaPods select framework directories
// that do not exist, and the Moyo link step fails with
// `ld: library 'webgpu_dawn' not found`. iOS and Android retain the production
// on-device OCR, tutor and WebGPU implementations.
// SOT-KEYWORDS: react native autolinking visionos executorch xros native dependency
const visionOS = process.env.MOYO_VISIONOS_BUILD === '1';

module.exports = {
  dependencies: {
    'react-native-executorch': visionOS ? { platforms: { ios: null } } : {},
    'react-native-keyboard-controller': visionOS ? { platforms: { ios: null } } : {},
    'react-native-pulsar': visionOS ? { platforms: { ios: null } } : {},
    'react-native-webgpu': visionOS ? { platforms: { ios: null } } : {},
  },
};
