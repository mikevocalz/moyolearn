// TS resolution anchor — bundlers load the .native/.web forks.
// MUST be .tsx: Metro resolves `.ts` ahead of `.native.tsx` (see icons.tsx),
// so a `.ts` anchor would ship the web <input> to the device.
export { OtpHiddenInput } from './otp-input.web';
export type { OtpHiddenInputProps } from './otp-input.types';
