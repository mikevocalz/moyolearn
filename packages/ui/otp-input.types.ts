// Shared contract for OtpField's hidden input fork (doc 38 §8 `OtpField`).
// The forks exist because the autofill hints ARE the component: web needs
// `autocomplete="one-time-code"` on a real <input>, native needs RN's
// `textContentType="oneTimeCode"` — and the kit's @expo/ui field contract
// (html/native-input.native.tsx) carries neither.
// SOT: docs/38-front-door-and-flow.md §8 · docs/design/overhaul-v2/J-component-plan.md §2 row 5
// SOT-KEYWORDS: otp hidden input one-time-code autofill fork contract
export interface OtpHiddenInputProps {
  value: string;
  onChangeText: (raw: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  /** `digits` shows the numeric keyboard; `alnum` the full one (FD-08). */
  mode: 'digits' | 'alnum';
  /** The single logical input's accessible name — screen readers meet this, never the cells. */
  label: string;
  disabled?: boolean;
  invalid?: boolean;
}
