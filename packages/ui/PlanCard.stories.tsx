import type { Meta, StoryObj } from '@storybook/react-vite';
import { create } from 'zustand';
import { PlanCard, type PlanCardScope } from './PlanCard';
import { RoleScope } from './RoleScope';
import { View } from './primitives';

// Story state — zustand always (repo rule).
const usePlanStory = create<{ selected: string | null; select: (id: string) => void }>((set) => ({
  selected: 'plus',
  select: (id) => set({ selected: id }),
}));

// Story FIXTURES. The component takes data props and product code feeds it from
// `@acme/auth/plan-catalog`, which packages/ui may not import (eslint boundaries:
// ui depends only on theme). These strings mirror the catalogue on 2026-11-25
// and exist to exercise the card's states, not to be the price of record.
const FAMILY_INCLUDES = ['Up to 3 children', 'Unlimited homework help', 'Session reports for you'] as const;
const PLUS_INCLUDES = ['One learner', 'Unlimited homework help', 'Session reports for you'] as const;

const meta = {
  title: 'UI/PlanCard',
  component: PlanCard,
  args: { name: 'Moyo Family', price: '$24.99', period: '/mo', context: 'guardian', tier: 'family' },
} satisfies Meta<typeof PlanCard>;
export default meta;
type Story = StoryObj<typeof meta>;

// FD-13: the guardian chooses between the two consumer plans and nothing else.
export const GuardianChooser: Story = {
  render: function Render() {
    const { selected, select } = usePlanStory();
    return (
      <RoleScope role="guardian">
        <View role="radiogroup" aria-label="Choose plan" className="max-w-content-form gap-stack p-4">
          <PlanCard
            context="guardian"
            tier="family"
            name="Moyo Plus"
            price="$14.99"
            period="/mo"
            trialLine="after your free month"
            includes={PLUS_INCLUDES}
            selected={selected === 'plus'}
            onSelect={() => select('plus')}
          />
          <PlanCard
            context="guardian"
            tier="family"
            name="Moyo Family"
            price="$24.99"
            period="/mo"
            trialLine="after your free month"
            includes={FAMILY_INCLUDES}
            selected={selected === 'family'}
            onSelect={() => select('family')}
          />
        </View>
      </RoleScope>
    );
  },
};

// PW-08: business tiers render only on org routes — never on a guardian
// surface, and this component never mounts on a learner surface at all. The
// figures are the ops display table's (packages/app/features/billing).
export const BusinessTier: Story = {
  render: function Render() {
    const { selected, select } = usePlanStory();
    return (
      <RoleScope role="org">
        <View role="radiogroup" aria-label="Business plan" className="max-w-content-form gap-stack p-4">
          <PlanCard
            context="org"
            tier="business"
            name="Ops · Solo"
            price="$19"
            period="/mo"
            includes={['One tutor', 'CRM and scheduling', 'Manual pay runs']}
            selected={selected === 'solo'}
            onSelect={() => select('solo')}
          />
          <PlanCard
            context="org"
            tier="business"
            name="Ops · Studio"
            price="$99"
            period="/mo"
            badge="Automated pay runs"
            includes={['Up to 5 tutors', 'CRM and scheduling', 'Automated pay runs']}
            selected={selected === 'studio'}
            onSelect={() => select('studio')}
          />
        </View>
      </RoleScope>
    );
  },
};

// The guard, visible: a guardian scope handed a business tier draws nothing.
// Typed callers cannot write this pairing, so the props are widened on purpose.
export const RefusedOnGuardianSurface: Story = {
  render: () => {
    const refused = { context: 'guardian', tier: 'business' } as unknown as PlanCardScope;
    return (
      <RoleScope role="guardian">
        <View className="max-w-content-form gap-stack p-4">
          <PlanCard {...refused} name="Ops · Studio" price="$99" period="/mo" />
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
          context="guardian"
          tier="family"
          name="Moyo Family"
          price="$24.99"
          period="/mo"
          trialLine="renews Oct 1"
          includes={FAMILY_INCLUDES}
        />
      </View>
    </RoleScope>
  ),
};
