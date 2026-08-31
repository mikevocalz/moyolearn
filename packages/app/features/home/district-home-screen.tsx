'use client';
// District Home — the district-admin shell's landing tab.
// Honest empty state: this slice does not wire schools or district programs yet,
// but it makes the district shell reachable and fail-closed.
// SOT: docs/pack/36-role-navigation-flows.md §3.4
// SOT-KEYWORDS: district home screen admin shell landing empty

import { ScrollView, View, Text as TWText } from '@acme/ui/tw';
import { Container, Heading, SafeArea } from '@acme/ui';
import type { OrgBranding } from '@acme/app';

export function DistrictHomeScreen({ org }: { org?: OrgBranding | null }) {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <View className="gap-stack">
            <Heading level={1} size="title">
              {org?.name ? `${org.name} — District overview` : 'District overview'}
            </Heading>
            <TWText className="text-body text-text">
              District overview will list schools, campuses, and programs.
            </TWText>
            <TWText className="text-body text-text-muted">
              For now, this is the district-admin shell's landing screen. The planned tabs are
              Overview, Schools, Programs, Calendar, and More.
            </TWText>
          </View>
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
