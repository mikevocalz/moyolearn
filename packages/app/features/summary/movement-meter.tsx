'use client';
// MovementMeter, web: signature S1 on Kinetrell's GSAP runtime.
//
// The server renders the settled frame (full bar, position line in place), so
// a reader without JavaScript, a crawler and a print all get the finished
// meter. On hydration GsapMotionProvider sets the `start` frame in a layout
// effect, before paint, and plays it once; under reduced motion it jumps the
// timeline to its end instead (the `system` policy, @acme/motion/web).
//
// Mobbin: https://mobbin.com/screens/c08fcab6-895e-4f21-b69d-aec52bc08c17
//   (Speak: score line above a single bar) ·
//   https://mobbin.com/screens/d37d0463-b4e3-43e9-8fb4-f3024e1342ba (Bloom: the
//   earlier point stays visible while the change extends from it) ·
//   https://mobbin.com/screens/f0707e72-e036-47fa-8f58-99e2387ba0ff (Quizlet: the
//   figure first, its explanation as a separate line beneath). Refused:
//   https://mobbin.com/screens/e5673646-4d12-4608-9c2a-af50f16b39f6 (CapWords:
//   confetti and a streak count on a progress screen; pressure on a child).
//   Structure only.
// SOT: DIRECTION.md §Signatures S1 · packages/motion/src/signatures/movement-bar.ts
// SOT-KEYWORDS: movement meter web gsap kinetrell signature session report
import { compileMotion, movementBar } from '@acme/motion';
import { GsapMotionProvider, Motion } from '@acme/motion/web';
import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { METER_CLASS, meterGeometry, type MovementMeterProps } from './movement-meter.shared.ts';

const compiled = compileMotion(movementBar);

export function MovementMeter({ label, beforeP, afterP, state, levelLine, positionCopy }: MovementMeterProps) {
  const { after, base, gain } = meterGeometry(beforeP, afterP);
  const fill = METER_CLASS.fill[state];
  return (
    <GsapMotionProvider motion={compiled}>
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
          <Motion.div
            target="gain"
            aria-hidden
            style={{ position: 'absolute', top: 0, bottom: 0, left: `${base}%`, width: `${gain}%`, transformOrigin: 'left center' }}
          >
            <View className={fill.gain} />
          </Motion.div>
        </View>
        <Text variant="data" className="font-mono text-text">{levelLine}</Text>
        <Motion.div target="position">
          <Text variant="body" tone="muted">{positionCopy}</Text>
        </Motion.div>
      </View>
    </GsapMotionProvider>
  );
}
