'use client';
// Six-cell one-time-code entry (doc 38 §5 FD-05/FD-07/FD-08 · §8 `OtpField`).
//
// One hidden input carries the real value; the cells are an aria-hidden mirror.
// That single decision buys everything the spec asks for at once: platform
// autofill (`one-time-code` semantics), paste distribution (a pasted "123456"
// is just a change event), backspace-moves-left (the string shrinks), and a
// SINGLE logical input for screen readers instead of six fake fields.
// Sanitisation is the maxLength: uppercase, strip non-members, slice to length
// — so a paste of "ABC-123" lands as ABC123 and mode `alnum` can never hold
// the confusable I/O/1/0 (FD-08's code alphabet, matched to FD-14's generator).
// Mobbin: mobbin.com/screens/bdea0a9d-7fec-4abf-8465-c0e17c0ec63e (Rivian — six equal cells filling left-to-right, resend/change-method links below, one Verify commit) ·
// mobbin.com/screens/409e02bc-e630-4cb6-8c32-3bcb8ab7fc1d (American Airlines — the active cell carries the caret ring, so one logical input reads as six boxes) ·
// mobbin.com/screens/9c73c3af-30b0-4255-b2d3-c22b3938f9be (Waymo — insertion caret sits in the first empty cell; the row, not a cell, is the focus target). Structure only.
// SOT: docs/38-front-door-and-flow.md §8 · docs/design/overhaul-v2/J-component-plan.md §2 row 5
// SOT-KEYWORDS: otp field one-time-code verification cells autofill paste auto-submit learner
import { Fragment } from 'react';
import { tv } from './tv';
import { View } from './primitives';
import { Text } from './Text';
import { useInstanceStore, useStore } from './use-instance-store';
import { OtpHiddenInput } from './otp-input';

const otp = tv({
  slots: {
    root: 'gap-1.5',
    row: 'relative w-full flex-row items-center justify-center',
    cell:
      'min-w-0 flex-1 items-center justify-center rounded-control border-2 border-border bg-surface-raised ' +
      'transition-all duration-fast motion-reduce:transition-none',
    char: 'font-mono font-semibold text-text',
    dash: 'font-mono font-semibold text-text-muted',
    message: 'text-sm text-danger',
  },
  variants: {
    /*
      `xl` is the learner size: 64dp cells per FD-08, on a row whose min-height
      is the K–2 target token — the hidden input stretches over the whole row,
      so the ROW is the touch target and it clears 72, not just the cell art.
    */
    size: {
      md: { row: 'min-h-target-adult gap-element', cell: 'h-14 max-w-12', char: 'text-2xl', dash: 'text-2xl' },
      xl: { row: 'min-h-target-young gap-element', cell: 'h-16 max-w-14', char: 'text-display-sm', dash: 'text-display-sm' },
    },
    error: { true: { cell: 'border-danger' } },
    disabled: { true: { cell: 'opacity-50' } },
  },
  defaultVariants: { size: 'md', error: false, disabled: false },
});

// FD-08's alphabet: uppercase letters and digits with I/O/1/0 excluded.
const MEMBERS = { digits: /[^0-9]/g, alnum: /[^2-9A-HJ-NP-Z]/g } as const;

const sanitize = (raw: string, mode: OtpMode, length: number) =>
  raw.toUpperCase().replace(MEMBERS[mode], '').slice(0, length);

export type OtpMode = 'digits' | 'alnum';

export interface OtpFieldProps {
  /** Store-bound (doc 38 §4: field state survives the fold in the signup store). */
  value: string;
  onChange: (code: string) => void;
  length?: number;
  mode?: OtpMode;
  size?: 'md' | 'xl';
  /**
   * Fire `onComplete` as the final character lands (FD-05 auto-submits on the
   * sixth digit). FD-08 sets false: a child's mis-tap must never submit —
   * the button is the commit.
   */
  autoSubmit?: boolean;
  onComplete?: (code: string) => void;
  error?: string;
  disabled?: boolean;
  /** Accessible name of the single logical input. */
  label?: string;
  /** Visual dash after this cell index (LearnerCodeEntry: 3 → `AAA-000`). */
  separatorAfter?: number;
  className?: string;
}

export function OtpField({
  value,
  onChange,
  length = 6,
  mode = 'digits',
  size = 'md',
  autoSubmit = true,
  onComplete,
  error,
  disabled,
  label = 'Verification code',
  separatorAfter,
  className,
}: OtpFieldProps) {
  const store = useInstanceStore(() => ({ focused: false }));
  const focused = useStore(store, (state) => state.focused);
  const s = otp({ size, error: !!error, disabled });

  const code = sanitize(value, mode, length);
  // The caret cell: next empty position, parked on the last cell when full.
  const activeIndex = Math.min(code.length, length - 1);

  const handleChange = (raw: string) => {
    const next = sanitize(raw, mode, length);
    if (next === code) return;
    onChange(next);
    if (autoSubmit && next.length === length) onComplete?.(next);
  };

  return (
    <View className={s.root({ className })}>
      <View className={s.row()}>
        {Array.from({ length }, (_, index) => {
          const active = focused && !disabled && index === activeIndex;
          return (
            <Fragment key={index}>
              {separatorAfter != null && index === separatorAfter ? (
                <Text aria-hidden className={s.dash()}>-</Text>
              ) : null}
              <View
                aria-hidden
                className={s.cell({
                  className: active ? 'border-border-strong ring-2 ring-focus/50' : undefined,
                })}
              >
                <Text className={s.char()}>{code[index] ?? ''}</Text>
              </View>
            </Fragment>
          );
        })}
        <OtpHiddenInput
          value={code}
          onChangeText={handleChange}
          onFocus={() => store.setState({ focused: true })}
          onBlur={() => store.setState({ focused: false })}
          mode={mode}
          label={label}
          disabled={disabled}
          invalid={!!error}
        />
      </View>
      {error ? (
        <Text role="alert" className={s.message()}>{error}</Text>
      ) : null}
    </View>
  );
}
