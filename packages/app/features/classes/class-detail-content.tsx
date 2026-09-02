'use client';
// ClassDetailScreen — one class with its roster (teacher.classes detail, and
// the primary-action landing: "open a class → its roster"). The class code is
// the rostering affordance: FD-08's LearnerCodeEntry is the LEARNER's typing
// surface, so the teacher side's job is to make the code readable across a
// room (the HandoffCodePanel display idiom) with FD-23's grants copy under it
// — what joining gives, stated before anyone uses it. Roster rows are
// pane-aware on the reports idiom: inside an expanded host a student SELECTS
// into the detail pane (`classId:enrollmentId`); collapsed or hostless, it
// navigates to the folded teacher.students route.
//
// Mobbin: https://mobbin.com/screens/c4f8a5a9-caa1-479e-b942-5fa369422b4e (Abode —
//   the access code as the hero object with share-it-anyway-you-want guidance,
//   member list below) ·
//   https://mobbin.com/screens/5402ed0b-454c-4027-80d9-7e796468f91f (Lex —
//   group detail: members as avatar rows under the group header, roles as
//   trailing labels) ·
//   https://mobbin.com/screens/8afd44c1-a800-4b64-a597-0de766e87a66 (Duolingo —
//   join affordances stacked above the member rows, each stating what it does).
//   Structure only.
// SOT: design/screens/teacher/teacher.classes/contract.md · docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: class detail screen teacher roster class code join students enrollment pane
import { useRouter } from 'solito/navigation';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Heading,
  List,
  ListItem,
  LoadingSkeleton,
  Text,
  isCollapsed,
  useAdaptivePaneSelection,
  useWindowSizeClass,
} from '@acme/ui';
import { Users } from '@acme/ui/icons';
import { View } from '@acme/ui/primitives';
import { newAssignmentPath } from '../assignments/assign-paths';
import { joinOptions } from '../onboarding/teacher/steps.ts';
import { bandLabel } from './classes-content.tsx';
import { classesRootPath, studentDetailPath } from './classes-paths';
import { useClassRoster } from './use-classes.ts';

export function ClassDetailScreen({ classId }: { classId: string }) {
  const router = useRouter();
  const { class: klass, roster, loading, error, retry } = useClassRoster(classId);

  // Same pane-aware branch as the list (doc 37 §3.2): a student row selects
  // beside this detail on expanded widths, navigates everywhere else.
  const { select } = useAdaptivePaneSelection();
  const sizeClass = useWindowSizeClass();
  const paneOpen = select !== null && !isCollapsed(sizeClass);

  if (loading) {
    return (
      <View className="mx-auto w-full max-w-2xl gap-section px-inset py-section">
        <LoadingSkeleton count={3} />
      </View>
    );
  }

  if (error !== null && klass === null) {
    /*
      Error before not-found: a failed read also resolves to a null class, so
      without this branch the calm "not available" copy below would swallow
      every outage. "Not available" and "we could not check" are different
      sentences (the tutor-incidents rule) — the failed read gets a retry and
      a live exit back to the list, never the silent-drop copy.
    */
    return (
      <View className="mx-auto w-full max-w-2xl px-inset py-section">
        <Card className="gap-element">
          <Badge label="Not loaded" tone="attention" />
          <Text>We couldn&rsquo;t load this class.</Text>
          <Text variant="caption" tone="muted">
            Nothing has changed in the class — this screen just needs a connection.
          </Text>
          <View className="flex-row gap-group">
            <Button title="Try again" variant="outline" onPress={retry} />
            <Button
              title="Back to Classes"
              variant="ghost"
              onPress={() => {
                router.push(classesRootPath());
              }}
            />
          </View>
        </Card>
      </View>
    );
  }

  if (klass === null) {
    /*
      The service's silent-drop wall: a foreign class and a missing class both
      resolve to null, so this copy must not distinguish them — a
      distinguishable refusal would be an oracle over which class ids exist.
    */
    return (
      <View className="mx-auto w-full max-w-2xl px-inset py-section">
        <EmptyState
          icon={<Users size={28} className="text-text-muted" />}
          title="Class not available"
          description="It may have been archived, or the link may be out of date."
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
          description="Showing the last saved roster — it may be stale until you reconnect."
        />
      ) : null}

      <View className="gap-element">
        <View className="flex-row items-center justify-between gap-group">
          <Heading level={1} size="display-sm" className="text-text">
            {klass.name}
          </Heading>
          <Badge label={bandLabel(klass.gradeBand)} tone="neutral" />
        </View>
        {klass.subject ? (
          <Text variant="body" tone="muted">
            {klass.subject}
          </Text>
        ) : null}
      </View>

      {/* The contract's assign_to_class exit: the class rides along as a query
          param so the form's picker arrives pre-filled (teacher.assign
          entry_points). */}
      <Button
        title="Assign work to this class"
        variant="outline"
        className="self-start"
        onPress={() => {
          router.push(newAssignmentPath(classId));
        }}
      />

      <Card className="gap-group">
        <Heading level={2} size="title" className="text-text">
          How students join
        </Heading>
        {/*
          Decision: the code renders as the display moment (the HandoffCodePanel
          idiom — read aloud or projected) rather than through LearnerCodeEntry,
          which is the learner-side INPUT: redemption happens on the student's
          device via FD-08, and no code→class redemption API exists yet for this
          surface to submit to. When that endpoint lands, the learner front door
          consumes it — this card's job stays showing the code, so nothing here
          fakes a submit.
        */}
        <Text
          variant="data"
          selectable
          className="text-center font-mono text-4xl font-bold tracking-wider text-text"
        >
          {klass.code}
        </Text>
        {/* The band decides which routes in are lawful (FD-23) — each states
            what it grants before anyone uses it. */}
        {joinOptions(klass.gradeBand).map((option) => (
          <Text key={option.method} variant="caption" tone="muted">
            {option.label}: {option.grants}
          </Text>
        ))}
      </Card>

      <View className="gap-group">
        <Heading level={2} size="title" className="text-text">
          Roster
        </Heading>
        {roster.length === 0 ? (
          /* Contract no_data path: class with no students → roster prompt. */
          <EmptyState
            icon={<Users size={28} className="text-text-muted" />}
            title="No students yet"
            description={`Share the code ${klass.code} — students appear here when they join.`}
          />
        ) : (
          <List>
            {/*
              Decision: rows are labelled by the learner's auth id — Enrollment
              carries no display name and no teacher-side learner-profile read
              exists yet, so the id is the honest label until one lands. It is
              rendered as data, never dressed up as a name.
            */}
            {roster.map((row) => (
              <ListItem
                key={row.id}
                onPress={() => {
                  if (paneOpen) {
                    select(`${classId}:${row.id}`);
                    return;
                  }
                  router.push(studentDetailPath(row.id, classId));
                }}
                supportingText={`Enrolled ${new Date(row.enrolledAt).toLocaleDateString()}${
                  row.program ? ` · ${row.program}` : ''
                }`}
                trailing={
                  <Badge
                    label={row.status === 'active' ? 'Active' : 'Inactive'}
                    tone={row.status === 'active' ? 'success' : 'neutral'}
                  />
                }
              >
                {row.learnerAuthId}
              </ListItem>
            ))}
          </List>
        )}
      </View>
    </View>
  );
}
