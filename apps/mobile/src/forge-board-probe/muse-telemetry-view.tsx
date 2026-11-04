import { useEffect } from 'react';
import { useStore } from 'zustand';
import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import type { MuseTelemetryController } from './muse-telemetry';

/** Displays only mapped control measurements from the external test reader. */
export function MuseTelemetryView({controller}: {controller: MuseTelemetryController}) {
  const state = useStore(controller.state, (value) => value);
  useEffect(() => {
    if (state.phase !== 'live') return;
    const timer = setInterval(controller.tick, 250);
    return () => clearInterval(timer);
  }, [controller, state.phase]);
  useEffect(() => () => controller.stop(), [controller]);
  const values = state.values;
  return <View className="gap-element" testID="muse-test-telemetry">
    <Text variant="caption" testID="muse-test-telemetry-status">Muse diagnostic capture: {state.phase === 'live' ? 'LIVE' : state.phase === 'completed' ? 'Captured / historical' : 'Unavailable'} · {state.samples}/100 · sequence gaps: {state.missingSequences} · {state.reason}</Text>
    <Text variant="caption">Temporary diagnostic access · button and raw force readings</Text>
    <Text variant="caption" testID="muse-test-telemetry-values">{values
      ? `Tip ${values.tip} · tip force raw ${values.tipForce} · round ${values.roundHeld ? 'held' : 'released'} · oval ${values.oval} · oval force raw ${values.ovalForce}${state.phase === 'live' ? '' : ' · last measured values'}`
      : 'Awaiting actual mapped input reports; no values measured.'}</Text>
  </View>;
}
