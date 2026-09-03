'use client';
import { Host, Slider as ExpoSlider } from '@expo/ui';
import { targets } from '@acme/theme';
import { View } from './primitives';
import { Text } from './Text';
import type { SliderProps } from './Slider.types';

/** The adult touch target (44), read from the scale rather than written here. */
const HOST_MIN_HEIGHT = Number.parseInt(targets.adult, 10);

/**
 * Range control, rendered by `@expo/ui` (SwiftUI / Jetpack Compose).
 *
 * A slider is exactly the kind of control worth handing to the platform: the
 * drag physics, the accessibility actions and the haptic detents are behaviour
 * a hand-rolled version has to reimplement and usually gets subtly wrong.
 *
 * The label stays in JS so it keeps the kit's type scale and className styling;
 * only the track itself is native.
 */
export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 1,
  step,
  disabled,
  label,
  className,
}: SliderProps) {
  return (
    <View className={`gap-element ${className ?? ''}`}>
      {label ? <Text className="text-sm font-medium text-text md:text-base">{label}</Text> : null}
      {/*
        A FLOOR ON THE HOST, for the reason `html/native-input.native.tsx`
        carries one: `matchContents` asks the Host to size itself to the Compose
        content, and when Compose measures zero the Host is zero-tall. The
        accessibility tree showed it exactly — `ComposeView (…, 0.000)` under a
        seek bar that still painted its track.

        The damage is not confined to the slider. Everything laid out BELOW a
        collapsed host sits outside the bounds its parent measured, and Android
        draws those children while React Native declines to deliver touches to
        them: in the voice-note sheet "Record again" and "Use this recording"
        reported correct, clickable frames and did nothing at all. So a control
        that nobody could see was broken made two buttons under it dead, which
        is why the floor belongs on the shared component rather than on the one
        screen where it was noticed. 44 is the adult target, the same floor the
        hosted text input uses.
      */}
      <Host
        style={{ minHeight: HOST_MIN_HEIGHT }}
        matchContents={{ vertical: true, horizontal: false }}
      >
        <ExpoSlider
          value={value}
          onValueChange={onValueChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
        />
      </Host>
    </View>
  );
}
