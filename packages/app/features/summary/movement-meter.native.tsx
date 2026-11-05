// MovementMeter, native: signature S1 on Kinetrell's Reanimated runtime. The
// playhead and every frame stay on the UI thread (useMotion + Motion.View);
// React renders once. Under reduced motion the timeline finishes on mount and
// never autoplays (@acme/motion/native).
//
// Mobbin: https://mobbin.com/screens/c08fcab6-895e-4f21-b69d-aec52bc08c17 (Speak) ·
//   https://mobbin.com/screens/d37d0463-b4e3-43e9-8fb4-f3024e1342ba (Bloom) ·
//   https://mobbin.com/screens/f0707e72-e036-47fa-8f58-99e2387ba0ff (Quizlet). Structure
//   only; what each gave, and the refused pattern, are in movement-meter.tsx.
// SOT: DIRECTION.md §Signatures S1 · packages/motion/src/signatures/movement-bar.ts
// SOT-KEYWORDS: movement meter native reanimated kinetrell signature session report
import { movementBar } from '@acme/motion';
import { Motion, useMotion } from '@acme/motion/native';
import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { METER_CLASS, meterGeometry, type MovementMeterProps } from './movement-meter.shared.ts';

export function MovementMeter({ label, beforeP, afterP, state, levelLine, positionCopy }: MovementMeterProps) {
  const motion = useMotion(movementBar, { autoplay: true });
  const { after, base, gain } = meterGeometry(beforeP, afterP);
  const fill = METER_CLASS.fill[state];
  return (
    <View className={METER_CLASS.root}>
      <View className="flex-row items-center justify-between gap-element">
        <Text className="text-label text-text">{label}</Text>
        <Text className={METER_CLASS.value}>{after}%</Text>
      </View>
      {/* The role stays on the track, not the root: a progressbar's children
            are presentational to assistive tech, and the root holds the level
            and position lines, which must still be read. */}
        <View
          className={METER_CLASS.track}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={after}
        >
        <View
            className={gain > 0 ? `${METER_CLASS.base} ${fill.base}` : `${METER_CLASS.settledBase} ${fill.solid}`}
            style={{ width: `${base}%` }}
          />
        <Motion.View
          motion={motion}
          target="gain"
          aria-hidden
          style={{ position: 'absolute', top: 0, bottom: 0, left: `${base}%`, width: `${gain}%`, transformOrigin: 'left' }}
        >
          <View className={fill.gain} />
        </Motion.View>
      </View>
      <Text variant="data" className="font-mono text-text">{levelLine}</Text>
      <Motion.View motion={motion} target="position">
        <Text variant="body" tone="muted">{positionCopy}</Text>
      </Motion.View>
    </View>
  );
}
