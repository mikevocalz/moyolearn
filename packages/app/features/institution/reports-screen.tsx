'use client';
// Institution reports screen — the first real reporting workspace.
//
// Renders the enrollment summary from the `enrollments` roster and honest
// "not yet available" states for metrics whose canonical source domains do not
// exist. No mock production numbers are ever shown.
// SOT: packages/app/features/institution/reports.service.ts · packages/app/features/institution/reports.types.ts
// SOT-KEYWORDS: reports screen enrollment summary unavailable metrics institution

import { Card, Container, Heading, SafeArea, StatCard } from '@acme/ui';
import { View, Text } from '@acme/ui/tw';
import type { OrgBranding } from '@acme/app';
import type { EnrollmentReport } from './reports.types.ts';

export interface InstitutionReportsScreenProps {
  title: string;
  org?: OrgBranding | null;
  report: EnrollmentReport;
}

const UNAVAILABLE_METRICS = [
  { label: 'Tutoring utilization', reason: 'Tutor session-to-roster joins are not yet enabled.' },
  { label: 'Skills mastery', reason: 'Skill mastery is stored per learner and not yet joined to schools.' },
  { label: 'Attendance', reason: 'No learner attendance records exist yet.' },
];

export function InstitutionReportsScreen({ title, org, report }: InstitutionReportsScreenProps) {
  const displayTitle = org?.name ? `${org.name} — ${title}` : title;

  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <Container width="detail" className="py-4 pb-48">
        <View className="gap-stack">
          <Heading level={1} size="title">
            {displayTitle}
          </Heading>

          <View className="gap-group">
            <Heading level={2} size="title">
              Enrollment
            </Heading>
            <View className="flex-row gap-group">
              <StatCard value={String(report.total)} label="Total learners" className="flex-1" />
              <StatCard value={String(report.active)} label="Active" className="flex-1" trendDirection="up" />
              <StatCard value={String(report.inactive)} label="Inactive" className="flex-1" trendDirection="flat" />
            </View>
          </View>

          {report.bySchool ? (
            <View className="gap-group">
              <Heading level={3} size="display-sm">
                By school
              </Heading>
              <View className="gap-group">
                {report.bySchool.map((school) => (
                  <Card key={school.slug} padded elevation="flat">
                    <View className="gap-element">
                      <Text className="text-heading font-semibold">{school.name}</Text>
                      <View className="flex-row gap-element">
                        <StatCard value={String(school.total)} label="Total" size="md" />
                        <StatCard value={String(school.active)} label="Active" size="md" trendDirection="up" />
                        <StatCard value={String(school.inactive)} label="Inactive" size="md" trendDirection="flat" />
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            </View>
          ) : null}

          <View className="gap-group">
            <Heading level={2} size="title">
              Other reports
            </Heading>
            {UNAVAILABLE_METRICS.map((metric) => (
              <Card key={metric.label} padded elevation="flat">
                <View className="gap-element">
                  <Text className="text-body font-semibold">{metric.label}</Text>
                  <Text className="text-caption text-text-muted">{metric.reason}</Text>
                </View>
              </Card>
            ))}
          </View>
        </View>
      </Container>
    </SafeArea>
  );
}
