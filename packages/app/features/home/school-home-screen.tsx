'use client';
// School Home — the school-admin shell's landing tab.
// Honest empty state: this slice does not wire campuses or programs yet, but it
// makes the school shell reachable and fail-closed.
// SOT: docs/pack/36-role-navigation-flows.md §3.4
// SOT-KEYWORDS: school home screen admin shell landing empty

import { ScrollView, View, Text as TWText } from '@acme/ui/tw';
import { Container, Heading, SafeArea } from '@acme/ui';
import type { OrgBranding } from '@acme/app';

export function SchoolHomeScreen({ org }: { org?: OrgBranding | null }) {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <View className="gap-stack">
            <Heading level={1} size="title">
              {org?.name ? `${org.name} — School overview` : 'School overview'}
            </Heading>
            <TWText className="text-body text-text">
              School overview will list campuses, staff, and programs.
            </TWText>
            {/*
              The copy states the CONTRACT's reality, not a struck plan: the
              school shell is web-first, and its rail is Overview · People ·
              Reports (nav.ts ADR-103 — Academics returns to the rail only when
              built; there is no "More" tab and never was one shipped). The old
              paragraph advertised a five-tab set that was struck, which made
              this screen a promise the product had already withdrawn.
            */}
            <TWText className="text-body text-text-muted">
              For now, this is the school-admin shell&apos;s landing screen. The web rail runs
              Overview, People, and Reports.
            </TWText>
          </View>
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
