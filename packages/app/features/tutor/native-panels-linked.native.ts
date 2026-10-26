// Whether this build can create the native-panels classes the Round 2
// switches need. A requested switch only takes effect when this says yes.
//
// TWO THINGS MUST HOLD. The Nitro runtime must have `hasHybridClass`, which
// arrived with Nitro 1.0; this app ships react-native-nitro-modules 0.37.1,
// and `@viro-external/native-panels` calls it unguarded, so asking without
// this check throws a TypeError. And the class must be registered, which
// needs native-panels autolinked: it is excluded by default in
// `apps/mobile/react-native.config.js` and builds only with MOYO_NATIVE_PANELS=1.
// SOT: device-validation-flags.ts · apps/mobile/react-native.config.js
// SOT-KEYWORDS: native panels linked nitro hasHybridClass capability round 2

import { NitroModules } from 'react-native-nitro-modules';

/** A native-panels class name, as nitrogen registers it. */
export type NativePanelsClass = 'nativepanels.WhiteboardRendererFactory' | 'nativepanels.RivePanel';

/** True when `name` can be created in this process. */
export function nativePanelsLinked(name: NativePanelsClass): boolean {
  const proxy = NitroModules as unknown as { hasHybridClass?: (className: string) => boolean };
  if (typeof proxy.hasHybridClass !== 'function') return false;
  try {
    return proxy.hasHybridClass(name);
  } catch {
    return false;
  }
}
