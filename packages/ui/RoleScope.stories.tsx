// The "one product, five doors" claim, made reviewable (doc 36 §5): the SAME
// shell skeleton — header underline, avatar ring, tab indicator underlay, the
// three §5 slots a mobile shell owns — rendered once per role, so the only
// thing that may differ between columns is the accent hue. Admin renders the
// identical skeleton with no accent at all: graphite is the proof that the
// system, not the colour, carries the design. This file is the allowlisted
// review surface in tooling/check-role-accent.mjs.
// SOT-KEYWORDS: role scope stories accent doors specimen shell skeleton review
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { AccentRole } from '@acme/theme';
import { accentRoles } from '@acme/theme';
import { Avatar } from './Avatar';
import { RoleScope } from './RoleScope';
import { Text, View } from './primitives';

const meta = { title: 'Foundations/RoleScope' } satisfies Meta;
export default meta;
type Story = StoryObj;

const LABEL = 'font-mono text-xs font-bold uppercase tracking-widest text-text-muted';

const DOORS: Record<
  AccentRole,
  { door: string; person: string; landing: string; tabs: [string, string, string] }
> = {
  learner: { door: 'Learner', person: 'Amara Diallo', landing: 'Lands on the camera', tabs: ['Home', 'Practice', 'You'] },
  guardian: { door: 'Guardian', person: 'Ngozi Diallo', landing: 'Lands on the newest report', tabs: ['Family', 'Reports', 'You'] },
  tutor: { door: 'Tutor', person: 'Maya Rodriguez', landing: 'Lands on the next session', tabs: ['Sessions', 'Notes', 'You'] },
  org: { door: 'Org', person: 'Sam Ortiz', landing: "Lands on today's exceptions", tabs: ['Today', 'People', 'You'] },
  district: { door: 'District', person: 'Dr. Adeyemi', landing: 'Lands on outcomes', tabs: ['Outcomes', 'Schools', 'You'] },
};

/**
 * The skeleton is identical in every column on purpose — a reviewer should be
 * able to cover the captions and still tell the doors apart by hue alone.
 * `accented: false` is the admin column: same bones, underline drops to the
 * structural hairline, the active tab sits on sunken paper, the ring is gone.
 */
function ShellSkeleton({
  door,
  person,
  landing,
  tabs,
  accented,
}: {
  door: string;
  person: string;
  landing: string;
  tabs: [string, string, string];
  accented: boolean;
}) {
  return (
    <View className="w-56 gap-stack rounded-card border-2 border-border bg-surface-raised p-inset shadow-card">
      <View className="gap-1">
        <Text className="text-title text-text">{door}</Text>
        <View className={`h-1 w-14 rounded-full ${accented ? 'bg-role-accent' : 'bg-border-soft'}`} />
      </View>
      <View className="flex-row items-center gap-element">
        {accented ? (
          <View className="rounded-lg bg-role-accent p-1">
            <Avatar name={person} size="md" />
          </View>
        ) : (
          <Avatar name={person} size="md" />
        )}
        <View className="flex-1 gap-0.5">
          <Text className="text-label text-text">{person}</Text>
          <Text className="text-caption text-text-muted">{landing}</Text>
        </View>
      </View>
      <View className="flex-row items-center gap-element pt-1">
        <View
          className={`items-center rounded-control px-2 py-1 ${accented ? 'bg-role-accent-underlay' : 'bg-surface-sunken'}`}
        >
          <Text className="text-label text-text">{tabs[0]}</Text>
          <View className={`mt-1 h-0.5 w-6 rounded-full ${accented ? 'bg-role-accent' : 'bg-border-soft'}`} />
        </View>
        <Text className="text-label text-text-muted">{tabs[1]}</Text>
        <Text className="text-label text-text-muted">{tabs[2]}</Text>
      </View>
    </View>
  );
}

export const FiveDoors: Story = {
  render: () => (
    <View className="gap-group bg-surface p-6">
      <Text className={LABEL}>same skeleton · only the accent token changes</Text>
      <View className="flex-row flex-wrap gap-group">
        {accentRoles.map((role) => (
          <View key={role} className="gap-element">
            <Text className={LABEL}>{role}</Text>
            <RoleScope role={role}>
              <ShellSkeleton accented {...DOORS[role]} />
            </RoleScope>
          </View>
        ))}
        <View className="gap-element">
          <Text className={LABEL}>admin — no accent</Text>
          <ShellSkeleton
            door="Admin"
            person="Platform ops"
            landing="The back office earns no colour"
            tabs={['Queues', 'Flags', 'You']}
            accented={false}
          />
        </View>
      </View>
    </View>
  ),
};
