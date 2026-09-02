'use client';
// StudentDetailScreen — the folded teacher.students surface (ADR-b: Students
// fold into Classes as list→detail; the disposition contract points here).
// Enrollment and learner BASICS only, as label/value facts. Two laws bound
// what this screen may ever grow: no safety or incident content renders here
// (incidents travel doc 31's channel; session reports reach teachers only via
// the tokened share.report), and no mastery or intervention exits exist to
// invent — J1's mastery insight and J4's intervention nodes are [M] with no
// inventory rows (contract Notes), so the facts card is the whole surface.
//
// Mobbin: https://mobbin.com/screens/9a075eb5-0300-4643-8517-2824b9022704 (Linktree —
//   member detail: name, status chip, then plain label/value fact rows) ·
//   https://mobbin.com/screens/69c66363-f48a-4354-823d-c9cadc19b160 (X —
//   about-your-account: avatar header over a deliberately sparse fact list) ·
//   https://mobbin.com/screens/35299c48-dbed-4582-acd2-800a3409854f (Kraken —
//   account details as label/value rows, "member since" as a first-class fact).
//   Structure only.
// SOT: design/screens/teacher/teacher.classes/contract.md · packages/app/features/enrollment/enrollment.types.ts
// SOT-KEYWORDS: student detail screen teacher enrollment basics facts folded no safety no mastery
import type { ReactNode } from 'react';
import {
  Avatar,
  Badge,
  Banner,
  Card,
  EmptyState,
  Heading,
  LoadingSkeleton,
  Text,
} from '@acme/ui';
import { User } from '@acme/ui/icons';
import { View } from '@acme/ui/primitives';
import { bandLabel } from './classes-content.tsx';
import { useClassRoster } from './use-classes.ts';

function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-group">
      <Text variant="label" tone="muted">
        {label}
      </Text>
      {children}
    </View>
  );
}

export function StudentDetailScreen({
  studentId,
  classId,
}: {
  studentId: string;
  classId?: string;
}) {
  /*
    Decision: the enrollment row is read THROUGH its class roster — no
    per-student API exists, and the contract's own-class wall makes the roster
    the only lawful door anyway (the service resolves ownership before the
    roster loads). That is why `classId` rides the route as a param and why a
    student link without one gets an instruction, not a spinner.
  */
  const { class: klass, roster, loading, error } = useClassRoster(classId ?? '');

  if (classId === undefined || classId.length === 0) {
    return (
      <View className="mx-auto w-full max-w-2xl px-inset py-section">
        <EmptyState
          icon={<User size={28} className="text-text-muted" />}
          title="Open this student from a class"
          description="A student detail is read through their class roster — pick the class first."
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="mx-auto w-full max-w-2xl gap-section px-inset py-section">
        <LoadingSkeleton count={2} />
      </View>
    );
  }

  const row = roster.find((enrollment) => enrollment.id === studentId) ?? null;

  if (klass === null || row === null) {
    // Same silent-drop copy discipline as the class detail: absent and
    // not-yours are indistinguishable on purpose.
    return (
      <View className="mx-auto w-full max-w-2xl px-inset py-section">
        <EmptyState
          icon={<User size={28} className="text-text-muted" />}
          title="Student not available"
          description="They may have left the class, or the link may be out of date."
        />
      </View>
    );
  }

  return (
    <View className="mx-auto w-full max-w-2xl gap-section px-inset py-section">
      {error !== null ? (
        <Banner
          tone="offline"
          title="Out of sync"
          description="Showing the last saved enrollment — it may be stale until you reconnect."
        />
      ) : null}

      <View className="flex-row items-center gap-group">
        <Avatar name={row.learnerAuthId} />
        <View className="flex-1 gap-0.5">
          <Heading level={1} size="title" className="text-text">
            Student
          </Heading>
          {/* The auth id as data, never dressed up as a name — see the roster's
              identity decision in class-detail-content.tsx. */}
          <Text variant="data" className="font-mono text-text-muted" selectable>
            {row.learnerAuthId}
          </Text>
        </View>
      </View>

      <Card className="gap-group">
        <Heading level={2} size="title" className="text-text">
          Enrollment
        </Heading>
        <FactRow label="Class">
          <View className="flex-row items-center gap-element">
            <Text variant="body" className="text-text">
              {klass.name}
            </Text>
            <Badge label={bandLabel(klass.gradeBand)} tone="neutral" />
          </View>
        </FactRow>
        <FactRow label="Status">
          <Badge
            label={row.status === 'active' ? 'Active' : 'Inactive'}
            tone={row.status === 'active' ? 'success' : 'neutral'}
          />
        </FactRow>
        <FactRow label="Enrolled">
          <Text variant="body" className="text-text">
            {new Date(row.enrolledAt).toLocaleDateString()}
          </Text>
        </FactRow>
        {row.exitedAt ? (
          <FactRow label="Left">
            <Text variant="body" className="text-text">
              {new Date(row.exitedAt).toLocaleDateString()}
            </Text>
          </FactRow>
        ) : null}
        {row.program ? (
          <FactRow label="Program">
            <Text variant="body" className="text-text">
              {row.program}
            </Text>
          </FactRow>
        ) : null}
      </Card>
    </View>
  );
}
