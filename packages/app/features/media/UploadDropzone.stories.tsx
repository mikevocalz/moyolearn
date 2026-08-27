// SOT-KEYWORDS: upload dropzone stories zone rules verdict rows primary button
import type { Meta, StoryObj } from '@storybook/react-vite';
import { View } from '@acme/ui/tw';
import { UploadDropzone } from './UploadDropzone';

const meta = { title: 'Media/UploadDropzone', component: UploadDropzone } satisfies Meta<
  typeof UploadDropzone
>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The rules — types and per-kind ceilings — print inside the zone before the
 * first interaction (doc 30 §2). Drop or pick files to watch per-file verdicts
 * appear: an .exe or an oversize file gets its own inline reason, and the
 * primary button counts only what will actually upload.
 */
export const DocumentsAndImages: Story = {
  args: { kinds: ['document', 'image'], sessionId: 'storybook-demo' },
  render: (args) => (
    <View className="bg-surface p-inset" style={{ maxWidth: 560 }}>
      <UploadDropzone {...args} />
    </View>
  ),
};

export const SingleKind: Story = {
  args: { kinds: ['document'], sessionId: 'storybook-demo', label: 'Upload worksheets' },
  render: (args) => (
    <View className="bg-surface p-inset" style={{ maxWidth: 560 }}>
      <UploadDropzone {...args} />
    </View>
  ),
};
