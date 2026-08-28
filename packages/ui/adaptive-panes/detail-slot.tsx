// TS resolution anchor — bundlers load the .native/.web forks.
//
// MUST be .tsx, matching the forks' extension: Metro resolves
// .android.ts | .native.ts | .ts | .android.tsx | .native.tsx | .tsx, so a
// `.ts` anchor beside `.tsx` forks would win on native and ship the web fork
// (no router slot) to the device.
// Mobbin: not a surface — a resolution anchor; the host (index.tsx) and forks
// carry the module's structure citations.
export { DetailSlot } from './detail-slot.web';
