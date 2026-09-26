// Whether a board can open in space, answered before the first frame — native.
//
// THE FLAGS COME FROM `ViroPlatform`, NOT FROM THE PACKAGE ROOT, and here that
// is a bundle decision rather than a matter of taste. This module is reached
// from `xr-session.store`, which the 2D tutor screen imports on EVERY device —
// so a root import would put the whole renderer into a child's phone bundle at
// homework time, which is precisely what `tutor-xr-entry.native`'s lazy
// `import()` exists to prevent. `ViroPlatform` imports `react-native` and
// nothing else: it is `Platform.constants` and one `NativeModules` lookup, read
// once at module load, and it links no renderer by being evaluated.
//
// QUEST OR PICO. The fork supports both — `ViroPlatform` exports `isQuest` AND
// `isPico`, and it carries a PICO xRMode — but only `isQuest` and
// `hasOpenXRSupport` reach the package root, so an `isQuest`-only gate reported
// `device-not-eligible` on a PICO 4 Ultra that can run this scene. Verified
// against a cabled one: manufacturer `Pico`, model `A9210`, device `sparrow`,
// Android 14. Reading all three from the module path rather than two from the
// root and one from the path is also how this file stays one import instead of
// two; re-exporting `isPico` from the fork's root would be cleaner and means
// re-cutting the vendored tarball, noted in ADR-117.
// SOT: packages/app/features/tutor/xr-eligibility.ts
//      packages/app/features/tutor/xr-capability.ts
// SOT-KEYWORDS: xr eligibility platform fork native viro platform constants quest pico synchronous opening phase

import {
  hasOpenXRSupport,
  isPico,
  isQuest,
} from '@reactvision/react-viro/dist/components/Utilities/ViroPlatform';
import { spatialEligibility, type XrEligibility } from './xr-capability.ts';

export function currentXrEligibility(): XrEligibility {
  /*
    Constants, not functions — calling them would read fine and hand
    `spatialEligibility` a truthy function object on every device, which is a
    phone that believes it is a headset.
  */
  return spatialEligibility({
    hasOpenXrModule: hasOpenXRSupport,
    isHeadset: isQuest || isPico,
  });
}
