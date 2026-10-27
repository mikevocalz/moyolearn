// Whether this build can create the native-panels classes the Round 2
// switches need. A requested switch only takes effect when this says yes.
//
// The class is registered only when native-panels is autolinked, and
// `apps/mobile/react-native.config.js` decides that (see the comment there).
// The app runs Nitro 1.0, so `hasHybridClass` always exists; it answers false
// for a class that no linked library registered.
// SOT: device-validation-flags.ts · apps/mobile/react-native.config.js
// SOT-KEYWORDS: native panels linked nitro hasHybridClass capability round 2

import { NitroModules } from 'react-native-nitro-modules';

/** A native-panels class name, as nitrogen registers it. */
export type NativePanelsClass = 'nativepanels.WhiteboardRendererFactory' | 'nativepanels.RivePanel';

/** True when `name` can be created in this process. */
export function nativePanelsLinked(name: NativePanelsClass): boolean {
  return NitroModules.hasHybridClass(name);
}
