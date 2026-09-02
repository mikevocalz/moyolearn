'use client';
// PLATFORM FORK — the invisible input behind the OTP cells, web side.
// A real <input> stretched over the cell row at opacity 0: taps land on it,
// the browser and password managers see one `one-time-code` field, and paste
// distributes through the normal change event. The cells above are decoration.
// SOT: docs/38-front-door-and-flow.md §8 `OtpField`
// SOT-KEYWORDS: otp hidden input web one-time-code autofill paste
import { Input } from './primitives';
import type { OtpHiddenInputProps } from './otp-input.types';

export function OtpHiddenInput({
  value, onChangeText, onFocus, onBlur, mode, label, disabled, invalid,
}: OtpHiddenInputProps) {
  return (
    <Input
      value={value}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onBlur={onBlur}
      editable={!disabled}
      aria-label={label}
      aria-invalid={invalid}
      autoComplete="one-time-code"
      inputMode={mode === 'digits' ? 'numeric' : 'text'}
      autoCapitalize="characters"
      className="absolute inset-0 h-full w-full opacity-0"
    />
  );
}
