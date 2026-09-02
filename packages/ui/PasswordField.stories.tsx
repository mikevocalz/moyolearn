import type { Meta, StoryObj } from '@storybook/react-vite';
import { create } from 'zustand';
import { PasswordField, PasswordRules } from './PasswordField';
import { View } from './primitives';
import { Text } from './Text';

// Story state — zustand always (repo rule).
const usePasswordStory = create<{
  values: Record<string, string>;
  set: (key: string, value: string) => void;
}>((set) => ({
  values: {},
  set: (key, value) => set((s) => ({ values: { ...s.values, [key]: value } })),
}));

const meta = {
  title: 'UI/PasswordField',
  component: PasswordField,
  args: { value: '', onChangeText: () => undefined },
} satisfies Meta<typeof PasswordField>;
export default meta;
type Story = StoryObj<typeof meta>;

// FD-02: current password, Show/Hide toggle, no rules line.
export const Login: Story = {
  render: function Render() {
    const { values, set } = usePasswordStory();
    return (
      <View className="max-w-content-form gap-4 p-4">
        <PasswordField
          value={values.login ?? ''}
          onChangeText={(text) => set('login', text)}
        />
      </View>
    );
  },
};

// FD-04: new password with the live rules line. Type below 8 and blur to see
// the rules style as error — never while still typing.
export const NewPassword: Story = {
  render: function Render() {
    const { values, set } = usePasswordStory();
    return (
      <View className="max-w-content-form gap-4 p-4">
        <PasswordField
          label="Password"
          intent="new"
          minLength={8}
          value={values.signup ?? ''}
          onChangeText={(text) => set('signup', text)}
        />
        <Text variant="caption" tone="muted">Blur with fewer than 8 characters to see the error styling.</Text>
      </View>
    );
  },
};

export const ErrorState: Story = {
  render: () => (
    <View className="max-w-content-form gap-4 p-4">
      <PasswordField
        value=""
        onChangeText={() => undefined}
        error="That email and password don't match. Check both, or reset your password."
      />
      <PasswordField label="Locked" value="secret" onChangeText={() => undefined} disabled />
    </View>
  ),
};

// The rules line on its own (FD-07 step B reuses it): every state explicitly.
export const Rules: Story = {
  render: () => (
    <View className="max-w-content-form gap-4 p-4">
      <PasswordRules value="" />
      <PasswordRules value="abc" />
      <PasswordRules value="abc" touched />
      <PasswordRules value="long enough now" touched />
    </View>
  ),
};
