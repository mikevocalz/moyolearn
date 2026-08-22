'use client';
import { Pressable, View } from './primitives';
import { Text } from './Text';
import type { SegmentedControlProps } from './SegmentedControl.types';

/**
 * Segmented view switcher.
 *
 * DRAWN IN JS ON BOTH PLATFORMS, deliberately. `@expo/ui`'s community
 * segmented control renders Android's Material segmented button group, which
 * owns its own shape: a stadium pill with a hairline border and a check glyph
 * on the selected segment. Setting `borderRadius` on the wrapper does not
 * change it. Beside the kit's Button — a rounded-md slab with a 2px ink border
 * and a hard offset shadow — it read as a component borrowed from another app.
 *
 * Same trade-off, and same resolution, as `Switch`: where a platform control's
 * SHAPE is the design and the design has to match, the kit draws it. Controls
 * whose value is behaviour rather than chrome (TextInput, Picker, Slider, List)
 * still come from `@expo/ui`.
 *
 * Metrics are the Button's: 44dp targets, rounded-md, matching type scale.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <View
      role="tablist"
      className={`flex-row gap-1 rounded-md border-2 border-border bg-surface-sunken p-1 ${className ?? ''}`}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="tab"
            aria-selected={isActive}
            onPress={() => onChange(option.value)}
            className={`min-h-9 items-center justify-center rounded-sm px-3 py-1.5 transition-colors duration-fast md:px-4 md:py-2 motion-reduce:transition-none ${
              isActive ? 'bg-primary' : 'hover:bg-surface-raised'
            }`}
          >
            <Text
              className={`text-sm font-medium md:text-base ${
                isActive ? 'text-on-primary' : 'text-text-muted'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type { SegmentedControlProps, SegmentedOption } from './SegmentedControl.types';
