'use client';
// Institution placeholder screen — honest empty state for institutional routes
// that have not been built yet. It matches the District and School home shells
// so a missing tab renders as an intentional landing, not a broken page.
// SOT: packages/app/features/home/district-home-screen.tsx
// SOT-KEYWORDS: institution placeholder screen empty state district school

import { Container, Heading, SafeArea } from '@acme/ui';
import { View, Text as TWText } from '@acme/ui/tw';
import type { OrgBranding } from '@acme/app';

export interface InstitutionPlaceholderScreenProps {
  title: string;
  description: string;
  org?: OrgBranding | null;
}

export function InstitutionPlaceholderScreen({
  title,
  description,
  org,
}: InstitutionPlaceholderScreenProps) {
  const displayTitle = org?.name ? `${org.name} — ${title}` : title;
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <Container width="detail" className="py-4 pb-48">
        <View className="gap-stack">
          <Heading level={1} size="title">
            {displayTitle}
          </Heading>
          <TWText className="text-body text-text-muted">{description}</TWText>
        </View>
      </Container>
    </SafeArea>
  );
}
