'use client';
// district.schools — the district rail's roster of its schools.
//
// Rows are DOORS, not names: each school links to its overview at
// /schools/[slug] (the (school) route group serves it), because a directory a
// district admin can read but not enter is a list of dead ends.
//
// The read arrives CLASSIFIED (`InstitutionRead`), not as a bare array. It used
// to arrive as `OrgBranding[]` with the refusal thrown past it, so the group's
// error.tsx answered "Something broke on our end" with a reference id for a
// read that was working exactly as designed — and, worse, an unreadable roster
// and a genuinely unrostered district both rendered "No schools have been added
// yet." A district admin cannot tell those apart, and only one of them is a
// fact about their district. `denied` never reaches here at all: the page turns
// it into a silent not-found (contract permission path), because a 403 body
// tells a stranger the route exists.
// SOT: design/screens/district/district.schools/contract.md · packages/app/features/institution/schools.service.ts
// SOT-KEYWORDS: institution schools list screen district directory door read union unavailable empty rostering
// Mobbin: https://mobbin.com/screens/895f2118-fbd3-4ef7-8c09-c474432fee9c (Plain
//   — Companies: the empty answer sits INSIDE the list's own framed panel, so
//   the page keeps its shape whether there are rows or none) ·
//   https://mobbin.com/screens/cf035a22-6c20-4a04-9af0-2bef92fef8e8 (GitHub
//   Organizations — empty block carries the sentence and the ways forward
//   together, side by side beneath it) ·
//   https://mobbin.com/screens/3e18c118-95a2-4448-af5f-e78a0b148442 (Front —
//   list header states the count above the run; the empty body offers one
//   explanatory link and one action, not a wall of options) ·
//   https://mobbin.com/screens/dff672c8-505a-46a3-a637-c3c7a01d0ed6 (Remote —
//   a failed read states itself as a title + one line + a retry beside a way
//   back, never as a bare blank region). Structure only.
import { Link } from 'solito/link';
import { useRouter } from 'solito/navigation';
import type { OrgBranding } from '@acme/app';
import { Button, Container, EmptyState, Heading, ReadFailure, SafeArea } from '@acme/ui';
import { GraduationCap } from '@acme/ui/icons';
import { View, Text as TWText } from '@acme/ui/tw';
import type { InstitutionRead } from './institution.types.ts';

export interface SchoolListScreenProps {
  /** The roster read — `ok` may still be empty, which is a state, not a failure. */
  schools: InstitutionRead<OrgBranding[]>;
  org?: OrgBranding | null;
  /**
   * Re-runs the SERVER read. Required, not optional: the failure state's whole
   * job is offering a retry, and an optional handler would let a caller mount
   * a screen whose recovery button does nothing — the dead control this file
   * was rewritten to remove. The route owns it (`schools-view.tsx`).
   */
  onRetry: () => void;
}

export function SchoolListScreen({ schools, org, onRetry }: SchoolListScreenProps) {
  const router = useRouter();
  /*
    The district's name rides the heading ONLY when the roster is readable.
    Branding over an unavailable list is the contract's "no cached-stale
    aggregates presented as fresh" in miniature — a confident title makes the
    blank underneath it look like the answer.
  */
  const title = schools.state === 'ok' && org?.name ? `${org.name} — Schools` : 'Schools';

  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <Container width="detail" className="py-4 pb-48">
        <View className="gap-stack">
          <Heading level={1} size="title">
            {title}
          </Heading>

          {schools.state === 'unavailable' ? (
            /*
              The kit's read-failure block — the one place the "answered zero"
              vs "could not check" split is drawn (packages/ui/ReadFailure.tsx).
              No `readFailureCopy` here: that reads a CLIENT `ApiError`, and
              this read ran on the server, where the cause was already collapsed
              to `unavailable` so no refusal detail crosses the boundary.
            */
            <ReadFailure
              title="We couldn’t load your schools"
              description="This is not an empty district — the roster read didn’t complete, so nothing here is a count."
              onRetry={onRetry}
              /* The roll-up exit the contract names, live on every state: a
                 district admin who cannot read this list still has somewhere
                 to be. */
              action={
                <Button
                  title="Back to Outcomes"
                  variant="ghost"
                  onPress={() => router.push('/')}
                />
              }
            />
          ) : schools.state === 'ok' && schools.data.length === 0 ? (
            /*
              The contract's no_data path: "No schools rostered → empty state
              with rostering guidance". It used to be one flat sentence with no
              guidance and no way forward — an honest absence that was still a
              dead end.
            */
            <EmptyState
              icon={<GraduationCap size={28} className="text-text-muted" />}
              title="No schools rostered yet"
              description="Schools appear here once they’re added to this district. Rostering is done by Moyo support today — send the school names and we’ll create them."
              action={
                <Button
                  title="Back to Outcomes"
                  variant="outline"
                  onPress={() => router.push('/')}
                />
              }
            />
          ) : (
            <View className="gap-group">
              {(schools.state === 'ok' ? schools.data : []).map((school) => (
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
