'use client';
// AssignmentFormScreen — teacher.assign's create form: class, title, subject,
// due date, work items → save as draft or publish. The Add-a-class card's twin
// (classes-content.tsx): TanStack Form owns field state (repo rule, never
// React state), the mutations own success/failure, and failure surfaces as a
// sibling Banner while onSubmit swallows the throw. Every change mirrors into
// assign.store, so backing out KEEPS the draft (contract back_behavior:
// "drafts are kept, never silently discarded") and a reopened form resumes it.
// Work items seed from FD-23's ASSIGNMENT_TEMPLATES — the same "hand over
// finished work, not a blank composer" reasoning as onboarding's last step —
// plus a write-your-own composer. Publish is create-then-publish: a failed
// publish leaves the created row a DRAFT on the tracking list (contract
// publish_failed, "never half-published") and retries publish that same row.
//
// Mobbin: https://mobbin.com/screens/bca4b5b6-00a3-45dc-8347-e09c3f424734 (Grab —
//   Save draft beside the primary publish action at the form's foot, suggested
//   chips seeding content above them) ·
//   https://mobbin.com/screens/d10d50fb-9808-4970-b8cf-fa963fd603e3 (Slopes —
//   name and dates lead, then an add-rows section for the composed items) ·
//   https://mobbin.com/screens/20bbc487-06ad-40ec-93a8-cccea8991578 (Vestiaire
//   Collective — a draft-keeping create flow: leaving saves, nothing is lost).
//   Structure only.
// SOT: design/screens/teacher/teacher.assign/contract.md · packages/app/features/classes/classes-content.tsx
// SOT-KEYWORDS: assignment form screen teacher create draft publish work items templates due class picker
import { useEffect } from 'react';
import { useRouter } from 'solito/navigation';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Heading,
  LoadingSkeleton,
  PressScale,
  Text,
  notify,
  useAppForm,
  useFormStore,
} from '@acme/ui';
import { GraduationCap } from '@acme/ui/icons';
import { View } from '@acme/ui/primitives';
import { classesRootPath } from '../classes/classes-paths';
import { useTeacherClasses } from '../classes/use-classes.ts';
import { bandLabel } from '../classes/classes-content.tsx';
import { ASSIGNMENT_TEMPLATES } from '../onboarding/teacher/steps.ts';
import { assignRootPath } from './assign-paths';
import { useAssignStore } from './assign.store.ts';
import type { AssignmentWorkItem } from './assignments.types.ts';
import { useAssignmentAction, useCreateAssignment } from './use-assignments.ts';

