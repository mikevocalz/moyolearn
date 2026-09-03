/**
 * `moyo://natalie-3d` — the avatar stage on its own, with no session around it.
 *
 * Step 3 of the smoke ladder (`moyo://native-3d-smoke` is steps 1 and 2: raw
 * Dawn, then three's renderer on a cube). This one mounts the REAL body, so a
 * failure here is the glTF, the rig or a material — the earlier route has
 * already ruled out the adapter, the surface and the renderer lifecycle.
 *
 * Deep-linked and nothing else, exactly like the smoke route: no tab, no link,
 * no menu item. It exists so the ADR-111 gate can be run on the demo phone
 * without driving a whole tutor session first, and so a black frame can be
 * attributed to one layer instead of five.
 *
 * `React.lazy` for the same reason as the smoke route — importing the stage
 * installs `react-native-webgpu`'s JSI bindings and assigns `navigator.gpu`.
 * Expo Router evaluates the modules for routes it mounts, so a static import
 * would pay that cost at app boot for every learner.
 *
 * SOT: docs/decisions/adr-111-native-3d-runtime.md · qa/walkthroughs/NATIVE-3D-SMOKE-2026-09-03.md
 * SOT-KEYWORDS: natalie 3d route deep-link webgpu stage evidence adr-111 lazy
 */
import { Suspense, lazy, useState } from 'react';
import { View } from 'react-native';
import { Button, SafeArea, Text } from '@acme/ui';

/*
  The `.native` file by name, not by platform resolution. This route only ever
  runs on a device, and naming the file is what makes the import legible: the
  bare specifier would resolve to the web stub under any non-Metro tool that
  reads this file, and a route whose whole job is evidence should not depend on
  a resolver to pick the thing it is evidence for.
*/
const TutorAvatar3D = lazy(async () => ({
  default: (await import('@acme/app/features/tutor/tutor-avatar-3d.native.tsx'))
    .TutorAvatar3D,
}));

export default function Natalie3DRoute() {
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState('mounting…');

  return (
    <SafeArea edges={['top', 'bottom']} className="flex-1 bg-surface">
      <View className="gap-stack p-group">
        <Text variant="heading">Natalie — native stage</Text>
        <Text variant="caption" tone="muted">
          {status}
        </Text>
        <View className="flex-row gap-group">
          <Button
            title={speaking ? 'Stop speaking' : 'Speak'}
            onPress={() => setSpeaking((was) => !was)}
          />
        </View>
      </View>
      <View className="flex-1">
        <Suspense fallback={null}>
          <TutorAvatar3D
            active
            isSpeaking={speaking}
            /*
              No audio queue on this route, so the mouth is driven by a plain
              oscillator. It is a MOUTH test, not a lip-sync test: lip-sync is
              proven by the session path, where the sampler is the real one.
            */
            sampleMouth={(nowMs) =>
              speaking ? (Math.sin(nowMs / 90) * 0.5 + 0.5) ** 2 : 0
            }
            onFirstFrame={() => setStatus('first frame presented')}
            onUnavailable={(reason) => setStatus(`unavailable: ${reason}`)}
          />
        </Suspense>
      </View>
    </SafeArea>
  );
}
