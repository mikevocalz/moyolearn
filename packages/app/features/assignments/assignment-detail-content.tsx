'use client';
// AssignmentDetailScreen — one assignment: status, class, due date, work
// items, and the lifecycle actions its status allows (edit or publish a
// draft, close a published one, extend any — extending a closed one reopens
// it, which is what "extend" means to a teacher who closed a day early).
// Edit is drafts-only: published fields are what students already see, and
// the service refuses to rewrite them. A null read is the
// service's silent-drop wall, worded exactly like the class detail's: a
// foreign assignment and a missing one must be indistinguishable (contract
// permission path, doc 36 §4.4). Completion shows as "X of Y done" — a
// count, stated calmly beside the due date; the per-student done/not-done
// roster is deliberately NOT here (the service's counts-only decision), and
// this screen could not render one even if it wanted to.
//
// Mobbin: https://mobbin.com/screens/d9dd215f-8a48-4fb6-8c27-6345695241d7 (ShopBack —
//   item detail: work steps as a checklist card, the window's dates in an
//   Overview block below) ·
//   https://mobbin.com/screens/c865e313-ce06-40b4-bdf6-0c3498e4bbb9 (Garmin
//   Connect — title + status line lead, the requirement rows listed plainly) ·
//   https://mobbin.com/screens/a121c71f-f680-42ea-b08f-c491427e01a3 (GitHub —
//   status object with its action row beneath the summary, items as rows).
//   Structure only.
// SOT: design/screens/teacher/teacher.assign/contract.md · packages/app/features/classes/class-detail-content.tsx
// SOT-KEYWORDS: assignment detail screen teacher status edit publish close extend due work items lifecycle
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
  notify,
  useAppForm,
} from '@acme/ui';
import { ListChecks } from '@acme/ui/icons';
import { View } from '@acme/ui/primitives';
import { useTeacherClasses } from '../classes/use-classes.ts';
import { STATUS_BADGE, dueLabel } from './assign-copy.ts';
import { assignRootPath, editAssignmentPath } from './assign-paths';
import type { Assignment } from './assignments.types.ts';
import { useAssignment, useAssignmentAction } from './use-assignments.ts';

