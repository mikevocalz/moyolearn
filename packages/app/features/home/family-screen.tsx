'use client';
// Family/Children hub — the guardian shell's child-management tab
// (guardian.family). It lists the guardian's children, and each child is the
// contract's primary action: one press opens what is set for them.
//
// WHAT A CHILD ROW HONESTLY OPENS. The contract's primary_action names four
// controls — voice default, session budget, readsAt, data & erasure — and asks
// for them in-screen. Two of the four have a surface today (AI permissions at
// /ai-activity, and the memory/erasure entry the contract exits to); the budget
// and voice-register writes have no endpoint, so this screen does not draw
// them. Drawing a disabled budget slider "for completeness" would advertise a
// control that has never existed. The row opens what IS set, and the tools
// below reach the rest; the missing halves arrive with their endpoints.
//
// Example children are clearly labeled so they are not confused with real data.
// Mobbin: https://mobbin.com/screens/6491097a-3861-4c87-ac75-caed6336b83b
// (Greenlight — a family hub listing each child as one tappable row leading to
// that child's settings) ·
// https://mobbin.com/screens/96c15ebb-251f-4261-b474-b4cf3c74d36a
// (Acorns — children grouped in one card with the add-another action closing
// the group, tools listed separately beneath) ·
// https://mobbin.com/screens/ea5d92c2-73fc-4fc7-9fb6-a6d32d332097
// (Kit — a single guardian overview with a labelled secondary list of
// per-family tools under the people). Structure only.
// SOT: design/screens/guardian/guardian.family/contract.md · docs/pack/36-role-navigation-flows.md §3.2
// SOT-KEYWORDS: guardian family children child management hub permissions calendar primary action

import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Avatar, Button, Card, FadeIn, Heading, PressScale, Text } from '@acme/ui';
import { ArrowRight, Calendar, FileText, ShieldCheck, SquareCode } from '@acme/ui/icons';
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
            {/* The safety surface reached from the hub the alerts screen exits
                TO — the pair was one-way, so a parent who adjusted a setting
                after an incident had no route back to the incident. */}
            <ToolRow
              label="Alerts"
              hint="Anything serious from a session"
              onPress={() => router.push('/alerts')}
              Icon={ShieldCheck}
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
