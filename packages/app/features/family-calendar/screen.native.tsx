// FamilyCalendar screen — Native fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/pack/04-screen-briefs.md §S13
// SOT-KEYWORDS: family-calendar screen feature native

import { ScrollView, View } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { FamilyCalendarContent } from './family-calendar-content';

export function FamilyCalendarScreen() {
  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <FamilyCalendarContent />
        </Container>
      </ScrollView>
    </View>
  );
}