export function AssignmentDetailScreen({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const { assignment, loading, error } = useAssignment(assignmentId);
  const { classes } = useTeacherClasses();
  const lifecycle = useAssignmentAction();

  if (loading) {
    return (
      <View className="mx-auto w-full max-w-2xl gap-section px-inset py-section">
        <LoadingSkeleton count={3} />
      </View>
    );
  }

  if (assignment === null) {
    /*
      The service's silent-drop wall: a foreign assignment and a missing one
      both resolve to null, so this copy must not distinguish them — a
      distinguishable refusal would be an oracle over which ids exist.
    */
    return (
      <View className="mx-auto w-full max-w-2xl px-inset py-section">
        <EmptyState
          icon={<ListChecks size={28} className="text-text-muted" />}
          title="Assignment not available"
          description="It may have been removed, or the link may be out of date."
        />
      </View>
    );
  }

  const className = classes.find((klass) => klass.id === assignment.classId)?.name ?? 'Class';
  const status = STATUS_BADGE[assignment.status];

  const runAction = async (action: 'publish' | 'close', doneNote: string) => {
    try {
      await lifecycle.mutateAsync({ assignmentId, action });
      notify.success(doneNote);
      if (action === 'publish') router.replace(assignRootPath());
    } catch {
      // The Banner below reports it — swallowed so it isn't reported twice.
    }
  };

  return (
    <View className="mx-auto w-full max-w-2xl gap-section px-inset py-section">
      {error !== null ? (
        <Banner
          tone="offline"
          title="Out of sync"
          description="Showing the last saved version — it may be stale until you reconnect."
        />
      ) : null}

      {/* Contract failure path: a failed action changed nothing — the row is
          exactly as listed, and the same button is the retry. */}
      {lifecycle.isError ? (
        <Banner
          tone="warning"
          title="That didn't go through"
          description="Nothing changed. Check your connection and try again."
        />
      ) : null}

      <View className="gap-element">
        <View className="flex-row items-center justify-between gap-group">
          <Heading level={1} size="display-sm" className="text-text">
            {assignment.title}
          </Heading>
          <Badge label={status.label} tone={status.tone} />
        </View>
        <Text variant="body" tone="muted">
          {className}
          {assignment.subject ? ` · ${assignment.subject}` : ''}
        </Text>
        <Text variant="body" className="text-text">
          {dueLabel(assignment.dueAt)}
        </Text>
        {/* Counts-only, in the same muted voice as the class line — never a
            red number for a low count (no-shame register, teacher side), and
            never a per-student list (that waits for a contract row; see
            assignments.service.ts). A draft has no audience yet, so no count. */}
        {assignment.status !== 'draft' ? (
          <Text variant="body" tone="muted">
            {assignment.doneCount} of {assignment.rosterCount} done
          </Text>
        ) : null}
      </View>

      <View className="gap-group">
        <Heading level={2} size="title" className="text-text">
          What&rsquo;s in it
        </Heading>
        <List>
          {assignment.workItems.map((item, index) => (
            <ListItem
              key={`${item.templateId ?? item.title}-${index}`}
              supportingText={`${item.description ? `${item.description} · ` : ''}About ${item.minutes} min`}
            >
              {item.title}
            </ListItem>
          ))}
        </List>
      </View>

      <Card className="gap-group">
        <Heading level={2} size="title" className="text-text">
          {assignment.status === 'draft' ? 'Publish' : 'Manage'}
        </Heading>

        {assignment.status === 'draft' ? (
          <>
            <Text variant="caption" tone="muted">
              Only you can see a draft. Publishing sends it to {className}.
            </Text>
            <Button
              title="Publish"
              variant="primary"
              loading={lifecycle.isPending}
              onPress={() => {
                // The contract's propagation-naming confirmation, verbatim.
                void runAction(
                  'publish',
                  `Assigned to ${className}; it will appear on students' plans`,
                );
              }}
            />
            <Button
              title="Edit draft"
              variant="outline"
              disabled={lifecycle.isPending}
              onPress={() => {
                router.push(editAssignmentPath(assignment.id));
              }}
            />
          </>
        ) : null}

        {assignment.status === 'published' ? (
          <>
            <Text variant="caption" tone="muted">
              Closing ends it early — students stop seeing it as due work.
            </Text>
            <Button
              title="Close assignment"
              variant="outline"
              loading={lifecycle.isPending}
              onPress={() => {
                void runAction('close', 'Assignment closed');
              }}
            />
          </>
        ) : null}

        <ExtendDueDate assignment={assignment} lifecycle={lifecycle} />
      </Card>
    </View>
  );
}

/**
 * The extend action as its own small form (the create form's due-date idiom):
 * a new date, validated before the PATCH exists. Rendered for every status —
 * extending a closed assignment reopens it, and the hint says so before the
 * teacher finds out by surprise.
 */
function ExtendDueDate({
  assignment,
  lifecycle,
}: {
  assignment: Assignment;
  lifecycle: ReturnType<typeof useAssignmentAction>;
}) {
  const form = useAppForm({
    defaultValues: { dueAt: '' },
    onSubmit: async ({ value }) => {
      try {
        const updated = await lifecycle.mutateAsync({
          assignmentId: assignment.id,
          action: 'extend',
          dueAt: value.dueAt.trim(),
        });
        notify.success(`Due date moved — now ${dueLabel(updated.dueAt).toLowerCase()}`);
        form.reset();
      } catch {
        // The screen's Banner reports it — swallowed so it isn't reported twice.
      }
    },
  });

  return (
    <View className="gap-stack">
      <form.AppField
        name="dueAt"
        validators={{
          onChange: ({ value }) =>
            Number.isNaN(Date.parse(value)) ? 'A date like 2026-09-15' : undefined,
        }}
      >
        {(field) => (
          <field.TextField
            label="New due date"
            hint={
              assignment.status === 'closed'
                ? 'YYYY-MM-DD. Extending a closed assignment reopens it.'
                : 'YYYY-MM-DD.'
            }
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton title="Extend due date" variant="outline" />
      </form.AppForm>
    </View>
  );
}
