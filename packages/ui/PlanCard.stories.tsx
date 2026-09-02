import type { Meta, StoryObj } from '@storybook/react-vite';
import { create } from 'zustand';
import { PlanCard } from './PlanCard';
import { RoleScope } from './RoleScope';
import { View } from './primitives';

// Story state — zustand always (repo rule).
const usePlanStory = create<{ selected: string | null; select: (id: string) => void }>((set) => ({
  selected: 'early-bird',
  select: (id) => set({ selected: id }),
}));

// Prices live HERE and only here: the component takes data props; product code
// feeds it from the role-scoped plan query (doc 38 §5 FD-13 · doc 33 FR-11.1).
const FAMILY_INCLUDES = ['Up to 4 learners', 'Unlimited homework help', 'Session reports for you'] as const;

const meta = {
  title: 'UI/PlanCard',
  component: PlanCard,
  args: { name: 'Family', price: '$11', period: '/mo', tier: 'family' },
} satisfies Meta<typeof PlanCard>;
export default meta;
type Story = StoryObj<typeof meta>;

// FD-13: the guardian sees ONE family price — early bird OR regular, never both.
export const FamilyEarlyBird: Story = {
  render: function Render() {
    const { selected, select } = usePlanStory();
    return (
      <RoleScope role="guardian">
        <View role="radiogroup" aria-label="Choose plan" className="max-w-content-form gap-stack p-4">
          <PlanCard
            tier="family"
            name="Family"
            price="$11"
            period="/mo"
            trialLine="after your free month"
            badge="Early-bird price"
            includes={FAMILY_INCLUDES}
            selected={selected === 'early-bird'}
            onSelect={() => select('early-bird')}
          />
        </View>
      </RoleScope>
    );
  },
};

export const FamilyRegular: Story = {
  render: () => (
    <RoleScope role="guardian">
      <View className="max-w-content-form gap-stack p-4">
        <PlanCard
          tier="family"
          name="Family"
          price="$15.99"
          period="/mo"
          trialLine="after your free month"
          includes={FAMILY_INCLUDES}
          onSelect={() => undefined}
        />
      </View>
    </RoleScope>
  ),
};

// PW-08: business tiers render only on org routes — never on a guardian
// surface, and this component never mounts on a learner surface at all.
export const BusinessTier: Story = {
  render: function Render() {
    const { selected, select } = usePlanStory();
    return (
      <RoleScope role="org">
        <View role="radiogroup" aria-label="Business plan" className="max-w-content-form gap-stack p-4">
          <PlanCard
            tier="business"
            name="Studio"
            price="$49"
            period="/mo"
            includes={['Up to 5 tutors', 'CRM and scheduling', 'Payouts via Stripe']}
            selected={selected === 'studio'}
            onSelect={() => select('studio')}
          />
          <PlanCard
            tier="business"
            name="Growth"
            price="$99"
            period="/mo"
            badge="Most popular"
            includes={['Unlimited tutors', 'Multiple locations', 'Priority support']}
            selected={selected === 'growth'}
            onSelect={() => select('growth')}
          />
        </View>
      </RoleScope>
    );
  },
};

// PW-05 manage-plan summary: static, no radio semantics, no shadow chrome.
export const StaticSummary: Story = {
  render: () => (
    <RoleScope role="guardian">
      <View className="max-w-content-form gap-stack p-4">
        <PlanCard
          tier="family"
          name="Family"
          price="$11"
          period="/mo"
          trialLine="renews Oct 1"
          badge="Early-bird price"
          includes={FAMILY_INCLUDES}
        />
      </View>
    </RoleScope>
  ),
};
