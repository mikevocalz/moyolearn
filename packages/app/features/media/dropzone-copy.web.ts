// Zone copy for pointer platforms. Forked rather than branched: touch must
// never read a "drag files here" instruction the device cannot honor
// (doc 30 §6), and a fork makes that unrepresentable instead of remembered.
// SOT-KEYWORDS: dropzone copy web drag paste browse instructions
export const ZONE_TITLE = 'Drag and drop files here';
export const ZONE_HINT = 'or browse from your computer — pasting a screenshot works too';
