'use client';
import { View } from './primitives';
import { Text } from './Text';
import type { SliderProps } from './Slider.types';

/** Web uses the platform's own range input, which is already accessible. */
export function Slider({
  value, onValueChange, min = 0, max = 1, step, disabled, label, className,
}: SliderProps) {
  return (
    <View className={`gap-element ${className ?? ''}`}>
      {label ? <Text className="text-sm font-medium text-text md:text-base">{label}</Text> : null}
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onValueChange(Number(event.target.value))}
        className="h-2 w-full appearance-none rounded-full border-2 border-border bg-surface-sunken accent-primary disabled:opacity-50"
      />
    </View>
  );
}
