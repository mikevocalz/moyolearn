// SOT-KEYWORDS: youtube embed bridge stories video player editor
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text, View } from '@acme/ui/tw';
import { YouTubeEmbed } from './YouTubeEmbed';
import { youTubeVideoId } from './youtube';

const meta = { title: 'Editor/YouTubeEmbed', component: YouTubeEmbed } satisfies Meta<typeof YouTubeEmbed>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Blender Foundation's "Big Buck Bunny" — CC-BY, safe to embed in a demo. */
const VIDEO_ID = 'aqz-KE-bpKQ';

export const Default: Story = {
  args: { videoId: VIDEO_ID },
  render: (args) => (
    <View className="gap-stack bg-surface p-inset">
      <YouTubeEmbed {...args} />
      <Text className="text-caption text-text-muted">
        react-native-youtube-bridge on native; an iframe on web. Same props either side.
      </Text>
    </View>
  ),
};

/**
 * The editor has no video node — a YouTube link is stored as an ordinary
 * anchor, and `youTubeVideoId` is what turns it back into a player at render
 * time. Showing the parse next to the embed is the point of this story.
 */
export const IdParsedFromPastedUrls: Story = {
  args: { videoId: VIDEO_ID },
  render: () => {
    const urls = [
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      'https://youtu.be/aqz-KE-bpKQ?t=42',
      'https://www.youtube.com/embed/aqz-KE-bpKQ',
      'https://example.com/not-a-video',
    ];
    return (
      <View className="gap-group bg-surface p-inset">
        <View className="gap-element">
          {urls.map((u) => (
            <Text key={u} className="font-mono text-caption text-text">
              {u} → {String(youTubeVideoId(u))}
            </Text>
          ))}
        </View>
        <YouTubeEmbed videoId={VIDEO_ID} />
      </View>
    );
  },
};
