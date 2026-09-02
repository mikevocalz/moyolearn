import type { Meta, StoryObj } from '@storybook/react-vite';
import { create } from 'zustand';
import { RoleChoiceCard } from './RoleChoiceCard';
import { RoleScope } from './RoleScope';
import { View } from './primitives';
import { Briefcase, GraduationCap, User, Users } from './icons';

// Story state — zustand always (repo rule).
const useRoleStory = create<{ selected: string | null; select: (id: string) => void }>((set) => ({
  selected: null,
  select: (id) => set({ selected: id }),
}));

const meta = {
  title: 'UI/RoleChoiceCard',
  component: RoleChoiceCard,
  args: { title: 'My child', description: '', onSelect: () => undefined },
} satisfies Meta<typeof RoleChoiceCard>;
export default meta;
type Story = StoryObj<typeof meta>;

// FD-03's four doors, verbatim copy. The screen owns the radiogroup; arrow-key
// movement is the screen's job — each card is only one radio.
const FD03 = [
  { id: 'guardian', icon: <Users className="h-8 w-8 text-text" />, title: 'My child', description: "I'm a parent or guardian setting up Moyo for kids at home." },
  { id: 'teacher', icon: <GraduationCap className="h-8 w-8 text-text" />, title: 'My students', description: 'I teach a class and want to use Moyo at school.' },
  { id: 'org', icon: <Briefcase className="h-8 w-8 text-text" />, title: 'My tutoring business', description: 'I run a tutoring company and manage tutors and clients.' },
  { id: 'tutor', icon: <User className="h-8 w-8 text-text" />, title: 'Me — I tutor', description: "I'm a tutor joining a business, or working on my own." },
] as const;

export const FourRoles: Story = {
  render: function Render() {
    const { selected, select } = useRoleStory();
    return (
      <View role="radiogroup" aria-label="Who's this for?" className="max-w-content-form gap-stack p-4">
        {FD03.map((role) => (
          <RoleChoiceCard
            key={role.id}
            icon={role.icon}
            title={role.title}
            description={role.description}
            selected={selected === role.id}
            onSelect={() => select(role.id)}
            accent={role.id}
          />
        ))}
      </View>
    );
  },
};

// FD-09 reuses the same selection semantics with two options.
export const TwoOptions: Story = {
  render: function Render() {
    const { selected, select } = useRoleStory();
    return (
      <View role="radiogroup" aria-label="Join or ignore" className="max-w-content-form gap-stack p-4">
        {FD03.slice(0, 2).map((role) => (
          <RoleChoiceCard
            key={role.id}
            icon={role.icon}
            title={role.title}
            description={role.description}
            selected={selected === role.id}
            onSelect={() => select(role.id)}
          />
        ))}
      </View>
    );
  },
};

// Static states, inside a guardian scope so the accent has a door to inherit.
export const States: Story = {
  render: () => (
    <RoleScope role="guardian">
      <View className="max-w-content-form gap-stack p-4">
        <RoleChoiceCard title="Default" description="Unselected, at rest." onSelect={() => undefined} />
        <RoleChoiceCard
          icon={<Users className="h-8 w-8 text-text" />}
          title="Selected"
          description="Underlay + ring + check + weight — never colour alone."
          selected
          onSelect={() => undefined}
        />
        <RoleChoiceCard title="Disabled" description="Not available for this flow." disabled onSelect={() => undefined} />
      </View>
    </RoleScope>
  ),
};
