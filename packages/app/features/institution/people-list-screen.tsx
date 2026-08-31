'use client';
// Organization people list screen.
//
// Displays the members of a district or school with their names, emails, and
// membership roles. Falls back to an empty state when no members are present.
// SOT: packages/app/features/institution/people.service.ts
// SOT-KEYWORDS: institution people list screen members district school

import type { OrgBranding } from '@acme/app';
import { Container, Heading, SafeArea } from '@acme/ui';
import { View, Text as TWText } from '@acme/ui/tw';
import type { OrgMember } from './people.types.ts';

export interface PeopleListScreenProps {
  members: OrgMember[];
  org?: OrgBranding | null;
  kind: 'district' | 'school';
}

export function PeopleListScreen({ members, org, kind }: PeopleListScreenProps) {
  const title = org?.name ? `${org.name} — People` : 'People';
  const emptyCopy =
    kind === 'district'
      ? 'District staff and contacts will appear here.'
      : 'School staff, learners and guardians will appear here.';

  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <Container width="detail" className="py-4 pb-48">
        <View className="gap-stack">
          <Heading level={1} size="title">
            {title}
          </Heading>
          {members.length === 0 ? (
            <TWText className="text-body text-text-muted">{emptyCopy}</TWText>
          ) : (
            <View className="gap-group">
              {members.map((member) => (
                <View key={member.id} className="rounded-sheet bg-surface-raised p-4 gap-1">
                  <TWText className="text-base font-semibold text-text">{member.name}</TWText>
                  <TWText className="text-sm text-text-muted">{member.email}</TWText>
                  <TWText className="text-sm text-text-subtle capitalize">{member.role}</TWText>
                </View>
              ))}
            </View>
          )}
        </View>
      </Container>
    </SafeArea>
  );
}
