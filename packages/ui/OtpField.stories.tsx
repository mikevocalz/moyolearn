import type { Meta, StoryObj } from '@storybook/react-vite';
import { create } from 'zustand';
import { OtpField } from './OtpField';
import { View } from './primitives';
import { Text } from './Text';

// Story state — zustand always (repo rule). One record keyed by story field.
const useOtpStory = create<{
  codes: Record<string, string>;
  completed: string | null;
  set: (key: string, code: string) => void;
  complete: (code: string) => void;
}>((set) => ({
  codes: {},
  completed: null,
  set: (key, code) => set((s) => ({ codes: { ...s.codes, [key]: code } })),
  complete: (code) => set({ completed: code }),
}));

const meta = {
  title: 'UI/OtpField',
  component: OtpField,
  args: { value: '', onChange: () => undefined },
} satisfies Meta<typeof OtpField>;
export default meta;
type Story = StoryObj<typeof meta>;

// FD-05: digits, auto-submit on the sixth — the button stays for screen readers.
export const Digits: Story = {
  render: function Render() {
    const { codes, completed, set, complete } = useOtpStory();
    return (
      <View className="max-w-content-form gap-4 p-4">
        <OtpField
          value={codes.digits ?? ''}
          onChange={(code) => set('digits', code)}
          onComplete={complete}
        />
        <Text variant="caption" tone="muted">
          {completed ? `Auto-submitted ${completed}` : 'Fills auto-submit on the sixth digit.'}
        </Text>
      </View>
    );
  },
};

// FD-08's alphabet: uppercase + digits, I/O/1/0 stripped on entry and paste.
export const Alnum: Story = {
  render: function Render() {
    const { codes, set } = useOtpStory();
    return (
      <View className="max-w-content-form gap-4 p-4">
        <OtpField
          mode="alnum"
          autoSubmit={false}
          value={codes.alnum ?? ''}
          onChange={(code) => set('alnum', code)}
        />
        <Text variant="caption" tone="muted">Try pasting “abc-123” — it lands as ABC23.</Text>
      </View>
    );
  },
};

// Every variant axis, explicitly — react-docgen is off, stories are the docs.
export const States: Story = {
  render: () => (
    <View className="max-w-content-form gap-6 p-4">
      <OtpField value="" onChange={() => undefined} />
      <OtpField value="123" onChange={() => undefined} />
      <OtpField value="123456" onChange={() => undefined} />
      <OtpField
        value="123456"
        onChange={() => undefined}
        error="That code isn't right. Check the newest email — older codes stop working."
      />
      <OtpField value="12" onChange={() => undefined} disabled />
    </View>
  ),
};

export const SizeXl: Story = {
  render: () => (
    <View className="max-w-content-form gap-6 p-4">
      <OtpField size="xl" mode="alnum" value="AB" onChange={() => undefined} />
      <OtpField size="xl" mode="alnum" separatorAfter={3} value="ABC23" onChange={() => undefined} />
    </View>
  ),
};
