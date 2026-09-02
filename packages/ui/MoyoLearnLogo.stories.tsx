// SOT-KEYWORDS: moyolearn logo stories brand mark wordmark emblem variants single colour
import type { Meta, StoryObj } from '@storybook/react-vite';
import MoyoLearnLogo from './MoyoLearnLogo';
import MoyoMark from './MoyoMark';
import { Text, View } from './primitives';

const meta = {
  title: 'Foundations/MoyoLearnLogo',
  component: MoyoLearnLogo,
} satisfies Meta<typeof MoyoLearnLogo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <View className="w-96 bg-surface p-inset">
      <MoyoLearnLogo accessibilityLabel="MoyoLearn" />
    </View>
  ),
};

/**
 * The two halves of the brand, and the rule for picking one.
 *
 * They are separate art and they never render locked together — the shipped
 * icon is the wordmark alone, the shipped favicon is the mark alone. Both
 * default to the same 36px height so a surface can swap one for the other
 * without re-measuring its chrome.
 */
export const WordmarkAndMark: Story = {
  render: () => (
    <View className="w-96 gap-group bg-surface p-inset">
      <View className="gap-element">
        <Text className="font-mono text-caption uppercase tracking-widest text-text-muted">
          MoyoLearnLogo — anywhere the width allows it
        </Text>
        <View className="w-fit">
          <MoyoLearnLogo accessibilityLabel="MoyoLearn" />
        </View>
      </View>
      <View className="gap-element">
        <Text className="font-mono text-caption uppercase tracking-widest text-text-muted">
          MoyoMark — favicons, collapsed rails, avatar-sized slots
        </Text>
        <View className="w-fit">
          <MoyoMark accessibilityLabel="Moyo" />
        </View>
      </View>
    </View>
  ),
};

/**
 * Single-colour variants for surfaces where the full-colour mark would clash —
 * every fill resolves through the token palette, never a raw hex (logo-fill.ts).
 */
export const Variants: Story = {
  render: () => (
    <View className="w-96 gap-group bg-surface p-inset">
      {(['default', 'dark', 'soft'] as const).map((variant) => (
        <View key={variant} className="gap-element">
          <Text className="font-mono text-caption uppercase tracking-widest text-text-muted">
            {variant}
          </Text>
          <MoyoLearnLogo variant={variant} accessibilityLabel={`MoyoLearn — ${variant}`} />
        </View>
      ))}
      {/* `light` is all-white, so it needs a dark surface to be visible at all. */}
      <View className="gap-element rounded-card bg-ink-950 p-inset">
        <Text className="font-mono text-caption uppercase tracking-widest text-ink-50">light</Text>
        <MoyoLearnLogo variant="light" accessibilityLabel="MoyoLearn — light" />
      </View>
    </View>
  ),
};
