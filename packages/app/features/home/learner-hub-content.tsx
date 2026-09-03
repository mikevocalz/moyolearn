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
import { bandScaleFor } from '../capture/age-band';
import { stuffPath } from './learner-paths';

/**
 * The hub's three spokes mirror the K–2 tab bar on purpose: NN/g says mis-taps
 * must be recoverable, and two obvious doors to the same room beats one clever
 * one. `Snap` is the single primary; the others stay on paper so the screen
 * answers "what do I do" in one glance (doc 08 §3.2).
 * Hrefs are the routes that actually exist: `/capture` (the mobile capture tab
 * and web `(site)/capture`) and `/tutor` resolve on both platforms; "My Stuff"
 * is the one platform-forked path (learner-paths — mobile `/stuff`, web
 * `/practice`). The old `/snap`/`/stuff` literals 404'd on web.
 */
const TILES = [
  {
    href: '/capture',
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
    href: stuffPath(),
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
  // K–2 is the only band that reaches this hub, so the scale is READ rather
  // than assumed: the tiles hardcoded the same values, which is how a token
  // change silently stops reaching one screen.
  const scale = bandScaleFor('young');

  return (
    <View className={scale.gap}>
      {/* The screen needs one real title before anything else: a greeting
          bubble alone left this page with no h1 and nothing a screen reader
          could land on. The heading is the greeting; Natalie's line under it is
          the instruction — voice-first order, because a pre-reader does not
          scan a menu (doc 36 §1). */}
      <FadeIn>
        <Section className="gap-stack">
          <Heading level={1} size={scale.title}>
            Hi {firstName}
          </Heading>
          {/* CENTRED against the bubble, and it is NATALIE.

              It was `items-end`, which bottom-aligned a square avatar beside a
              one-line bubble and read as a misalignment rather than a choice.
              And it was `name="Moyo"` — the company — so the fallback initial
              drew a stray "M" beside her sentence while she is "N" everywhere
              else in the product, including the session rail. A child meeting
              their tutor for the first time on this screen should meet the same
              person they meet inside the lesson. */}
          <View className="flex-row items-center justify-center gap-element">
            <Avatar name="Natalie" size="lg" />
            {/* `self-center` overrides the bubble's own `self-start`, and the
                bubble hugs its text instead of taking `flex-1`: the pair is
                centred as ONE row, so the mark and her line read as a single
                greeting rather than an avatar with a banner stretched off it. */}
            <MessageBubble from="tutor" className="self-center">
              What do you want to do today?
            </MessageBubble>
          </View>
        </Section>
      </FadeIn>

      <Section className="gap-stack">
        {TILES.map((tile, index) => (
          <FadeIn key={tile.href} delay={80 + index * 60}>
            <PressScale
              outerClassName="w-full"
              /*
                `bg-action-primary` (teal), NOT `bg-primary` (yellow). The rail
                beside this screen paints its SELECTED tab in the highlighter
                yellow, and a hero card in the same hue made the primary action
                and the current-location marker the same colour — the one thing
                a K–2 screen cannot afford, since neither is learnable while
                they look alike. Teal also ties the tile to the raised camera
                slab in the rail, which is the same destination: one action,
                one colour, both planes.
              */
              className={`w-full flex-row items-center gap-element rounded-card border-2 border-border shadow-card ${scale.target} ${scale.inset} ${
                tile.primary ? 'bg-action-primary' : 'bg-surface'
              }`}
              aria-label={tile.label}
              onPress={() => router.push(tile.href)}
            >
              {/* One accent moment per screen (doc 08 §3.2): only the Snap tile
                  carries the fill; the other icon wells stay neutral. */}
              <View
                className={`h-14 w-14 items-center justify-center rounded-full border-2 border-border ${
                  tile.primary ? 'bg-surface' : 'bg-surface-sunken'
                }`}
              >
                <tile.Icon size={28} className="text-text" />
              </View>
              <View className="flex-1 gap-1">
                <Heading level={2} size="title" className={tile.primary ? 'text-on-action-primary' : 'text-text'}>
                  {tile.label}
                </Heading>
                <Text className={tile.primary ? 'text-on-action-primary/80' : 'text-text-muted'}>{tile.hint}</Text>
              </View>
            </PressScale>
          </FadeIn>
        ))}
      </Section>
    </View>
  );
}
