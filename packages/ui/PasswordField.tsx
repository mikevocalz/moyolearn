'use client';
// Password entry with a labeled Show/Hide toggle + the live rules line
// (doc 38 §5 FD-02/FD-04/FD-06/FD-07 · §8 `PasswordField` + `PasswordRules`).
//
// The toggle is TEXT, never icon-only — NN/g's finding is that masking with no
// way to see the input causes failed logins, and an eye glyph alone fails the
// labeled-control law (doc 38 §7). Rules are evaluated on every change but only
// STYLED as error after blur or submit (§8): a red wall while someone is still
// typing their third character is scolding, not helping.
// Field chrome mirrors TextField deliberately; the two must read as one family.
// Mobbin: mobbin.com/screens/c0ba7943-75bb-4fa4-842e-f1f92193a2c0 (Rocket Money — rules checklist under the field flips to satisfied checks as you type; visibility toggle lives inside the field's trailing edge) ·
// mobbin.com/screens/8b0dc4dd-5651-42f0-883e-90f5aa20c9c3 (Binance — met rules render calm/neutral rather than shouting; toggle + clear share the field's trailing slot) ·
// mobbin.com/screens/095f3830-331d-454f-89fd-e94566be0641 (Origin — rules as one compact line row directly beneath the input, evaluated live before submit). Structure only.
// SOT: docs/38-front-door-and-flow.md §8 · docs/design/overhaul-v2/J-component-plan.md §2 row 7
// SOT-KEYWORDS: password field show hide toggle rules line new-password autofill login signup
import { tv } from './tv';
import { Input, Label, Pressable, View } from './primitives';
import { Text } from './Text';
import { useInstanceStore, useStore } from './use-instance-store';

const passwordField = tv({
  slots: {
    root: 'gap-1.5',
    label: 'text-sm font-medium text-text',
    input:
      'w-full min-h-11 justify-center rounded-md border-2 border-border bg-surface-raised py-2.5 pl-4 pr-16 text-base text-text ' +
      'placeholder:text-text-muted/70 transition-all duration-fast ' +
      'focus:shadow-card focus:outline-none motion-reduce:transition-none',
    toggle:
      'absolute inset-y-0 right-0 min-w-target-adult items-center justify-center px-3 ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50',
    toggleLabel: 'text-sm font-semibold text-text-muted hover:text-text',
    message: 'text-sm text-danger',
  },
  variants: {
    error: { true: { input: 'border-danger focus:border-danger' } },
    disabled: { true: { input: 'opacity-50' } },
  },
});

export interface PasswordRulesProps {
  value: string;
  minLength?: number;
  /** Blur or submit happened — the only time an unmet rule may style as error (doc 38 §8). */
  touched?: boolean;
  className?: string;
}

// The FD-04 rule line, copy final per doc 38 §5 ("Copy is final unless marked
// [alt]"): one plain sentence, flipping to `Good password.` on meet — never a
// checklist wall. Exported standalone for FD-07's reset step.
export function PasswordRules({ value, minLength = 8, touched, className }: PasswordRulesProps) {
  const missing = Math.max(0, minLength - value.length);
  const met = missing === 0;
  const tone = met
    ? 'text-forest-700 dark:text-forest-200'
    : touched
      ? 'text-danger'
      : 'text-text-muted';
  const copy = met
    ? 'Good password.'
    : touched
      ? `Add ${missing} more character${missing === 1 ? '' : 's'}.`
      : `At least ${minLength} characters. Longer is stronger.`;
  return (
    <Text role="status" variant="caption" className={`${tone} ${className ?? ''}`}>
      {copy}
    </Text>
  );
}

export interface PasswordFieldProps {
  label?: string;
  /** Store-bound (doc 38: form state lives in stores so it survives the fold). */
  value: string;
  onChangeText: (text: string) => void;
  /**
   * `current` = login (offer the saved password); `new` = signup/reset (iOS
   * offers a strong one). Maps to autoComplete/textContentType per FD-02/FD-04.
   */
  intent?: 'current' | 'new';
  /** Renders the live PasswordRules line, bound to this minimum. */
  minLength?: number;
  error?: string;
  hint?: string;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  onBlur?: () => void;
  className?: string;
  containerClassName?: string;
}

export function PasswordField({
  label = 'Password',
  value,
  onChangeText,
  intent = 'current',
  minLength,
  error,
  hint,
  disabled,
  placeholder,
  autoFocus,
  onSubmitEditing,
  onBlur,
  className,
  containerClassName,
}: PasswordFieldProps) {
  const store = useInstanceStore(() => ({ visible: false, touched: false }));
  const visible = useStore(store, (state) => state.visible);
  const touched = useStore(store, (state) => state.touched);
  const s = passwordField({ error: !!error, disabled });

  return (
    <View className={s.root({ className: containerClassName })}>
      <Label className={s.label()}>{label}</Label>
      <View className="relative">
        <Input
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          editable={!disabled}
          aria-label={label}
          aria-invalid={!!error}
          autoComplete={intent === 'new' ? 'new-password' : 'password'}
          textContentType={intent === 'new' ? 'newPassword' : 'password'}
          autoCapitalize="none"
          placeholder={placeholder}
          autoFocus={autoFocus}
          onSubmitEditing={onSubmitEditing}
          onBlur={() => {
            store.setState({ touched: true });
            onBlur?.();
          }}
          className={s.input({ className })}
        />
        <Pressable
          aria-label={visible ? 'Hide password' : 'Show password'}
          onPress={() => store.setState({ visible: !store.getState().visible })}
          className={s.toggle()}
        >
          <Text className={s.toggleLabel()}>{visible ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>
      {minLength != null ? (
        <PasswordRules value={value} minLength={minLength} touched={touched || !!error} />
      ) : null}
      {error ? (
        <Text role="alert" className={s.message()}>{error}</Text>
      ) : hint ? (
        <Text tone="muted" variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
}