export function AssignmentFormScreen({ classId }: { classId?: string }) {
  const router = useRouter();
  const { classes, loading: classesLoading } = useTeacherClasses();
  const draft = useAssignStore((s) => s.draft);
  const patch = useAssignStore((s) => s.patch);
  const toggleTemplateItem = useAssignStore((s) => s.toggleTemplateItem);
  const addWorkItem = useAssignStore((s) => s.addWorkItem);
  const removeWorkItem = useAssignStore((s) => s.removeWorkItem);
  const clearDraft = useAssignStore((s) => s.clearDraft);
  const setSubmitIntent = useAssignStore((s) => s.setSubmitIntent);
  const submitIntent = useAssignStore((s) => s.submitIntent);
  const createAssignment = useCreateAssignment();
  const lifecycle = useAssignmentAction();

  /*
    The class-detail entry pre-fills the picker via the `classId` param. It is
    also written into the persisted draft here — the field listener only fires
    on CHANGES, and a teacher who backs out without touching anything must
    still resume onto the class they came from.
  */
  useEffect(() => {
    if (classId !== undefined) patch({ classId });
  }, [classId, patch]);

  const form = useAppForm({
    defaultValues: {
      classId: (classId ?? draft.classId) as string | null,
      title: draft.title,
      subject: draft.subject,
      dueAt: draft.dueAt,
    },
    // Which button submitted — one onSubmit, two exits (Grab's draft/post pair).
    onSubmitMeta: { intent: 'draft' as 'draft' | 'publish' },
    listeners: {
      // The persistence mirror: every field change lands in assign.store, so
      // the draft survives back, reload, and app death (contract offline path).
      onChange: ({ formApi }) => {
        const values = formApi.state.values;
        patch({
          classId: values.classId,
          title: values.title,
          subject: values.subject,
          dueAt: values.dueAt,
        });
      },
    },
    onSubmit: async ({ value, meta }) => {
      // Work items live in the store, not the form — read fresh at submit.
      const { draft: current, savedAssignmentId } = useAssignStore.getState();
      if (value.classId === null || current.workItems.length === 0) return;
      const target = classes.find((klass) => klass.id === value.classId);
      setSubmitIntent(meta.intent);
      try {
        /*
          A row already created by an earlier publish attempt is reused, never
          duplicated — there is no field-edit API, so the retry publishes that
          draft exactly as it was saved (contract publish_failed: retry, still
          never half-published).
        */
        let assignmentId = savedAssignmentId;
        if (assignmentId === null) {
          const created = await createAssignment.mutateAsync({
            classId: value.classId,
            title: value.title.trim(),
            subject: value.subject.trim() === '' ? null : value.subject.trim(),
            dueAt: value.dueAt.trim(),
            workItems: current.workItems,
          });
          assignmentId = created.id;
          useAssignStore.getState().setSavedAssignmentId(assignmentId);
        }
        if (meta.intent === 'publish') {
          await lifecycle.mutateAsync({ assignmentId, action: 'publish' });
          // The contract's propagation-naming confirmation, verbatim.
          notify.success(
            `Assigned to ${target?.name ?? 'the class'}; it will appear on students' plans`,
          );
        }
        clearDraft();
        router.replace(assignRootPath());
      } catch {
        // Failure stays visible through the mutations' error states (the
        // Banner below) — swallowed here only so the form doesn't double-report.
      } finally {
        setSubmitIntent(null);
      }
    },
  });

  const canSubmit = useFormStore(form.store, (s) => s.canSubmit);
  const isSubmitting = useFormStore(form.store, (s) => s.isSubmitting);
  // Publish disabled with its reason stated (contract offline/failure paths):
  // the caption under the actions names the missing piece.
  const ready = canSubmit && draft.workItems.length > 0;
  const customItems = draft.workItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.templateId == null);

  if (classesLoading) {
    return (
      <View className="mx-auto w-full max-w-2xl gap-section px-inset py-section">
        <LoadingSkeleton count={3} />
      </View>
    );
  }

  if (classes.length === 0) {
    // The contract's routed exit — same wall as the tracking list: nothing to
    // assign to means the honest next step is Classes, never a dead form.
    return (
      <View className="mx-auto w-full max-w-2xl px-inset py-section">
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
      </View>
    );
  }

  return (
    <View className="mx-auto w-full max-w-2xl gap-section px-inset py-section">
      <View className="gap-element">
        <Heading level={1} size="display-sm" className="text-text">
          New assignment
        </Heading>
        <Text variant="body" tone="muted">
          It stays a draft — and stays on this device — until you publish it.
        </Text>
      </View>

      {/* Contract failure paths: a failed save saved nothing; a failed publish
          left a DRAFT (create succeeded) — each says which, and retry is the
          same button. */}
      {lifecycle.isError ? (
        <Banner
          tone="warning"
          title="Couldn't publish"
          description="It's saved as a draft — nothing reached students. Check your connection and press Publish again."
        />
      ) : createAssignment.isError ? (
        <Banner
          tone="warning"
          title="Couldn't save"
          description="Nothing was saved. Check your connection and try again."
        />
      ) : null}

      <Card className="gap-group">
        <form.AppField
          name="classId"
          validators={{
            onChange: ({ value }) => (value === null ? 'Pick a class' : undefined),
          }}
        >
          {(field) => (
            <View className="gap-stack">
              <Text variant="label" tone="muted">
                Class
              </Text>
              {classes.map((klass) => {
                const on = field.state.value === klass.id;
                return (
                  <PressScale
                    key={klass.id}
                    onPress={() => field.handleChange(klass.id)}
                    accessibilityState={{ selected: on }}
                    className={[
                      'min-h-target-adult justify-center rounded-card border-2 p-inset-tight',
                      on ? 'border-strong bg-highlighter' : 'border-border bg-surface-raised',
                    ].join(' ')}
                  >
                    <Text variant="body" className="font-semibold text-text">
                      {klass.name}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {bandLabel(klass.gradeBand)}
                      {klass.subject ? ` · ${klass.subject}` : ''}
                    </Text>
                  </PressScale>
                );
              })}
            </View>
          )}
        </form.AppField>

        <form.AppField
          name="title"
          validators={{
            onChange: ({ value }) =>
              value.trim().length === 0 ? 'An assignment needs a title' : undefined,
          }}
        >
          {(field) => (
            <field.TextField label="Title" hint="What students will see on their plan." />
          )}
        </form.AppField>

        <form.AppField name="subject">
          {(field) => <field.TextField label="Subject" hint="Optional." />}
        </form.AppField>

        <form.AppField
          name="dueAt"
          validators={{
            onChange: ({ value }) =>
              Number.isNaN(Date.parse(value)) ? 'A date like 2026-09-15' : undefined,
          }}
        >
          {(field) => (
            <field.TextField
              label="Due date"
              hint="YYYY-MM-DD. Students see it in plain words — “Due tomorrow”, never the raw date."
            />
          )}
        </form.AppField>
      </Card>

      <Card className="gap-group">
        <Heading level={2} size="title" className="text-text">
          Work items
        </Heading>
        <Text variant="caption" tone="muted">
          Pick from ready-made work, write your own, or both. Everything is editable before anyone
          sees it.
        </Text>

        <View className="gap-stack">
          {ASSIGNMENT_TEMPLATES.map((template) => {
            const on = draft.workItems.some((item) => item.templateId === template.id);
            return (
              <PressScale
                key={template.id}
                onPress={() =>
                  toggleTemplateItem({
                    templateId: template.id,
                    title: template.title,
                    description: template.description,
                    minutes: template.minutes,
                  })
                }
                accessibilityState={{ selected: on }}
                className={[
                  'min-h-target-adult justify-center rounded-card border-2 p-inset-tight',
                  on ? 'border-strong bg-highlighter' : 'border-border bg-surface-raised',
                ].join(' ')}
              >
                <Text variant="body" className="font-semibold text-text">
                  {template.title}
                </Text>
                <Text variant="caption" tone="muted">
                  {template.description} · About {template.minutes} min
                </Text>
              </PressScale>
            );
          })}
        </View>

        {customItems.length > 0 ? (
          <View className="gap-stack">
            <Text variant="label" tone="muted">
              Your own work items
            </Text>
            {customItems.map(({ item, index }) => (
              <View
                key={`${item.title}-${index}`}
                className="flex-row items-center gap-group rounded-card border-2 border-border bg-surface-raised p-inset-tight"
              >
                <View className="flex-1 gap-0.5">
                  <Text variant="body" className="font-semibold text-text">
                    {item.title}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {item.description ? `${item.description} · ` : ''}About {item.minutes} min
                  </Text>
                </View>
                <Button
                  title="Remove"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    removeWorkItem(index);
                  }}
                />
              </View>
            ))}
          </View>
        ) : null}

        <AddWorkItem onAdd={addWorkItem} />
      </Card>

      <Card className="gap-group">
        {/* Two exits from one submit (onSubmitMeta), so SubmitButton — which
            hard-binds a single handleSubmit — is unrolled into its parts here. */}
        <Button
          title="Publish"
          variant="primary"
          disabled={!ready || isSubmitting}
          loading={isSubmitting && submitIntent === 'publish'}
          onPress={() => {
            void form.handleSubmit({ intent: 'publish' });
          }}
        />
        <Button
          title="Save draft"
          variant="outline"
          disabled={!ready || isSubmitting}
          loading={isSubmitting && submitIntent === 'draft'}
          onPress={() => {
            void form.handleSubmit({ intent: 'draft' });
          }}
        />
        {draft.workItems.length === 0 ? (
          <Text variant="caption" tone="muted">
            Add at least one work item to save or publish.
          </Text>
        ) : (
          <Text variant="caption" tone="muted">
            Publishing sends it to the class; saving keeps it as a draft only you can see.
          </Text>
        )}
      </Card>
    </View>
  );
}

