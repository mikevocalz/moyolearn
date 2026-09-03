'use client';
// Teacher Home — the classroom-teacher shell's landing tab, as an actual
// overview: the classes the teacher runs (the same read Classes renders) and
// the due-soon slice of what they've assigned, each row a live door into its
// own surface. The ≤1-tap primary action is opening today's first class —
// its roster is where a teacher's day starts. Conferences keeps its entry
// point here: it is a stack route per ADR-102 (demoted from the tab bar), so
// Home carries the contract's `push_conference` exit, forked per platform
// through conference-paths.
// SOT: docs/pack/36-role-navigation-flows.md §3.3 · docs/decisions/adr-102-teacher-shell-ia.md
// SOT-KEYWORDS: teacher home screen classroom shell landing overview classes due soon conference

import { useRouter } from 'solito/navigation';
import { ScrollView, View, Text as TWText } from '@acme/ui/tw';
import {
  Badge,
  Banner,
  Button,
  Container,
  EmptyState,
  Heading,
  List,
  ListItem,
  LoadingSkeleton,
  PressScale,
  ReadFailure,
  SafeArea,
  Text,
} from '@acme/ui';
import { ArrowRight, GraduationCap, Video } from '@acme/ui/icons';
import { STATUS_BADGE, dueLabel } from '../assignments/assign-copy.ts';
import { assignmentDetailPath } from '../assignments/assign-paths';
import { useTeacherAssignments } from '../assignments/use-assignments.ts';
import { bandLabel } from '../classes/classes-content.tsx';
import { classDetailPath, classesRootPath } from '../classes/classes-paths';
import { useTeacherClasses } from '../classes/use-classes.ts';
import { conferenceHubPath } from '../conference';

/** Due-soon is the published slice, soonest first — drafts have no audience
 * and closed work is finished business, so neither belongs on a landing read. */
const DUE_SOON_COUNT = 3;

export function TeacherHomeScreen() {
  const router = useRouter();
  const { classes, loading: classesLoading, error: classesError, retry } = useTeacherClasses();
  const {
    assignments,
    loading: assignmentsLoading,
    error: assignmentsError,
    retry: retryAssignments,
  } = useTeacherAssignments();

  const active = classes.filter((klass) => klass.status === 'active');
  const dueSoon = assignments
    .filter((assignment) => assignment.status === 'published')
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
    .slice(0, DUE_SOON_COUNT);
  const loading = classesLoading || assignmentsLoading;
  // keepPreviousData means an errored read can still hold yesterday's list —
  // stale-with-label (the classes-content offline idiom). Only a cold failure
  // with nothing cached gets the blocking error branch below.
  const staleSomewhere =
    (classesError !== null && classes.length > 0) ||
    (assignmentsError !== null && assignments.length > 0);

  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <View className="gap-section">
            <View className="gap-element">
              <Heading level={1} size="title">
                Teacher home
              </Heading>
              <Text variant="body" tone="muted">
                Your classes and what&rsquo;s due soon.
              </Text>
            </View>

            {staleSomewhere ? (
              <Banner
                tone="offline"
                title="Out of sync"
                description="Showing the last saved overview — it may be stale until you reconnect."
              />
            ) : null}

            {loading ? (
              <LoadingSkeleton count={3} />
            ) : classesError !== null && classes.length === 0 ? (
              /*
                Error before empty (the tutor-incidents rule): "no classes" and
                "we could not check" are different sentences, so a cold failed
                read gets the retry — never the calm create-a-class prompt.
              */
              <ReadFailure
                title="We couldn't load your classes."
                description="Nothing has changed in your classroom — this screen just needs a connection."
                onRetry={retry}
                action={
                  <Button
                    title="Go to Classes"
                    variant="ghost"
                    onPress={() => {
                      router.push(classesRootPath());
                    }}
                  />
                }
              />
            ) : active.length === 0 ? (
              /* No classes is a routed exit, never a dead end — the create
                 form lives on the Classes tab (its always-rendered card). */
              <EmptyState
                icon={<GraduationCap size={28} className="text-text-muted" />}
                title="No classes yet"
                description="Set up your first class — students join it with its class code, and your day starts here."
                action={
                  <Button
                    title="Go to Classes"
                    variant="primary"
                    onPress={() => {
                      router.push(classesRootPath());
                    }}
                  />
                }
              />
            ) : (
              <>
                <View className="gap-group">
                  <Heading level={2} size="title" className="text-text">
                    Today&rsquo;s classes
                  </Heading>
                  {/* The contract's primary action: open the first class →
                      its roster (classes carry no timetable yet, so "first"
                      is list order — the same order Classes renders). */}
                  <Button
                    title={`Open ${active[0]?.name ?? 'your first class'}`}
                    variant="primary"
                    className="self-start"
                    onPress={() => {
                      const first = active[0];
                      if (first) router.push(classDetailPath(first.id));
                    }}
                  />
                  <List>
                    {active.map((klass) => (
                      <ListItem
                        key={klass.id}
                        onPress={() => {
                          router.push(classDetailPath(klass.id));
                        }}
                        supportingText={`${klass.subject ? `${klass.subject} · ` : ''}Join code ${klass.code}`}
                        trailing={<Badge label={bandLabel(klass.gradeBand)} tone="neutral" />}
                      >
                        {klass.name}
                      </ListItem>
                    ))}
                  </List>
                </View>

                <View className="gap-group">
                  <Heading level={2} size="title" className="text-text">
                    Due soon
                  </Heading>
                  {assignmentsError !== null && assignments.length === 0 ? (
                    /* Same error-before-empty rule as the classes read: a
                       failed check must not read as a clear desk — and it owes
                       the same retry, since this strip failing while the class
                       list loaded is exactly the case a re-read fixes. */
                    <ReadFailure
                      title="We couldn't check what's due."
                      description="Nothing has been published or withdrawn — only this strip is missing."
                      onRetry={retryAssignments}
                    />
                  ) : dueSoon.length === 0 ? (
                    <Text variant="body" tone="muted">
                      Nothing published is due soon. Assignments you publish show up here as their
                      due dates approach.
                    </Text>
                  ) : (
                    <List>
                      {dueSoon.map((assignment) => (
                        <ListItem
                          key={assignment.id}
                          onPress={() => {
                            router.push(assignmentDetailPath(assignment.id));
                          }}
                          supportingText={`${dueLabel(assignment.dueAt)} · ${assignment.doneCount} of ${assignment.rosterCount} done`}
                          trailing={
                            <Badge
                              label={STATUS_BADGE[assignment.status].label}
                              tone={STATUS_BADGE[assignment.status].tone}
                            />
                          }
                        >
                          {assignment.title}
                        </ListItem>
                      ))}
                    </List>
                  )}
                </View>
              </>
            )}

            <PressScale
              onPress={() => router.push(conferenceHubPath())}
              className="w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-4"
              outerClassName="w-full"
              aria-label="Conferences, upcoming and scheduled"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-surface-sunken">
                <Video size={20} className="text-text" />
              </View>
              <View className="flex-1 gap-0.5">
                <TWText className="text-base font-semibold text-text">Conferences</TWText>
                <TWText className="text-sm text-text-muted">Upcoming and scheduled</TWText>
              </View>
              <ArrowRight size={18} className="text-text-muted" />
            </PressScale>
          </View>
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
