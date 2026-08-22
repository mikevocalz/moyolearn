// SOT-KEYWORDS: youtube embed bridge stories video playlist player editor
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text, View } from '@acme/ui/tw';
import { YouTubeEmbed, type PlaylistItem } from './YouTubeEmbed';
import { youTubeEmbedUrl, youTubeTarget } from './youtube';

const meta = { title: 'Editor/YouTubeEmbed', component: YouTubeEmbed } satisfies Meta<typeof YouTubeEmbed>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Blender Foundation's "Big Buck Bunny" — CC-BY, safe to embed in a demo. */
const VIDEO_ID = 'aqz-KE-bpKQ';
/**
 * Blender's uploads playlist — verified as "Uploads from Blender", CC content.
 * A channel's uploads list is `UU` + the channel id minus its `UC` prefix, so
 * this one is derivable and checkable rather than a copied id whose contents
 * nobody has looked at. That matters on a children's product: an unvetted
 * third-party list can put anything on screen in a demo.
 */
const LIST_ID = 'UUSMOQeBJ2RAnuFungnQOxLg';

export const SingleVideo: Story = {
  args: { videoId: VIDEO_ID },
  render: (args) => (
    <View className="w-full gap-stack bg-surface p-inset">
      <YouTubeEmbed {...args} />
      <Text className="text-caption text-text-muted">
        react-native-youtube-bridge on native; an iframe on web. Same props either side.
      </Text>
    </View>
  ),
};

/**
 * A whole list, with no starting video — YouTube's `videoseries` entry point.
 * The player shows its own queue control, which is the visible difference from
 * a single video.
 */
export const Playlist: Story = {
  args: { playlistId: LIST_ID },
  render: (args) => (
    <View className="w-full gap-stack bg-surface p-inset">
      <YouTubeEmbed {...args} />
      <Text className="text-caption text-text-muted">
        Playlist only — starts at the first item and keeps the rest queued.
      </Text>
      <Text className="font-mono text-caption text-text-muted">
        {youTubeEmbedUrl({ videoId: null, playlistId: LIST_ID })}
      </Text>
    </View>
  ),
};

/**
 * The case that matters most: a link shared from INSIDE a playlist names both
 * ids. Dropping the list would silently turn a lesson sequence into one clip,
 * so both are kept and the player starts on that video with the queue intact.
 */
export const VideoWithinAPlaylist: Story = {
  args: { videoId: VIDEO_ID, playlistId: LIST_ID },
  render: (args) => (
    <View className="w-full gap-stack bg-surface p-inset">
      <YouTubeEmbed {...args} />
      <Text className="font-mono text-caption text-text-muted">
        {youTubeEmbedUrl({ videoId: VIDEO_ID, playlistId: LIST_ID })}
      </Text>
    </View>
  ),
};

/**
 * The editor has no video node — a YouTube link is stored as an ordinary
 * anchor, and `youTubeTarget` is what turns it back into a player at render
 * time. Showing the parse next to the embed is the point of this story.
 */
export const ParsedFromPastedUrls: Story = {
  args: { videoId: VIDEO_ID },
  render: () => {
    const urls = [
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      'https://youtu.be/aqz-KE-bpKQ?t=42',
      `https://www.youtube.com/playlist?list=${LIST_ID}`,
      `https://www.youtube.com/watch?v=aqz-KE-bpKQ&list=${LIST_ID}&index=2`,
      'https://www.youtube.com/playlist?list=WL',
      'https://example.com/not-a-video',
    ];
    return (
      <View className="w-full gap-group bg-surface p-inset">
        <View className="gap-element">
          {urls.map((u) => {
            const t = youTubeTarget(u);
            return (
              <Text key={u} className="font-mono text-caption text-text">
                {u}
                {'\n'}
                {'  → '}
                {t === null
                  ? 'not YouTube (or a viewer-private list)'
                  : `video ${t.videoId ?? '—'} · list ${t.playlistId ?? '—'}`}
              </Text>
            );
          })}
        </View>
        <YouTubeEmbed videoId={VIDEO_ID} playlistId={LIST_ID} />
      </View>
    );
  },
};

/**
 * Blender Foundation open movies — every id checked against YouTube's oEmbed
 * endpoint, so these titles are the real ones.
 */
const LESSON: PlaylistItem[] = [
  { videoId: 'aqz-KE-bpKQ', title: 'Big Buck Bunny (60fps 4K)', duration: '10:34' },
  { videoId: 'YE7VzlLtp-4', title: 'Big Buck Bunny', duration: '9:56' },
  { videoId: 'eRsGyueVLvQ', title: 'Sintel', duration: '14:48' },
  { videoId: 'WhWc3b3KhnY', title: 'Spring', duration: '7:47' },
];

/**
 * The same component with a curated queue: the app owns the sequence, so the
 * items are visible and selectable instead of hidden behind YouTube's control.
 */
export const CuratedQueue: Story = {
  args: { items: LESSON },
  render: (args) => (
    <View className="w-full max-w-content-detail bg-surface p-inset">
      <YouTubeEmbed {...args} />
    </View>
  ),
};

/** Opening partway in — a learner returning to a sequence they started. */
export const QueueResumesPartway: Story = {
  args: { items: LESSON, initialIndex: 2 },
  render: (args) => (
    <View className="w-full max-w-content-detail bg-surface p-inset">
      <YouTubeEmbed {...args} />
    </View>
  ),
};

/**
 * One item is a video, not a playlist — no queue chrome appears. This is the
 * adaptation that made two components unnecessary.
 */
export const SingleItemQueueRendersAsAVideo: Story = {
  args: { items: [LESSON[0]!] },
  render: (args) => (
    <View className="w-full max-w-content-detail bg-surface p-inset">
      <YouTubeEmbed {...args} />
    </View>
  ),
};

/** A stale pointer is clamped rather than rendering an empty player. */
export const QueueIndexIsClamped: Story = {
  args: { items: LESSON, initialIndex: 99 },
  render: (args) => (
    <View className="w-full max-w-content-detail bg-surface p-inset">
      <YouTubeEmbed {...args} />
    </View>
  ),
};
