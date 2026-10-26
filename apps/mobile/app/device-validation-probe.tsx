/**
 * Engineering route: moyo://device-validation-probe.
 *
 * The Round 1 workloads of the 2026-10 device pass, chosen by query:
 *
 *   adb shell am start -a android.intent.action.VIEW \
 *     -d 'moyo://device-validation-probe?workload=multi&count=4'
 *
 * `workload` is video (R1.2), panel (R1.3) or multi (R1.5); `count` is 1, 2
 * or 4 for multi. The parser is `src/native-3d/device-validation-params.ts`.
 *
 * `nativeBoard=1|0` and `nativeRive=1|0` set the Round 2 switches
 * (`@acme/app/features/tutor/device-validation-flags.ts`) for the running
 * process; the tutor board reads them the next time it mounts. A query that
 * leaves a switch out leaves it as it was. Each switch takes effect only in a
 * build where native-panels is linked (MOYO_NATIVE_PANELS=1).
 *
 * Deep-linked and nothing else, like the other probe routes: no tab, no link,
 * no menu item, so a learner cannot reach it.
 *
 * SOT: apps/mobile/src/native-3d/device-validation-probe.tsx
 * SOT-KEYWORDS: device validation probe route deep link round 1 workloads
 */
import React, { useEffect, useMemo } from 'react';
import { Platform, Text, View } from 'react-native';
import { useSearchParams } from 'solito/navigation';
import { ViroXRSceneNavigator } from '@reactvision/react-viro';
import { parseValidationProbeRequest } from '../src/native-3d/device-validation-params';
import { DeviceValidationScene } from '../src/native-3d/device-validation-probe';
import { deviceValidationFlags } from '@acme/app/features/tutor/device-validation-flags.ts';

export default function DeviceValidationProbeRoute() {
  const params = useSearchParams();
  const request = useMemo(() => parseValidationProbeRequest(params), [params]);
  useEffect(() => {
    if (params?.has('nativeBoard')) deviceValidationFlags.setState({ nativeBoard: request.nativeBoard });
    if (params?.has('nativeRive')) deviceValidationFlags.setState({ nativeRive: request.nativeRive });
  }, [params, request]);
  const initialScene = useMemo(
    () => ({ scene: () => <DeviceValidationScene request={request} /> }),
    [request],
  );

  if (Platform.OS !== 'android') {
    return (
      <View style={{ flex: 1, padding: 32, backgroundColor: '#112d44' }}>
        <Text style={{ color: '#ffffff', fontSize: 22 }}>This probe runs on the Android XR headsets only.</Text>
      </View>
    );
  }

  if (__DEV__) console.log('[device-validation-probe] request', JSON.stringify(request));
  return (
    <ViroXRSceneNavigator
      /* A new request is a new scene: the navigator captures `initialScene`. */
      key={`${request.workload}-${request.count}`}
      initialScene={initialScene}
      viroAppProps={{}}
      style={{ flex: 1 }}
    />
  );
}
