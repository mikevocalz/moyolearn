'use client';
// District schools list screen — the first institutional data surface.
//
// This is still an early read: it shows the names of school organizations and
// will grow into a linked directory as the school-district relationship matures.
// SOT: packages/app/features/institution/schools.service.ts
// SOT-KEYWORDS: institution schools list screen district school directory

import type { OrgBranding } from '@acme/app';
import { Container, Heading, SafeArea } from '@acme/ui';
import { View, Text as TWText } from '@acme/ui/tw';

export interface SchoolListScreenProps {
  schools: OrgBranding[];
  org?: OrgBranding | null;
}

export function SchoolListScreen({ schools, org }: SchoolListScreenProps) {
  const title = org?.name ? `${org.name} — Schools` : 'Schools';
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <Container width="detail" className="py-4 pb-48">
        <View className="gap-stack">
          <Heading level={1} size="title">
            {title}
          </Heading>
          {schools.length === 0 ? (
            <TWText className="text-body text-text-muted">No schools have been added yet.</TWText>
          ) : (
            <View className="gap-group">
              {schools.map((school) => (
                <TWText key={school.slug} className="text-body text-text">
                  {school.name}
                </TWText>
              ))}
            </View>
          )}
        </View>
      </Container>
    </SafeArea>
  );
}
