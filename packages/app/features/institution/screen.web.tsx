// Institution screen — Web fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/pack/09-screens-first-build-order.md
// SOT-KEYWORDS: institution screen feature web

import { View } from '@acme/ui/tw';
import { Text } from '@acme/ui';

export function InstitutionScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <Text>Institution</Text>
    </View>
  );
}
