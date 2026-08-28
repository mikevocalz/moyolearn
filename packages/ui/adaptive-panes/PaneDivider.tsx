// TS resolution anchor — bundlers load the .native/.web forks.
//
// MUST be .tsx, matching the forks' extension (see detail-slot.tsx for the
// Metro resolution-order trap this avoids).
// Mobbin: see PaneDivider.native.tsx — the forks carry the structure citations.
export { PaneDivider, type PaneDividerProps } from './PaneDivider.web';
