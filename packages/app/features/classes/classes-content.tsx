'use client';
// ClassesScreen — teacher.classes list column: the classes the acting teacher
// runs, each row answering "what classes do I run" with the join code as the
// roster hint (the list read carries no student counts — the roster is the
// detail's one query, never a second aggregate). Pane-aware and route-safe on
// the reports precedent: inside an AdaptivePanes host at an expanded width a
// row SELECTS into the detail pane; collapsed, and on hostless surfaces, it
// NAVIGATES. The create-class affordance is FD-23's class step re-composed
// inline (name + grade band) over `useCreateClass` — always rendered, so the
// contract's no_data path ("no classes → create-class prompt") and the
// steady-state secondary action are the same surface, and nothing is a dead
// button.
//
// Mobbin: https://mobbin.com/screens/4e7acf99-4911-4b4e-830d-60365470698a (Peanut —
//   joined-groups rows: name leads, membership facts in one supporting line,
//   the whole row is the tap target) ·
//   https://mobbin.com/screens/5488a273-c380-4a73-adbb-d138fd9e64b8 (Instacart —
//   the create-group affordance rides the groups list itself, present whether
//   the list is empty or full) ·
//   https://mobbin.com/screens/4af62471-60e6-43fd-9238-f8f8cfffda6f (Customer.io —
//   status chip on the row's trailing edge, subordinate to the title).
//   Structure only.
// SOT: design/screens/teacher/teacher.classes/contract.md · packages/app/features/summary/reports-content.tsx
// SOT-KEYWORDS: classes screen teacher list rows grade band code create class pane select push offline
import { useRouter } from 'solito/navigation';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Heading,
  LoadingSkeleton,
  PressScale,
  Text,
  isCollapsed,
  useAdaptivePaneSelection,
  useAppForm,
  useWindowSizeClass,
} from '@acme/ui';
import { GraduationCap } from '@acme/ui/icons';
import { Pressable, View } from '@acme/ui/primitives';
import { GRADE_BANDS, type GradeBand } from '../onboarding/teacher/steps.ts';
import { classDetailPath } from './classes-paths';
import { useCreateClass, useTeacherClasses } from './use-classes.ts';

/** The FD-23 label for a band — one list (steps.ts), two renderings of it. */
export const bandLabel = (band: GradeBand) =>
  GRADE_BANDS.find((b) => b.id === band)?.label ?? band;

