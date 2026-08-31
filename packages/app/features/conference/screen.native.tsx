// Conference screen — Native fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/pack/09-screens-first-build-order.md
// SOT-KEYWORDS: conference screen feature native

import { View } from 'react-native';
import { Text } from '@acme/ui';

export function ConferenceScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <Text>Conference</Text>
    </View>
  );
}
