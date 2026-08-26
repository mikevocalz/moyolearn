// TS resolution anchor — bundlers load the .native/.web forks.
// Mobbin: no reference pull — this file has no UI. It is a resolution anchor
//   for a state hook; the surfaces that render this state cite their own
//   references (see ops-dashboard-content.tsx for the filter-chip and pagination
//   patterns from Twenty and Navattic).
export { useViewParams } from './use-view-params.web';
export type { ShareableView, ViewParams } from './use-view-params.types';
