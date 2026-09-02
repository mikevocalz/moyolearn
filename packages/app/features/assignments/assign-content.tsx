'use client';
// AssignScreen — teacher.assign's tracking list: everything the acting teacher
// has assigned, each row answering "what did I assign, to whom, and where does
// it stand" (status badge + plain-speech due). Create is one tap from anywhere
// on this screen (contract max_interactions_to_primary: 1). FilterBar carries
// the class/status controls but owns ZERO state — this screen's store does
// (FilterBar's state law); the class filter re-queries server-side through
// `useTeacherAssignments(classId)`, status narrows client-side over the same
// read. The two dead-end laws both land here: no assignments → the create form
// is the empty state's action; NO CLASSES → a routed exit to teacher.classes
// ("Set up a class first"), because an assignment without a class cannot be
// started honestly.
//
// Mobbin: https://mobbin.com/screens/5b76071b-1098-461d-b8e4-223c41bd02b2 (Notion —
//   to-do rows with due dates as one supporting line, filter + New controls in
//   a compact bar above the list) ·
//   https://mobbin.com/screens/90239de6-b830-4f42-9600-3a3f68424db6 (Google
//   Gemini — status segmented filter directly over the task list, empty state
//   in the list region) ·
//   https://mobbin.com/screens/8328b3df-6ac1-4f14-9170-9adc399cddd7 (Grab —
//   the create affordance rides the tracking surface itself, list grouped
//   under it). Structure only.
// SOT: design/screens/teacher/teacher.assign/contract.md · packages/app/features/classes/classes-content.tsx
// SOT-KEYWORDS: assign screen teacher tracking list assignments status filter due create empty offline
import { useRouter } from 'solito/navigation';
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  FilterBar,
  Heading,
  List,
  ListItem,
  LoadingSkeleton,
  Menu,
  SegmentedControl,
  Text,
} from '@acme/ui';
import { GraduationCap, ListChecks } from '@acme/ui/icons';
import { View } from '@acme/ui/primitives';
import { classesRootPath } from '../classes/classes-paths';
import { useTeacherClasses } from '../classes/use-classes.ts';
import { STATUS_BADGE, dueLabel } from './assign-copy.ts';
import { assignmentDetailPath, newAssignmentPath } from './assign-paths';
import { useAssignStore, type AssignStatusFilter } from './assign.store.ts';
import { useTeacherAssignments } from './use-assignments.ts';

const STATUS_OPTIONS: readonly { value: AssignStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'published', label: 'Published' },
  { value: 'closed', label: 'Closed' },
];

