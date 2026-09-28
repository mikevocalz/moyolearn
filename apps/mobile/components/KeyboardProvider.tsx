// Keyboard provider for every platform that has a real hardware or software
// keyboard attached to a UIKit/Android input stack: iOS, Android and web.
// This is the module `_layout.tsx` imported directly from
// react-native-keyboard-controller before visionOS existed, kept behind a local
// filename so `KeyboardProvider.visionos.tsx` can take over on xros without a
// Platform.OS branch in the root layout.
// SOT-KEYWORDS: keyboard provider keyboard controller app root
export { KeyboardProvider } from 'react-native-keyboard-controller';