export function ClassesScreen() {
  const router = useRouter();
  const { classes, loading, error, retry } = useTeacherClasses();

  /*
    Pane-aware, route-safe (doc 37 §3.2/§3.3, the reports-content idiom).
    `useAdaptivePaneSelection` is null-safe outside a host, so this screen
    stays mountable anywhere. The selection may be a bare class id or the
    detail pane's `classId:enrollmentId` compound (a student open inside the
    class) — either way the class segment keeps this row highlighted, which is
    how "class/student selection intact" reads from the list column.
  */
  const { selectedId, select } = useAdaptivePaneSelection();
  const sizeClass = useWindowSizeClass();
  const paneOpen = select !== null && !isCollapsed(sizeClass);
  const selectedClassId = selectedId === null ? null : (selectedId.split(':')[0] ?? null);

  return (
    <View className="mx-auto w-full max-w-2xl gap-section px-inset py-section">
      <View className="gap-element">
        <Heading level={1} size="display-sm" className="text-text">
          Classes
        </Heading>
        <Text variant="body" tone="muted">
          The classes you run, and who is in each.
        </Text>
      </View>

      {/* Contract offline path: reads keep serving the cached list, labelled
          stale — the banner is the label, never a blocking state. It renders
          only WITH a cached list: a cold failure has nothing to label, and
          "showing the last saved list" over "No classes yet" would be two
          contradictory sentences on one screen. */}
      {error !== null && classes.length > 0 ? (
        <Banner
          tone="offline"
          title="Out of sync"
          description="Showing the last saved list — it may be stale until you reconnect."
        />
      ) : null}

      {loading ? (
        <LoadingSkeleton count={3} />
      ) : error !== null && classes.length === 0 ? (
        /* Error wins over empty (the tutor-incidents rule): "no classes" and
           "we could not check" are different sentences, so a cold failed read
           gets the retry — never the calm add-your-first-class prompt. */
        <Card className="gap-element">
          <Badge label="Not loaded" tone="attention" />
          <Text>We couldn&rsquo;t load your classes.</Text>
          <Text variant="caption" tone="muted">
            Nothing has changed in your classroom — this screen just needs a connection.
          </Text>
          <Button title="Try again" variant="outline" className="self-start" onPress={retry} />
        </Card>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={28} className="text-text-muted" />}
          title="No classes yet"
          description="Add your first class below — students join it with its class code."
        />
      ) : (
        <View className="gap-group">
          {classes.map((klass) => (
            <Pressable
              key={klass.id}
              onPress={() => {
                if (paneOpen) {
                  select(klass.id);
                  return;
                }
                router.push(classDetailPath(klass.id));
              }}
              aria-label={`Open class: ${klass.name}`}
              aria-selected={paneOpen ? klass.id === selectedClassId : undefined}
            >
              {/* Selected fill uses the doc 08 §4.6 selection token — the same
                  underlay the reports list uses, never a border colour. */}
              <Card
                className={`flex-row items-center gap-group ${
                  paneOpen && klass.id === selectedClassId ? 'bg-highlighter-underlay' : ''
                }`}
              >
                <Avatar name={klass.name} />
                <View className="flex-1 gap-0.5">
                  <Text variant="body" className="font-semibold text-text">
                    {klass.name}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {klass.status === 'archived' ? 'Archived · ' : ''}
                    {klass.subject ? `${klass.subject} · ` : ''}
                    Join code {klass.code}
                  </Text>
                </View>
                <Badge label={bandLabel(klass.gradeBand)} tone="neutral" />
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <CreateClassCard />
    </View>
  );
}

/**
 * FD-23's class step, inline: name + grade band, over `useCreateClass`. The
 * band is not cosmetic — it decides which join routes are lawful (steps.ts
 * `joinOptions`), which is why it is a required choice here exactly as it is
 * in onboarding, never defaulted. Form state lives in TanStack Form's store
 * (repo rule: never React state); the mutation owns success/failure.
 */
function CreateClassCard() {
  const createClass = useCreateClass();
  const form = useAppForm({
    defaultValues: { name: '', subject: '', gradeBand: null as GradeBand | null },
    onSubmit: async ({ value }) => {
      if (value.gradeBand === null) return;
      try {
        await createClass.mutateAsync({
          name: value.name.trim(),
          gradeBand: value.gradeBand,
          subject: value.subject.trim() === '' ? null : value.subject.trim(),
        });
        form.reset();
      } catch {
        // Failure stays visible through the mutation's error state (the Banner
        // below) — swallowed here only so the form doesn't double-report it.
      }
    },
  });

  return (
    <Card className="gap-group">
      <Heading level={2} size="title" className="text-text">
        Add a class
      </Heading>

      {/* Contract failure path: mutations fail visibly — nothing queues here,
          nothing pretends to have saved. */}
      {createClass.isError ? (
        <Banner
          tone="warning"
          title="Couldn't create the class"
          description="Nothing was saved. Check your connection and try again."
        />
      ) : null}

      <form.AppField
        name="name"
        validators={{
          onChange: ({ value }) => (value.trim().length === 0 ? 'A class needs a name' : undefined),
        }}
      >
        {(field) => (
          <field.TextField label="Class name" hint="What you call it — students will see this." />
        )}
      </form.AppField>

      <form.AppField name="subject">
        {(field) => <field.TextField label="Subject" hint="Optional." />}
      </form.AppField>

      <form.AppField
        name="gradeBand"
        validators={{
          onChange: ({ value }) => (value === null ? 'Pick a grade band' : undefined),
        }}
      >
        {(field) => (
          <View className="gap-stack">
            <Text variant="label" tone="muted">
              Grades
            </Text>
            {GRADE_BANDS.map((band) => {
              const on = field.state.value === band.id;
              return (
                <PressScale
                  key={band.id}
                  onPress={() => field.handleChange(band.id)}
                  accessibilityState={{ selected: on }}
                  className={[
                    'min-h-target-adult justify-center rounded-card border-2 p-inset-tight',
                    on ? 'border-strong bg-highlighter' : 'border-border bg-surface-raised',
                  ].join(' ')}
                >
                  <Text variant="body" className="font-semibold text-text">
                    {band.label}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {band.note}
                  </Text>
                </PressScale>
              );
            })}
          </View>
        )}
      </form.AppField>

      <form.AppForm>
        <form.SubmitButton title="Add class" variant="primary" />
      </form.AppForm>
    </Card>
  );
}
