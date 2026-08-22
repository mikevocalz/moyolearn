// Type specimen — the three faces doing their real jobs, so a font decision is
// reviewable in the repo instead of in someone's screenshot.
// Doc 08 §7.3 asks for this page; it grows a second dial column in PR-1.
// SOT-KEYWORDS: type specimen font typography archivo grotesk chivo mono dictionary
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Heading,
  Paragraph,
  Section,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Text,
  Time,
} from './html';
import { View } from './primitives';

const meta = { title: 'Foundations/Type' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Card chrome: ink border + hard offset shadow, never blur (house neubrutalism). */
const CARD = 'border-2 border-border bg-surface-raised p-5 shadow-card';
const LABEL = 'font-mono text-xs font-bold uppercase tracking-widest text-text-muted';

type Slot = {
  from: string;
  to: string;
  learner: string;
  topic: string;
  mastery: number;
  tone: 'grade' | 'redpen' | 'ballpoint';
  now?: boolean;
};

const DAY: Slot[] = [
  { from: '09:00', to: '09:45', learner: 'Amina O.', topic: 'Fractions', mastery: 82, tone: 'grade' },
  { from: '10:00', to: '10:45', learner: 'Daniel K.', topic: 'Long division', mastery: 41, tone: 'redpen', now: true },
  { from: '11:15', to: '12:00', learner: 'Priya R.', topic: 'Place value', mastery: 100, tone: 'grade' },
  { from: '13:30', to: '14:15', learner: 'Tomás L.', topic: 'Word problems', mastery: 67, tone: 'ballpoint' },
];

const TONE: Record<Slot['tone'], string> = {
  grade: 'text-grade',
  redpen: 'text-redpen',
  ballpoint: 'text-ballpoint',
};

/** The display moment: Archivo Black, one highlighter accent, nothing else shouting. */
export const Masthead: Story = {
  render: () => (
    <Section className="gap-3 p-6">
      <Heading level={1} className="font-display text-display-lg text-text">
        Learn it <Text className="bg-highlighter text-on-highlighter">by heart.</Text>
      </Heading>
      <Paragraph className="max-w-content-prose font-sans text-lg text-text-muted">
        Archivo Black shouts once. Space Grotesk carries the reading. Chivo Mono holds every
        number in a column and doubles as the brand&rsquo;s dictionary device.
      </Paragraph>
    </Section>
  ),
};

/**
 * Doc 02 Addendum B's brand touchpoint. The part-of-speech is a real italic —
 * the italic cut ships precisely so this is not a synthesised oblique.
 */
export const DictionaryDevice: Story = {
  render: () => (
    <View className="p-6">
      <Section className={`${CARD} max-w-content-form gap-1`}>
        <Text className={LABEL}>Dictionary device</Text>
        <View className="flex-row items-baseline gap-2 pt-2">
          <Text className="font-mono text-4xl font-bold text-text">moyo</Text>
          <Text className="font-mono text-lg italic text-text-muted">n.</Text>
        </View>
        <Text className="font-mono text-lg text-text">heart</Text>
        <Text className="font-mono text-xs font-light text-text-muted">Swahili · Shona</Text>
      </Section>
    </View>
  ),
};

/**
 * The mono's functional job. Weight carries the hierarchy (doc 08 §3.2) — the
 * current row is the only bold thing — and tabular figures keep the column true
 * even when a mastery value reaches three digits.
 */
export const ScheduleFigures: Story = {
  render: () => (
    <View className="p-6">
      <Section className={`${CARD} gap-3`}>
        <Text className={LABEL}>Tue 24 Jun · Room B</Text>
        <Table>
          <TableBody>
            {DAY.map((slot) => (
              <TableRow
                key={slot.from}
                className={`border-b border-border ${slot.now ? 'bg-highlighter/20' : ''}`}
              >
                <TableCell className="py-2 pr-4">
                  <Time
                    className={`font-mono text-sm ${slot.now ? 'font-extrabold text-text' : 'font-medium text-text-muted'}`}
                  >
                    {slot.from}–{slot.to}
                  </Time>
                </TableCell>
                <TableCell className="py-2 pr-4">
                  <Text className="font-sans text-sm font-semibold text-text">{slot.learner}</Text>
                </TableCell>
                <TableCell className="py-2 pr-4">
                  <Text className="font-sans text-sm text-text">{slot.topic}</Text>
                </TableCell>
                <TableCell className="py-2">
                  <Text className={`font-mono text-sm font-bold ${TONE[slot.tone]}`}>
                    {slot.mastery}%
                  </Text>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </View>
  ),
};

/**
 * Why this face and not a two-weight mono: the schedule needs a quiet gutter, an
 * ordinary row, and an unmistakable now-marker out of one family.
 * The 0/O row is the reason build-css.mjs turns `zero` on for the whole family.
 */
export const MonoRange: Story = {
  render: () => (
    <View className="flex-row flex-wrap gap-4 p-6">
      <Section className={`${CARD} flex-1 gap-2`}>
        <Text className={LABEL}>Weight axis 100–900</Text>
        <Text className="font-mono text-lg font-extralight text-text">200 · quiet gutter time</Text>
        <Text className="font-mono text-lg font-normal text-text">400 · ordinary row</Text>
        <Text className="font-mono text-lg font-bold text-text">700 · the now-marker</Text>
        <Text className="font-mono text-lg font-black text-text">900 · emphatic</Text>
      </Section>
      <Section className={`${CARD} flex-1 gap-2`}>
        <Text className={LABEL}>Figures · 0 never reads as O</Text>
        <Text className="font-mono text-2xl font-semibold text-text">0O · 10:05 · ROOM B0</Text>
        <Text className="font-mono text-2xl font-semibold text-text">£30.00 · 09:45 · 100%</Text>
      </Section>
    </View>
  ),
};
