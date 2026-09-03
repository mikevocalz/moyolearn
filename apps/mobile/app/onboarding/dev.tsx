// Mobile route: /onboarding/dev
//
// The QA hatch now carries the shell's app bar (root `_layout`) and, more
// importantly, a scroller. `DevPersonaSwitch` is a content component and this
// route used to re-export it bare, so on any device the eleven persona rows
// filled the viewport and pushed "Start as this persona" off the bottom with
// nothing to scroll — the switch could be *selected* but never *applied*. Same
// scaffold every other screen uses (View owns the ground, ScrollView the
// overflow, Container the measure); the header owns the top inset.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: route onboarding dev qa persona scaffold scroll

import { Container } from '@acme/ui';
import { ScrollView, View } from '@acme/ui/tw';
import { DevPersonaSwitch } from '@acme/app';

export default function DevPersonaRoute() {
  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <DevPersonaSwitch />
        </Container>
      </ScrollView>
    </View>
  );
}