/**
 * The write-your-own composer — its own small form so a half-typed custom item
 * never blocks submitting the assignment, and `reset()` hands back a clean row
 * after each add. Minutes arrive as text (the kit has no number field) and are
 * validated to a positive count before the item exists at all — an invalid
 * work item is unrepresentable in the draft.
 */
function AddWorkItem({ onAdd }: { onAdd: (item: AssignmentWorkItem) => void }) {
  const form = useAppForm({
    defaultValues: { title: '', description: '', minutes: '' },
    onSubmit: ({ value }) => {
      const minutes = Number(value.minutes);
      onAdd({
        templateId: null,
        title: value.title.trim(),
        description: value.description.trim(),
        minutes,
      });
      form.reset();
    },
  });

  return (
    <View className="gap-stack">
      <Text variant="label" tone="muted">
        Write your own
      </Text>
      <form.AppField
        name="title"
        validators={{
          onChange: ({ value }) =>
            value.trim().length === 0 ? 'A work item needs a title' : undefined,
        }}
      >
        {(field) => <field.TextField label="What should they do?" />}
      </form.AppField>
      <form.AppField name="description">
        {(field) => <field.TextField label="Details" hint="Optional." />}
      </form.AppField>
      <form.AppField
        name="minutes"
        validators={{
          onChange: ({ value }) => {
            const minutes = Number(value);
            return value.trim().length === 0 || !Number.isFinite(minutes) || minutes <= 0
              ? 'About how many minutes? A number works — 15, say.'
              : undefined;
          },
        }}
      >
        {(field) => <field.TextField label="Minutes" hint="A rough size, not a timer." />}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton title="Add work item" variant="outline" />
      </form.AppForm>
    </View>
  );
}
