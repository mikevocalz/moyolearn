// SOT-KEYWORDS: image viewer stories lightbox thumbnail gallery paging
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Image } from './Image';
import { ImageViewer } from './ImageViewer';
import { View } from './primitives';

const URLS = [
  'https://picsum.photos/seed/one/1200/800',
  'https://picsum.photos/seed/two/1200/800',
  'https://picsum.photos/seed/three/1200/800',
];

const meta = {
  title: 'UI/ImageViewer',
  component: ImageViewer,
} satisfies Meta<typeof ImageViewer>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The child element IS the tap target — tap the thumbnail to open full-screen. */
export const SingleImage: Story = {
  args: { urls: [URLS[0] as string], index: 0, children: <View /> },
  render: () => (
    <View className="bg-surface p-inset">
      <ImageViewer urls={[URLS[0] as string]} index={0}>
        <Image
          src={URLS[0] as string}
          alt="Homework photo"
          unoptimized
          sizes="256px"
          className="h-48 w-64 rounded-control border-2 border-border"
        />
      </ImageViewer>
    </View>
  ),
};

/** Every url is in the viewer, so opening one thumbnail pages across all of them. */
export const GalleryPaging: Story = {
  args: { urls: URLS, index: 0, children: <View /> },
  render: () => (
    <View className="flex-row gap-element bg-surface p-inset">
      {URLS.map((url, index) => (
        <ImageViewer key={url} urls={URLS} index={index}>
          <Image
            src={url}
            alt={`Photo ${index + 1}`}
            unoptimized
            sizes="128px"
            className="h-24 w-32 rounded-control border-2 border-border"
          />
        </ImageViewer>
      ))}
    </View>
  ),
};
