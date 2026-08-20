'use client';

import { View } from './tw';
import { Text } from './Text';

export interface SwitchProps {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ value, onChange, label, disabled, className }: SwitchProps) {
  return (
    <View
      className={`w-full flex-row items-center justify-between gap-3 ${disabled ? 'opacity-50' : ''} ${className ?? ''}`}
    >
      <Text className="min-w-0 flex-1">{label}</Text>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 shrink-0 rounded-md border-2 transition-colors duration-base ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 ${
          value
            ? 'border-border-strong bg-primary'
            : 'border-border bg-surface-sunken'
        }`}
      >
        <span
          className={`absolute left-0 top-[2px] h-5 w-5 rounded-sm border-2 transition-transform duration-base ease-out motion-reduce:transition-none ${
            value
              ? 'translate-x-[22px] border-border-strong bg-ink-950'
              : 'translate-x-[2px] border-border bg-surface-raised'
          }`}
        />
      </button>
    </View>
  );
}
