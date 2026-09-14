// Whether a board can open in space, answered before the first frame — the
// TS-resolution anchor, and the web answer.
//
// `spatialEligibility` takes the runtime's flags as ARGUMENTS so that
// `xr-capability` never has to name `@reactvision/react-viro`. Somebody still
// has to read those flags, and that read is what this fork is: the `.native`
// file asks the renderer's platform constants, and everything else — every web
// bundle, and every TypeScript resolution of a bare `./xr-eligibility` — lands
// here, where the answer is no and no renderer is named. `xr-session.store`
// imports this bare specifier, and the 2D tutor screen imports that store on
// every device, so this is the file a browser actually gets.
//
// IT IS A PLAIN CALL, NOT A HOOK AND NOT A PROMISE, AND THAT IS THE POINT. The
// store computes its opening phase from this while it is being created, so an
// eligible headset starts at `preparing` and the spatial navigator mounts on
// the first render instead of behind a flat card. Anything async here would be
// a frame of 2D, which is the thing this exists to remove.
// SOT: packages/app/features/tutor/xr-eligibility.native.ts
//      packages/app/features/tutor/xr-capability.ts
// SOT-KEYWORDS: xr eligibility platform fork web anchor synchronous opening phase no viro headset

import { spatialEligibility, type XrEligibility } from './xr-capability.ts';

export function currentXrEligibility(): XrEligibility {
  /*
    Asked through the one rule rather than returning the literal, so there stays
    a single place that decides what a missing runtime is CALLED. Both facts are
    false on web by construction: the package ships no web build of
    `ViroXRSceneNavigator`, so no browser has the OpenXR module in its bundle
    and no browser is a headset.
  */
  return spatialEligibility({ hasOpenXrModule: false, isHeadset: false });
}
