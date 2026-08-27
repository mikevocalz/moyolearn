'use client';
// K–2 learner hub — Today as a hub-and-spoke of giant tiles, not a feed.
// NN/g's children's findings (doc 36 §1): pre-readers don't scan and don't
// infer nav, so the screen itself IS the navigation — three tiles, one voice
// prompt, nothing that needs a gesture. Doc 08 §5 Focus archetype: one goal,
// ≥40% canvas, young-band targets on every tile.
// Mobbin: Babbel calm 3-destination learner shell (mobbin.com/screens/af715e9f-3b74-4de5-b014-55fa6748aa34) ·
// Speechify raised-center primary action (mobbin.com/screens/6fd8ade9-3090-4143-9141-a1c4051a81e2) ·
// Breathwrk single-primary hub (mobbin.com/screens/0591b7d1-ac2c-4b5a-88f9-880730ab8545)
// SOT: docs/pack/36-role-navigation-flows.md §3.1 · docs/pack/08-visual-hierarchy-spacing-spec.md §5
// SOT-KEYWORDS: learner hub k-2 young band today tiles natalie voice-first hub-and-spoke

import { Camera, MessageCircle, Star } from '@acme/ui/icons';
import { Section, View } from '@acme/ui/tw';
import { Avatar, FadeIn, Heading, MessageBubble, PressScale, Text } from '@acme/ui';
import { useRouter } from 'solito/navigation';
import { useAppSession } from '../../providers/session';

/**
 * The hub's three spokes mirror the K–2 tab bar on purpose: NN/g says mis-taps
 * must be recoverable, and two obvious doors to the same room beats one clever
 * one. `Snap` is the single primary (highlighter treatment); the others stay on
 * paper so the screen answers "what do I do" in one glance (doc 08 §3.2).
 */
const TILES = [
  {
    href: '/snap',
    label: 'Snap your homework',
    hint: 'Take a picture and we do it together',
    Icon: Camera,
    primary: true,
  },
  {
    href: '/tutor',
    label: 'Talk to Natalie',
    hint: 'Ask about anything',
    Icon: MessageCircle,
    primary: false,
  },
  {
    href: '/stuff',
    label: 'My Stuff',
    hint: 'Things you made',
    Icon: Star,
    primary: false,
  },
] as const;

export function LearnerHubContent() {
  const { user } = useAppSession();
  const router = useRouter();
  const firstName = user?.name?.split(' ')[0] ?? 'friend';

  return (
    <View className="gap-group">
      {/* Natalie speaks the screen: the voice prompt IS the instruction, so a
          pre-reader hears/sees one sentence, not a menu to parse. */}
      <FadeIn>
        <Section className="flex-row items-end gap-element">
          <Avatar name="Moyo" size="lg" />
          <MessageBubble from="tutor" className="flex-1">
            Hi {firstName}! What do you want to do today?
          </MessageBubble>
        </Section>
      </FadeIn>

      <Section className="gap-stack">
        {TILES.map((tile, index) => (
          <FadeIn key={tile.href} delay={80 + index * 60}>
            <PressScale
              outerClassName="w-full"
              className={`min-h-target-young w-full flex-row items-center gap-element rounded-card border-2 border-border p-inset-roomy shadow-card ${
                tile.primary ? 'bg-primary' : 'bg-surface'
              }`}
              aria-label={tile.label}
              onPress={() => router.push(tile.href)}
            >
              {/* One highlighter moment per screen (doc 08 §3.2): only the Snap
                  tile carries the accent; the other icon wells stay neutral. */}
              <View
                className={`h-14 w-14 items-center justify-center rounded-full border-2 border-border ${
                  tile.primary ? 'bg-surface' : 'bg-surface-sunken'
                }`}
              >
                <tile.Icon size={28} className="text-text" />
              </View>
              <View className="flex-1 gap-1">
                <Heading level={2} size="title" className={tile.primary ? 'text-on-primary' : 'text-text'}>
                  {tile.label}
                </Heading>
                <Text className={tile.primary ? 'text-on-primary/80' : 'text-text-muted'}>{tile.hint}</Text>
              </View>
            </PressScale>
          </FadeIn>
        ))}
      </Section>
    </View>
  );
}
