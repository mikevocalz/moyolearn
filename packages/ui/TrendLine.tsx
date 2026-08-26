// TS resolution anchor — bundlers load the .native/.web forks.
// Mobbin: see TrendLine.web.tsx — the references live with the drawing code
//   (https://mobbin.com/screens/b6059966-2a7a-4db1-b127-2afdf2803004 Whop ·
//   https://mobbin.com/screens/d787ab5a-5243-4ef6-bbd0-565e39a00936 Midday ·
//   https://mobbin.com/screens/fe1f317d-f316-4eac-bc9d-015377a4b789 Jobber)
//
// MUST be .tsx, matching the forks: Metro resolves .native.ts before .tsx, so a
// `.ts` anchor here would ship the WEB build to the device.
export { TrendLine } from './TrendLine.web';
export type { TrendLineProps, TrendPoint } from './TrendLine.types';
