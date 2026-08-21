// The UI ramp, spacing tiers and age-band targets, rendered at both dials —
// doc 08 §8 PR-20's "Storybook ramp/density pages".
// Every row names a ROLE (text-title, gap-group); the dial supplies the value,
// which is the whole argument for the ramp existing.
// SOT-KEYWORDS: ramp type scale spacing tiers targets density storybook dial
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dial, type DialTemperature } from './Dial';
import { Section, Text } from './html';
import { View } from './tw';

const meta = { title: 'Foundations/Ramp' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const LABEL = 'font-mono text-xs font-bold uppercase tracking-widest text-text-muted';
const NOTE = 'font-mono text-caption text-text-muted';

const RAMP = [
  ['title-lg', 'text-title-lg', 'Screen titles'],
  ['title', 'text-title', 'Card and section titles'],
  ['body-lg', 'text-body-lg', 'Learner reading text'],
  ['body', 'text-body', 'Default UI text'],
  ['label', 'text-label', 'Buttons and form labels'],
  ['caption', 'text-caption', 'Metadata — never for anything actionable'],
] as const;

const TIERS = [
  ['gap-element', 'gap-element', 'Icon ↔ label, control clusters'],
  ['gap-stack', 'gap-stack', 'Items within one group'],
  ['gap-group', 'gap-group', 'Between groups — the hierarchy workhorse'],
  ['gap-section', 'gap-section', 'Between page sections'],
] as const;

/** Age-band targets are not dial-scoped: the band comes from the learner profile. */
const TARGETS = [
  ['target-floor', 'h-target-floor', '24 · WCAG 2.2 AA absolute minimum'],
  ['target-adult', 'h-target-adult', '44 · Cool-dial interactive elements'],
  ['target-teen', 'h-target-teen', '48 · Hot, grades 6–12'],
  ['target-child', 'h-target-child', '56 · Hot, grades 3–5'],
  ['target-young', 'h-target-young', '72 · Hot, K–2 primary actions'],
] as const;

function RampColumn({ temperature }: { temperature: DialTemperature }) {
  return (
    <View className="flex-1 gap-3">
      <Text className={LABEL}>{temperature}</Text>
      <Dial temperature={temperature}>
        <View className="gap-stack">
          {RAMP.map(([name, cls, use]) => (
            <View key={name} className="gap-element border-b border-border/30 pb-2">
              <Text className={`${cls} text-text`}>{name} — the quick brown fox</Text>
              <Text className={NOTE}>{use}</Text>
            </View>
          ))}
          <View className="gap-element">
            <Text className="font-mono text-data text-text">data · 09:00–09:45 · £30.00 · 100%</Text>
            <Text className="font-mono text-data-lg text-text">data-lg · 41%</Text>
            <Text className={NOTE}>Mono, tabular — columns align, always</Text>
          </View>
        </View>
      </Dial>
    </View>
  );
}

/** Same role names, two temperatures — the ramp is what the dial is scaling. */
export const TypeRamp: Story = {
  render: () => (
    <Section className="flex-row flex-wrap gap-6 bg-surface p-6">
      <RampColumn temperature="cool" />
      <RampColumn temperature="hot" />
    </Section>
  ),
};

function TierColumn({ temperature }: { temperature: DialTemperature }) {
  return (
    <View className="flex-1 gap-3">
      <Text className={LABEL}>{temperature}</Text>
      <Dial temperature={temperature}>
        <View className="gap-group">
          {TIERS.map(([name, cls, use]) => (
            <View key={name} className="gap-element">
              <Text className="text-label text-text">{name}</Text>
              <View className={`flex-row ${cls}`}>
                <View className="h-6 w-10 bg-highlighter" />
                <View className="h-6 w-10 bg-highlighter" />
                <View className="h-6 w-10 bg-highlighter" />
              </View>
              <Text className={NOTE}>{use}</Text>
            </View>
          ))}
        </View>
      </Dial>
    </View>
  );
}

/** The gap between the swatches IS the token — Hot runs one step looser throughout. */
export const SpacingTiers: Story = {
  render: () => (
    <Section className="flex-row flex-wrap gap-6 bg-surface p-6">
      <TierColumn temperature="cool" />
      <TierColumn temperature="hot" />
    </Section>
  ),
};

export const TouchTargets: Story = {
  render: () => (
    <Section className="gap-stack bg-surface p-6">
      <Text className={LABEL}>Age-band targets — sized by the signed-in child, not the screen</Text>
      {TARGETS.map(([name, cls, use]) => (
        <View key={name} className="flex-row items-center gap-group">
          <View className={`${cls} w-40 items-center justify-center border-2 border-border bg-surface-raised`}>
            <Text className="text-label text-text">{name}</Text>
          </View>
          <Text className={NOTE}>{use}</Text>
        </View>
      ))}
    </Section>
  ),
};

/**
 * "Comfy reading" (doc 08 §3.3) — opt-in, never framed as a diagnosis, default
 * off. It composes with the dial rather than replacing it.
 */
export const ReadingComfort: Story = {
  render: () => (
    <Dial temperature="hot">
      <Section className="flex-row flex-wrap gap-6 bg-surface p-6">
        <View className="flex-1 gap-stack">
          <Text className={LABEL}>Default</Text>
          <Text className="text-body text-text">
            A fraction is a way of describing part of a whole. When you split a pizza into
            eight equal slices and take three, you have three eighths of the pizza.
          </Text>
        </View>
        <View className="flex-1 gap-stack reading-comfort">
          <Text className={LABEL}>Comfy reading on</Text>
          <Text className="text-body text-text">
            A fraction is a way of describing part of a whole. When you split a pizza into
            eight equal slices and take three, you have three eighths of the pizza.
          </Text>
        </View>
      </Section>
    </Dial>
  ),
};
