// SOT-KEYWORDS: notes editor stories enriched rich-text toolbar session note
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Text, View } from '@acme/ui/tw';
import { NotesEditor } from './NotesEditor';

const meta = { title: 'Editor/NotesEditor', component: NotesEditor } satisfies Meta<typeof NotesEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    label: 'Session note',
    placeholder: 'What did you cover?',
    onChangeHtml: () => {},
  },
  render: (args) => (
    <View className="bg-surface p-inset">
      <NotesEditor {...args} />
    </View>
  ),
};

export const WithExistingNote: Story = {
  args: {
    label: 'Session note',
    defaultValue:
      '<p>Covered <strong>remainders</strong>. Daniel asked for one more example.</p>',
    onChangeHtml: () => {},
  },
  render: (args) => (
    <View className="bg-surface p-inset">
      <NotesEditor {...args} />
    </View>
  ),
};

/** The editor is uncontrolled — it owns its document and reports HTML out. */
export const EmittedHtml: Story = {
  args: { label: 'Session note', onChangeHtml: () => {} },
  render: function Emitted() {
    // Story-local demo state only; app state uses Zustand per the repo rule.
    const [html, setHtml] = useState('');
    return (
      <View className="gap-group bg-surface p-inset">
        <NotesEditor label="Session note" placeholder="Type to see the HTML" onChangeHtml={setHtml} />
        <View className="gap-element">
          <Text className="text-label text-text">Stored value</Text>
          <Text className="font-mono text-caption text-text-muted">{html || '(empty)'}</Text>
        </View>
      </View>
    );
  },
};
