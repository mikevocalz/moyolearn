'use client';
// District schools list screen — the first institutional data surface.
//
// Rows are DOORS now, not names: each school links to its overview at
// /schools/[slug] (the (school) route group serves it), because a directory a
// district admin can read but not enter is a list of dead ends. Loading and
// error live at the route level — the (district) group's loading.tsx and
// error.tsx wrap this server-fed segment, so a slow or failed load renders
// the skeleton / ErrorScreen there rather than a second copy here.
// SOT: packages/app/features/institution/schools.service.ts · apps/web/app/(school)/schools/[schoolSlug]/page.tsx
// SOT-KEYWORDS: institution schools list screen district school directory link door
import { Link } from 'solito/link';
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
                <Link
                  key={school.slug}
                  href={`/schools/${encodeURIComponent(school.slug)}`}
                  aria-label={`Open school: ${school.name}`}
                >
                  <View className="min-h-target-adult flex-row items-center rounded-card border-2 border-border bg-surface-raised p-inset shadow-card">
                    <TWText className="text-body font-semibold text-text underline decoration-border-strong underline-offset-2">
                      {school.name}
                    </TWText>
                  </View>
                </Link>
              ))}
            </View>
          )}
        </View>
      </Container>
    </SafeArea>
  );
}
