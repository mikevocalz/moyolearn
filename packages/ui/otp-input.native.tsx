'use client';
// PLATFORM FORK — the invisible input behind the OTP cells, native side.
// React Native's own TextInput rather than the kit's @expo/ui field, on
// purpose: `textContentType="oneTimeCode"` + `autoComplete` are the whole job
// here (mail-app codes autofill through them, doc 38 §5 FD-05) and the kit's
// NativeInput contract cannot carry them. "Native controls end to end" is not
// at stake — nothing here is visible; this is a keyboard + autofill surface
// drawn over by the JS cells.
// SOT: docs/38-front-door-and-flow.md §8 `OtpField`
// SOT-KEYWORDS: otp hidden input native oneTimeCode autofill keyboard number-pad
import { StyleSheet, TextInput } from 'react-native';
import type { OtpHiddenInputProps } from './otp-input.types';

const styles = StyleSheet.create({
  input: { ...StyleSheet.absoluteFill, opacity: 0 },
});

export function OtpHiddenInput({
  value, onChangeText, onFocus, onBlur, mode, label, disabled,
}: OtpHiddenInputProps) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onBlur={onBlur}
      editable={!disabled}
      accessibilityLabel={label}
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      keyboardType={mode === 'digits' ? 'number-pad' : 'default'}
      autoCapitalize="characters"
      autoCorrect={false}
      caretHidden
      style={styles.input}
    />
  );
}
