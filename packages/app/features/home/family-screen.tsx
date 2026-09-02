'use client';
// Family/Children hub — the guardian shell's child-management tab.
//
// The prompt's guardian phone primary nav names this `Children` (doc 36 §3.2
// table). It lists the guardian's children, links to safety/permissions and
// scheduling surfaces, and offers the add-child path. Example children are
// clearly labeled so they are not confused with real data.
// SOT: docs/pack/04-screen-briefs.md §S11 · docs/pack/36-role-navigation-flows.md §3.2
// SOT-KEYWORDS: guardian family children child management hub permissions calendar

import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Avatar, Button, Card, FadeIn, Heading, PressScale, Text } from '@acme/ui';
import { ArrowRight, Calendar, FileText, SquareCode } from '@acme/ui/icons';
import { useAppSession } from '../../providers/session';
// Children come from family.store, not the fixture directly — guardian.family's
// contract makes this screen a writer of the shared activeChild seam (G-8 fix),
// so tapping a child scopes ai-activity (and every per-child surface) to them.
import { useFamilyStore } from '../family/family.store';

export function FamilyScreen() {
  const { user } = useAppSession();
  const children = useFamilyStore((s) => s.children);
  const selectLearner = useFamilyStore((s) => s.selectLearner);
  const router = useRouter();
  const name = user?.name?.split(' ')[0] ?? 'there';

  return (
    <View className="gap-group p-inset-roomy">
      <FadeIn>
        <Section className="gap-1">
          <Heading level={1} size="title">
            {name}&apos;s family
          </Heading>
          <TWText className="text-body text-text-muted">
            Children, permissions, and schedules in one place.
          </TWText>
        </Section>
      </FadeIn>

      <FadeIn delay={80}>
        <Card className="gap-stack border-2 border-grade/20 bg-grade/5">
          <View className="flex-row items-center gap-1.5">
            <Text variant="label" className="font-semibold text-grade">
              Example
            </Text>
            <Text variant="caption" tone="muted">
              The children below are seeded examples. Add your own to see real data.
            </Text>
          </View>
          <View className="gap-element">
            {children.map((child) => (
              <PressScale
                key={child.id}
                onPress={() => {
                  selectLearner(child.id);
                  router.push('/ai-activity');
                }}
                className="w-full rounded-card border-2 border-border bg-surface-raised p-4"
                outerClassName="w-full"
                aria-label={`${child.name}, ${child.gradeBand}, ${child.status}`}
              >
                <View className="flex-row items-center gap-stack">
                  <Avatar name={child.name} size="md" />
                  <View className="flex-1 gap-0.5">
                    <TWText className="text-base font-semibold text-text">{child.name}</TWText>
                    <TWText className="text-sm text-text-muted">
                      {child.gradeBand} · {child.status}
                    </TWText>
                  </View>
                  <ArrowRight size={18} className="text-text-muted" />
                </View>
              </PressScale>
            ))}
          </View>
          <Button
            title="Add a child"
            onPress={() => router.push('/onboarding/guardian')}
            variant="outline"
            fullWidth
          />
        </Card>
      </FadeIn>

      <FadeIn delay={160}>
        <Card className="gap-stack">
          <Text variant="label" tone="muted">
            Family tools
          </Text>
          {/* Every pushed path below resolves on BOTH platforms: /calendar is
              the mobile guardian stack route and web's `(site)/calendar`
              (renamed from family-calendar to unify), /reports is the mobile
              Reports tab and web's apex /reports (ReportsPaneScreen), and
              /ai-activity exists on both. */}
          <View className="gap-element">
            <ToolRow
              label="Calendar"
              hint="Sessions and due work"
              onPress={() => router.push('/calendar')}
              Icon={Calendar}
            />
            <ToolRow
              label="AI activity"
              hint="What Moyo worked on with each child"
              onPress={() => router.push('/ai-activity')}
              Icon={SquareCode}
            />
            <ToolRow
              label="Reports"
              hint="Session summaries and evidence"
              onPress={() => router.push('/reports')}
              Icon={FileText}
            />
          </View>
        </Card>
      </FadeIn>
    </View>
  );
}

function ToolRow({
  label,
  hint,
  onPress,
  Icon,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <PressScale
      onPress={onPress}
      className="w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-4"
      outerClassName="w-full"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-surface-sunken">
        <Icon size={20} className="text-text" />
      </View>
      <View className="flex-1 gap-0.5">
        <TWText className="text-base font-semibold text-text">{label}</TWText>
        <TWText className="text-sm text-text-muted">{hint}</TWText>
      </View>
      <ArrowRight size={18} className="text-text-muted" />
    </PressScale>
  );
}
