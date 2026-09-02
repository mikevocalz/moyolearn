// TS resolution anchor — bundlers load the .native/.web forks.
// MUST be .tsx: Metro resolves `.ts` ahead of `.native.tsx` (see icons.tsx),
// so a `.ts` anchor would ship the web <input> to the device.
// The forks skip the reference gate, so the citation for the hidden-input
// design lives here (same refs as OtpField, which draws the cells).
// Mobbin: mobbin.com/screens/bdea0a9d-7fec-4abf-8465-c0e17c0ec63e (Rivian — one code, one field: autofill/paste land as a single change event distributed across the visible cells) ·
// mobbin.com/screens/409e02bc-e630-4cb6-8c32-3bcb8ab7fc1d (American Airlines — a single logical input drives six mirrored boxes; the caret ring just tracks the string's end). Structure only.
export { OtpHiddenInput } from './otp-input.web';
export type { OtpHiddenInputProps } from './otp-input.types';
