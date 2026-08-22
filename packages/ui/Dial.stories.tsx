// The dial, side by side — the design language made inspectable before any
// screen exists. Doc 03 §6 PR-1: "Storybook page rendering every component at
// both temperatures."
// SOT-KEYWORDS: dial stories hot cool temperature specimen comparison
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { Dial, type DialTemperature } from './Dial';
import { Heading, Paragraph, Section, Text } from './html';
import { TextField } from './TextField';
import { View } from './primitives';

// No `component:` — Dial's `children` is required, which would make `args`
// mandatory on every story and defeat the point of a render-only comparison.
const meta = { title: 'Foundations/Dial' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const LABEL = 'font-mono text-xs font-bold uppercase tracking-widest text-text-muted';

/** One column of the comparison — identical children, only the temperature differs. */
function Column({ temperature, caption }: { temperature: DialTemperature; caption: string }) {
  return (
    <View className="flex-1 gap-3">
      <Text className={LABEL}>{caption}</Text>
      <Dial temperature={temperature}>
        <View className="gap-4">
          <Card className="gap-2">
            <Heading level={3} className="font-sans text-lg font-bold text-text">
              Long division
            </Heading>
            <Paragraph className="font-sans text-sm text-text-muted">
              Daniel worked through remainders today and asked for one more example.
            </Paragraph>
            <View className="flex-row flex-wrap gap-2 pt-1">
              <Badge label="Mastery 41%" tone="danger" />
              <Badge label="Needs review" />
            </View>
          </Card>

          <View className="flex-row flex-wrap gap-2">
            <Button title="Book a session" />
            <Button title="Reschedule" variant="outline" />
          </View>

          <TextField label="Note for the guardian" placeholder="What went well?" />
        </View>
      </Dial>
    </View>
  );
}

/**
 * The whole point: the children are byte-identical between the two columns.
 * Only the wrapper's temperature changes, and radius, shadow and border colour
 * all move — no component takes a dial prop.
 */
export const HotAndCool: Story = {
  render: () => (
    <Section className="flex-row flex-wrap gap-6 bg-surface p-6">
      <Column temperature="hot" caption="Hot · learner + family" />
      <Column temperature="cool" caption="Cool · ops + educator" />
    </Section>
  ),
};

/**
 * How doc 02 §5.3 says the parent shells are built — "cool structure, hot
 * accents on child-related cards". Nesting is the whole mechanism.
 */
export const NestedParentSurface: Story = {
  render: () => (
    <Dial temperature="cool">
      <Section className="gap-4 bg-surface p-6">
        <Text className={LABEL}>Cool structure</Text>
        <Card className="gap-3">
          <Heading level={3} className="font-sans text-lg font-bold text-text">
            This week
          </Heading>
          <Paragraph className="font-sans text-sm text-text-muted">
            Ops chrome: hairline border, whisper of a shadow, tighter radius.
          </Paragraph>

          <Dial temperature="hot">
            <Card className="gap-1 bg-highlighter">
              <Text className="font-sans text-sm font-bold text-on-highlighter">
                Amina hit 95% on place value
              </Text>
              <Text className="font-mono text-xs text-on-highlighter">Tue 24 Jun · 11:15</Text>
            </Card>
          </Dial>
        </Card>
      </Section>
    </Dial>
  ),
};
