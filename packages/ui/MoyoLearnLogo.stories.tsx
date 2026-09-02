// SOT-KEYWORDS: moyolearn logo stories brand mark variants single colour
import type { Meta, StoryObj } from '@storybook/react-vite';
import MoyoLearnLogo from './MoyoLearnLogo';
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
