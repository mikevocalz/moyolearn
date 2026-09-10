import type { Meta, StoryObj } from '@storybook/react-vite';
import { Whiteboard } from './Whiteboard';
import { View } from './primitives';

const meta = { title: 'UI/Whiteboard' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/*
  THE WIDTHS ARE THE POINT OF THIS FILE.

  The tray folds on the width of its own CONTAINER, not the window, so a
  browser-resize check proves nothing — every one of these renders at the same
  window size and they must not look alike. `Pane` is the work column in the
  three-pane session, `Full` is a phone or tablet opening the board on its own,
  and `PaneYoung` is the case the arithmetic in `Whiteboard.tsx` exists for: a
  K–2 learner's 72dp keys leave no room for a labelled action, so the same pane
  that fits an adult's full row folds for them.
*/
function Frame({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <View className="h-[520px] bg-surface p-inset" style={{ width }}>
      {children}
    </View>
  );
}

export const Pane: Story = {
  render: () => (
    <Frame width={340}>
      <Whiteboard onAsk={() => {}} />
    </Frame>
  ),
};

export const Full: Story = {
  render: () => (
    <Frame width={720}>
      <Whiteboard onAsk={() => {}} />
    </Frame>
  ),
};

export const PaneYoung: Story = {
  render: () => (
    <Frame width={340}>
      <Whiteboard size="xl" onAsk={() => {}} />
    </Frame>
  ),
};

/*
  No `onAsk`, so the action is not drawn — the composer's rule applied here: an
  affordance with no handler is invisible rather than dead. This is the shape a
  board takes anywhere the tutor is not on the other end of it.
*/
export const NoTutor: Story = {
  render: () => (
    <Frame width={720}>
      <Whiteboard />
    </Frame>
  ),
};
