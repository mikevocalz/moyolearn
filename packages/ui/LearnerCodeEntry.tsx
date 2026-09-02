'use client';
// FD-08's code entry — the ONE typing surface a child ever gets (doc 38 §1
// design law 3: the child's door has no keyboard-typing of credentials; a
// 6-character code or a scan is the whole vocabulary).
//
// A pinned wrapper over OtpField rather than a re-implementation, so the
// learner screen can never drift from the adult one (doc 38 §8): `size="xl"`
// (72dp young-band row target, 64dp cells), `mode="alnum"` (I/O/1/0 excluded),
// `autoSubmit={false}` (a mis-tap must never submit — the button commits),
// and the visual dash after cell 3 (`AAA-000`, FD-14's code format).
// `scanSlot` is the voice-free affordance seat: the screen drops its camera/QR
// trigger in; the kit stays presentational and camera-free.
// SOT: docs/38-front-door-and-flow.md §5 FD-08 · §8 `LearnerCodeEntry` · docs/design/overhaul-v2/J-component-plan.md §2 row 5
// SOT-KEYWORDS: learner code entry fd-08 handoff redeem young band alnum scan slot
import type { ReactNode } from 'react';
import { OtpField } from './OtpField';
import { View } from './primitives';

export interface LearnerCodeEntryProps {
  /** Store-bound, like every front-door field. */
  value: string;
  onChange: (code: string) => void;
  error?: string;
  disabled?: boolean;
  /** FD-08's "Scan instead" seat — the screen supplies the trigger (camera icon button). */
  scanSlot?: ReactNode;
  /** K–2 band copy is the screen's job; this is only the input's accessible name. */
  label?: string;
  className?: string;
}

export function LearnerCodeEntry({
  value,
  onChange,
  error,
  disabled,
  scanSlot,
  label = 'Your code',
  className,
}: LearnerCodeEntryProps) {
  return (
    <View className={`w-full gap-group ${className ?? ''}`}>
      <OtpField
        value={value}
        onChange={onChange}
        size="xl"
        mode="alnum"
        autoSubmit={false}
        separatorAfter={3}
        label={label}
        error={error}
        disabled={disabled}
      />
      {scanSlot ? <View className="items-center">{scanSlot}</View> : null}
    </View>
  );
}
