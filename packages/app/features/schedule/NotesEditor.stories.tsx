// SOT-KEYWORDS: notes editor stories enriched rich-text toolbar session note
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Text, View } from '@acme/ui/tw';
import { NotesEditor } from './NotesEditor';

// `component:` is safe again now that react-docgen is off in .storybook/main.ts
// — it was docgen, not this component, that broke the module import.
// Naming the component makes its required props required on every story, so the
// defaults live here once and the render-only stories inherit them.
const meta = {
  title: 'Editor/NotesEditor',
  component: NotesEditor,
  args: { label: 'Session note', onChangeHtml: () => {} },
} satisfies Meta<typeof NotesEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => (
    <View className="bg-surface p-inset">
      <NotesEditor label="Session note" placeholder="What did you cover?" onChangeHtml={() => {}} />
    </View>
  ),
};

export const WithExistingNote: Story = {
  render: () => (
    <View className="bg-surface p-inset">
      <NotesEditor
        label="Session note"
        defaultValue="<p>Covered <strong>remainders</strong>. Daniel asked for one more example.</p>"
        onChangeHtml={() => {}}
      />
    </View>
  ),
};

/** The editor is uncontrolled — it owns its document and reports HTML out. */
export const EmittedHtml: Story = {
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
