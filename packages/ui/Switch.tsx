'use client';
import { tv } from './tv';
import { haptics } from './haptics';
import { Pressable, View } from './primitives';
import { Text } from './Text';

const switchRow = tv({
  slots: { root: 'w-full flex-row items-center justify-between gap-stack' },
  variants: { disabled: { true: { root: 'opacity-50' } } },
});

export interface SwitchProps {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Toggle.
 *
 * This used to host the platform control (`@expo/ui` SwiftUI Toggle / Material
 * Switch). That control owns its own shape and cannot be restyled, so it landed
 * in the UI as a stadium pill among components that are uniformly rounded-md
 * slabs with 2px borders — a different design language sitting in the settings
 * list. It is now drawn in JS from the same tokens as every other control, and
 * matches the web fork exactly.
 *
 * The trade-off is deliberate: a platform toggle brings free platform feel and
 * accessibility, so this keeps `role="switch"`, the checked state, and the
 * selection haptic rather than dropping them along with the native view.
 */
export function Switch({ value, onChange, label, disabled, className }: SwitchProps) {
  const s = switchRow({ disabled });

  return (
    <View className={s.root({ className })}>
      <Text className="min-w-0 flex-1">{label}</Text>
      <Pressable
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onPress={() => {
          if (disabled) return;
          haptics.selection();
          onChange(!value);
        }}
        className={`relative h-7 w-12 shrink-0 rounded-control border-2 transition-colors duration-base ease-out ${
          value ? 'border-border-strong bg-primary' : 'border-border bg-surface-sunken'
        }`}
      >
        <View
          className={`/* radius-exempt: thumb sits INSIDE the track; matching radii would fill the corners */ absolute top-[2px] h-5 w-5 rounded-sm border-2 transition-transform duration-base ease-out ${
            value
              ? 'translate-x-[22px] border-border-strong bg-ink-950'
              : 'translate-x-[2px] border-border bg-surface-raised'
          }`}
        />
      </Pressable>
    </View>
  );
}