export function AssignScreen() {
  const router = useRouter();
  const { classes, loading: classesLoading } = useTeacherClasses();
  const statusFilter = useAssignStore((s) => s.statusFilter);
  const classFilter = useAssignStore((s) => s.classFilter);
  const setStatusFilter = useAssignStore((s) => s.setStatusFilter);
  const setClassFilter = useAssignStore((s) => s.setClassFilter);
  const { assignments, loading, error } = useTeacherAssignments(classFilter ?? undefined);

  const visible =
    statusFilter === 'all' ? assignments : assignments.filter((a) => a.status === statusFilter);
  const classNames = new Map(classes.map((klass) => [klass.id, klass.name]));
  const activeFilters = (statusFilter !== 'all' ? 1 : 0) + (classFilter !== null ? 1 : 0);
  // No classes is decided only once the classes read has answered — a slow
  // read must not flash the "set up a class" exit at a teacher who has five.
  const noClasses = !classesLoading && classes.length === 0;

  return (
    <View className="mx-auto w-full max-w-2xl gap-section px-inset py-section">
      <View className="gap-element">
        <Heading level={1} size="display-sm" className="text-text">
          Assign
        </Heading>
        <Text variant="body" tone="muted">
          Work you’ve assigned, and where each piece stands.
        </Text>
      </View>

      {/* Contract offline path: reads keep serving the cached list, labelled
          stale — the banner is the label, never a blocking state. Publishing
          lives on the form and detail; each fails visibly there. */}
      {error !== null ? (
        <Banner
          tone="offline"
          title="Out of sync"
          description="Showing the last saved list — it may be stale until you reconnect."
        />
      ) : null}

      {loading || classesLoading ? (
        <LoadingSkeleton count={3} />
      ) : noClasses ? (
        /* Contract no_data path, class half: a routed exit, never a dead end —
           the create form cannot be offered honestly with nothing to assign to. */
        <EmptyState
          icon={<GraduationCap size={28} className="text-text-muted" />}
          title="Set up a class first"
          description="Assignments go to a class. Create one, and students join it with its class code."
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
          <Button
            title="Create an assignment"
            variant="primary"
            className="self-start"
            onPress={() => {
              router.push(newAssignmentPath());
            }}
          />

          {/* The bar earns its row only when there is something to narrow —
              over an empty list it is noise (the FilterBar zero-badge law). */}
          {assignments.length > 0 || activeFilters > 0 ? (
            <FilterBar
              activeCount={activeFilters}
              onClearAll={() => {
                setStatusFilter('all');
                setClassFilter(null);
              }}
            >
              <SegmentedControl options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
              {/*
                The class picker changes shape with the roster size. A
                SegmentedControl is a closed, glanceable set — right for the
                status enum and for a couple of classes — but every class adds
                a segment, and past three the row outgrows the bar (segments
                elide or shove Clear-all off-screen). Beyond that the picker
                becomes FilterBar's Menu-anchored chip (the FilterBar slot
                contract names it): one chip stating the current choice, the
                list behind it.
              */}
              {classes.length > 1 && classes.length <= 3 ? (
                <SegmentedControl
                  options={[
                    { value: '', label: 'All classes' },
                    ...classes.map((klass) => ({ value: klass.id, label: klass.name })),
                  ]}
                  value={classFilter ?? ''}
                  onChange={(value) => {
                    setClassFilter(value === '' ? null : value);
                  }}
                />
              ) : classes.length > 3 ? (
                <Menu
                  title="Class"
                  actions={[
                    // The current choice stays listed but inert (the leads
                    // stage-menu rule): removing it would shuffle the list
                    // under the cursor every time the value changed.
                    { id: '', title: 'All classes', disabled: classFilter === null },
                    ...classes.map((klass) => ({
                      id: klass.id,
                      title: klass.name,
                      disabled: classFilter === klass.id,
                    })),
                  ]}
                  onAction={(id) => {
                    setClassFilter(id === '' ? null : id);
                  }}
                >
                  {/*
                    A styled View, NOT the kit Button: Menu's web fork is a
                    details/summary, and a real <button> inside <summary>
                    consumes the click so the menu never opens (the
                    leads-content Display-menu precedent).
                  */}
                  <View className="min-h-target-adult flex-row items-center gap-element rounded-control border-2 border-border-strong bg-surface-raised px-4 shadow-card">
                    <Text className="text-sm font-semibold text-text">
                      {classNames.get(classFilter ?? '') ?? 'All classes'}
                    </Text>
                    <Text aria-hidden className="text-caption text-text-muted">
                      ▾
                    </Text>
                  </View>
                </Menu>
              ) : null}
            </FilterBar>
          ) : null}

          {visible.length === 0 ? (
            assignments.length === 0 ? (
              /* Contract no_data path, assignment half: create is one tap away. */
              <EmptyState
                icon={<ListChecks size={28} className="text-text-muted" />}
                title="No assignments yet"
                description="Create one — it stays a draft until you publish it to a class."
                action={
                  <Button
                    title="Create an assignment"
                    variant="outline"
                    onPress={() => {
                      router.push(newAssignmentPath());
                    }}
                  />
                }
              />
            ) : (
              <EmptyState
                icon={<ListChecks size={28} className="text-text-muted" />}
                title="Nothing matches these filters"
                description="Clear them to see everything you’ve assigned."
              />
            )
          ) : (
            <List>
              {visible.map((assignment) => (
                <ListItem
                  key={assignment.id}
                  onPress={() => {
                    router.push(assignmentDetailPath(assignment.id));
                  }}
                  /* Completion is counts-only supporting text — "3 of 24
                     done" in the same muted register as the due date, never a
                     red number or a warning tone for low counts: the no-shame
                     register holds on teacher surfaces too, and the server
                     never sends a per-student list anyway. Drafts have no
                     audience yet, so they carry no count. */
                  supportingText={`${dueLabel(assignment.dueAt)} · ${
                    classNames.get(assignment.classId) ?? 'Class'
                  }${assignment.subject ? ` · ${assignment.subject}` : ''}${
                    assignment.status !== 'draft'
                      ? ` · ${assignment.doneCount} of ${assignment.rosterCount} done`
                      : ''
                  }`}
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
        </>
      )}
    </View>
  );
}
