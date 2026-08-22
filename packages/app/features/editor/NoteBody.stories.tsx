// SOT-KEYWORDS: notebody enriched html stories rich-text render youtube note
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text, View } from '@acme/ui/tw';
import { NoteBody } from './NoteBody';

const meta = { title: 'Editor/NoteBody', component: NoteBody } satisfies Meta<typeof NoteBody>;
export default meta;
type Story = StoryObj<typeof meta>;

const NOTE = `
<h2>Long division — 24 June</h2>
<p>Daniel worked through <strong>remainders</strong> today and asked for
<em>one more example</em>. He is close on the <u>estimate step</u>.</p>
<ul><li>Estimate the quotient</li><li>Multiply and subtract</li><li>Bring down the next digit</li></ul>
<blockquote>"I get it when I say it out loud."</blockquote>
<p>Next session: start from <code>144 ÷ 12</code>.</p>
`.trim();

export const SavedNote: Story = {
  args: { html: NOTE },
  render: (args) => (
    <View className="gap-stack bg-surface p-inset">
      <NoteBody {...args} />
      <Text className="text-caption text-text-muted">
        Rendered by react-native-enriched-html — the same HTML the editor produced.
      </Text>
    </View>
  ),
};

/**
 * The editor's schema has no video node, so a YouTube link is stored as an
 * ordinary anchor. NoteBody splits the HTML around recognised anchors and
 * renders each as a player in the position its link occupied — which is the
 * behaviour worth having a story for.
 */
export const YouTubeLinkBecomesAPlayer: Story = {
  args: {
    html: `<p>We watched the intro together:</p>
<p><a href="https://www.youtube.com/watch?v=aqz-KE-bpKQ">https://www.youtube.com/watch?v=aqz-KE-bpKQ</a></p>
<p>Then we tried the first two problems.</p>`,
  },
  render: (args) => (
    <View className="bg-surface p-inset">
      <NoteBody {...args} />
    </View>
  ),
};

export const EmptyNote: Story = {
  args: { html: '' },
  render: (args) => (
    <View className="gap-stack bg-surface p-inset">
      <NoteBody {...args} />
      <Text className="text-caption text-text-muted">Empty HTML renders nothing, not a crash.</Text>
    </View>
  ),
};
