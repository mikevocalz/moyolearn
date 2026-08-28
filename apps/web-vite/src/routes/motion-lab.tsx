/**
 * `/motion-lab` — every motion primitive, on one page, in both motion states.
 *
 * This is the audit surface for `design-critique` and `accessibility-review`.
 * It is not a marketing page: it is `noindex, nofollow`, it is deliberately not
 * linked from `/` so `crawlLinks` never reaches it, and it is excluded from the
 * sitemap. It is listed in vite.config.ts `pages` so it still prerenders and can
 * be audited against the built output rather than only against `vite dev`.
 *
 * ── THE THING THIS PAGE PROVES ──────────────────────────────────────────────
 * Every element below is authored in its FINAL state. Nothing carries an
 * opacity-0, a translate, a clipped dash or a hidden register in markup or CSS.
 * The primitives create their own start states at build time, in the browser,
 * after checking the reduced-motion preference. So the reduced-motion pass, the
 * JS-off pass and the prerendered HTML are the same finished page, and the
 * "animates in, stays invisible" failure has nowhere to occur. Flip the toggle
 * at the top and every scene reverts and rebuilds in its end state with no
 * content lost — that is the single source of truth working, demonstrated
 * rather than asserted.
 *
 * The toggle writes to `usePerfStore` through the same public setter the OS
 * media-query listener uses. There is no lab-only bypass: a bypass would mean
 * the thing being audited is not the thing that ships.
 *
 * `motion-*` classes are behaviour hooks, not styles. They are how a scene
 * addresses its elements, because `@acme/ui` components are typed
 * `ComponentType<ViewProps>` and take neither a ref nor a `data-*` attribute —
 * className is the only channel through to the DOM (see use-motion-scene.ts).
 *
 * SOT: apps/web-vite/src/motion/primitives.ts · docs/site/motion-matrix.md
 * SOT-KEYWORDS: web-vite motion lab demo route primitives audit reduced-motion
 *               noindex thunk peel draw snap compress page-turn pulse parallax
 */
import { Container, Heading, Text, useHydrated } from '@acme/ui';
import { Button, List, ListItem, Main, Paragraph, Section, View } from '@acme/ui/primitives';
import { createFileRoute } from '@tanstack/react-router';
import { create } from 'zustand';
import { usePerfStore } from '@/stores/perf-store';
import { useMotionScene } from '../motion';
import type { MotionScene } from '../motion';

const TITLE = 'Motion lab — Moyo';
const SCOPE = '.motion-lab';

export const Route = createFileRoute('/motion-lab')({
  head: () => ({
    meta: [
      { title: TITLE },
      // The one thing between an internal audit surface and the search index.
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: MotionLab,
});

/**
 * The lab's own interaction state: which register is showing, and whether
 * Natalie is listening. Module-scope Zustand, not shared — and deliberately not
 * a mirror of `usePerfStore`, which stays the only place reduced motion lives.
 */
interface LabState {
  register: 'parents' | 'schools';
  listening: boolean;
  /**
   * Every ScrollTrigger registered in the DOCUMENT, not just this scene. It is
   * on the page because "we kill our triggers on unmount" is a claim an auditor
   * should be able to falsify: rebuild the scene by flipping reduced motion and
   * watch the number return to where it was. A leaking `ctx.revert()` shows up
   * as a number that climbs.
   */
  triggerCount: number;
  toggleRegister: () => void;
  toggleListening: () => void;
  setTriggerCount: (triggerCount: number) => void;
}

const useLabStore = create<LabState>()((set) => ({
  register: 'parents',
  listening: false,
  triggerCount: 0,
  toggleRegister: () =>
    set((state) => ({ register: state.register === 'parents' ? 'schools' : 'parents' })),
  toggleListening: () => set((state) => ({ listening: !state.listening })),
  setTriggerCount: (triggerCount) => set({ triggerCount }),
}));

const CARDS = ['Ask', 'Try', 'Check'] as const;
const BLOCKS = ['Place value', 'Regrouping', 'Estimation', 'Word problems'] as const;

const SLAB = 'border-moyo-rule rounded-moyo-square border-moyo-outline bg-moyo-paper-raised';
const CONTROL = `moyo-pressable ${SLAB} px-inset-roomy py-inset self-start`;

function MotionLab() {
  /*
    The hydration law, applied to the one page that has to display the value it
    forbids branching on. The server has no motion preference — it renders one
    document for every reader — so a first client render that already knew the
    answer would be a text mismatch (React #418, which is exactly what the first
    version of this page produced). `useHydrated` from the kit reports false
    until after hydration, so the first paint matches the server byte for byte
    and the real answer arrives a tick later as an ordinary state change.

    Chapters never need this: they must not branch markup on reduced motion at
    all. This page is the exception because reporting the state IS its job.
  */
  const hydrated = useHydrated();
  const reducedMotion = usePerfStore((state) => state.reducedMotion) && hydrated;
  const setReducedMotion = usePerfStore((state) => state.setReducedMotion);
  const register = useLabStore((state) => state.register);
  const listening = useLabStore((state) => state.listening);
  const triggerCount = useLabStore((state) => state.triggerCount);
  const toggleRegister = useLabStore((state) => state.toggleRegister);
  const toggleListening = useLabStore((state) => state.toggleListening);

  useMotionScene(SCOPE, buildScene, [register, listening]);

  return (
    <Main className="motion-lab min-h-screen bg-moyo-paper py-section">
      <Container width="wide" className="gap-section">
        <Section className="gap-stack">
          <Text variant="label" className="text-site-label text-moyo-secondary">
            Internal · not indexed
          </Text>
          <Heading
            level={1}
            size="display-xl"
            className="font-moyo-display text-site-chapter md:text-site-chapter"
          >
            Motion lab
          </Heading>
          <Paragraph className="max-w-content-prose text-site-lead">
            Every primitive in the site vocabulary, in both motion states. Each element
            below is written in its finished state; the movement is added by the browser
            after it has read your motion preference.
          </Paragraph>
          <View className="flex-row flex-wrap items-center gap-group">
            <Button
              className={`${CONTROL} bg-moyo-primary text-moyo-on-primary`}
              onPress={() => setReducedMotion(!reducedMotion)}
              aria-pressed={reducedMotion}
            >
              {reducedMotion ? 'Reduced motion: on' : 'Reduced motion: off'}
            </Button>
            {/*
              A live region, not a caption. The same pattern the listening state
              below uses, and the reason `pulse` is allowed to be decorative:
              every motion on this site is a second channel for something that
              is already announced in text.
            */}
            <Text aria-live="polite" className="text-site-body text-moyo-ink-muted">
              {reducedMotion
                ? 'Primitives are applying their end states immediately.'
                : 'Primitives are animating.'}
              {` ScrollTriggers registered: ${triggerCount}.`}
            </Text>
          </View>
        </Section>

        <LabSection title="Cards thunk" note="Fast in, 2.5% overshoot, hard settle.">
          <View className="flex-row flex-wrap gap-group">
            {CARDS.map((card) => (
              <View key={card} className={`motion-thunk ${SLAB} min-w-40 p-inset-roomy shadow-moyo-2`}>
                <Text className="text-site-subtitle">{card}</Text>
              </View>
            ))}
          </View>
        </LabSection>

        <LabSection
          title="Workbooks open"
          note="The cover hinges on its spine and swings past vertical."
        >
          <View className="border-moyo-slab relative h-56 w-44 rounded-moyo-square border-moyo-outline bg-moyo-paper-sunken p-inset">
            <Text className="text-site-body text-moyo-ink-muted">Inside the workbook</Text>
            <View className="motion-workbook border-moyo-slab absolute inset-0 rounded-moyo-square border-moyo-outline bg-moyo-earth p-inset">
              <Text className="text-site-subtitle text-moyo-on-earth">Fractions</Text>
            </View>
          </View>
        </LabSection>

        <LabSection title="Stickers peel" note="Fires once on entry. Never loops.">
          <View className="motion-sticker border-moyo-rule self-start rounded-moyo-square border-moyo-outline bg-moyo-sun px-inset-roomy py-inset shadow-moyo-1">
            <Text className="text-site-subtitle text-moyo-on-sun">Learned it</Text>
          </View>
        </LabSection>

        <LabSection
          title="Pencil underlines draw"
          note="SVG stroke-dashoffset. The dash is written by the primitive, never by CSS — so with no JS the line is simply drawn."
        >
          <View className="gap-stack">
            <Text className="text-site-title">Learn it by heart</Text>
            {/*
              A raw <svg>. The kit has no SVG primitive on this surface, and the
              draw personality is defined by `getTotalLength()`, which only a real
              SVGGeometryElement has. Decorative, so aria-hidden.
            */}
            <svg width="260" height="14" viewBox="0 0 260 14" aria-hidden="true">
              <path
                className="motion-underline"
                d="M2 9 C 60 2, 140 13, 258 4"
                fill="none"
                stroke="var(--color-moyo-heart)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </View>
        </LabSection>

        <LabSection
          title="Wrong approaches get crossed out"
          note="The end state is the struck-through mark, visible."
        >
          <View className="relative self-start px-inset py-inset">
            <Text className="text-site-subtitle text-moyo-ink-muted">Memorise the table</Text>
            <View className="motion-strike absolute inset-x-0 top-1/2 h-1 bg-moyo-heart" />
          </View>
        </LabSection>

        <LabSection
          title="Mastery blocks snap into the grid"
          note="Progress is pieces locking into place. Never confetti."
        >
          <List className="flex-row flex-wrap gap-stack">
            {BLOCKS.map((block) => (
              <ListItem
                key={block}
                className="motion-block border-moyo-rule rounded-moyo-square border-moyo-outline bg-moyo-leaf px-inset-roomy py-inset"
              >
                <Text className="text-site-body text-moyo-on-leaf">{block}</Text>
              </ListItem>
            ))}
          </List>
          <View className={`motion-lock ${SLAB} border-moyo-slab mt-stack self-start px-inset-roomy py-inset`}>
            <Text className="text-site-body">4 of 4 seated</Text>
          </View>
        </LabSection>

        <LabSection
          title="Pages turn between registers"
          note="Navigation first: the register switches whether or not the turn plays."
        >
          <View className="gap-stack">
            <Button className={CONTROL} onPress={toggleRegister}>
              {register === 'parents' ? 'Show: for schools' : 'Show: for parents'}
            </Button>
            <View
              key={register}
              className={`motion-page ${SLAB} p-inset-roomy shadow-moyo-2`}
            >
              <Text className="text-site-subtitle">
                {register === 'parents' ? 'For parents' : 'For schools'}
              </Text>
            </View>
          </View>
        </LabSection>

        <LabSection
          title="Draggables carry rotational inertia"
          note="Drag the card. It trails the hand, then squares up."
        >
          <View className={`motion-draggable ${SLAB} border-moyo-slab w-52 cursor-grab p-inset-roomy shadow-moyo-2`}>
            <Text className="text-site-body">Drag me</Text>
          </View>
        </LabSection>

        <LabSection
          title="Buttons compress like objects"
          note="Travel equals the shadow offset, because both are calc()'d from the same token."
        >
          <Button className={`motion-press ${CONTROL} bg-moyo-heart text-moyo-on-heart`}>
            Press and hold
          </Button>
        </LabSection>

        <LabSection
          title="The mark pulses while Natalie listens"
          note="Only while listening, and never as the only signal."
        >
          <View className="flex-row flex-wrap items-center gap-group">
            <Button className={CONTROL} onPress={toggleListening} aria-pressed={listening}>
              {listening ? 'Stop listening' : 'Start listening'}
            </Button>
            <View className="motion-mark border-moyo-slab size-14 rounded-moyo-square border-moyo-outline bg-moyo-primary" />
            <Text aria-live="polite" className="text-site-body text-moyo-ink-muted">
              {listening ? 'Natalie is listening.' : 'Natalie is not listening.'}
            </Text>
          </View>
        </LabSection>

        <LabSection
          title="Parallax"
          note="Scroll-scrubbed. Frozen at its layout position under reduced motion."
        >
          <View className="relative h-64 overflow-hidden rounded-moyo-square bg-moyo-paper-sunken">
            <View className={`motion-parallax ${SLAB} absolute inset-x-0 top-1/2 mx-auto w-3/4 p-inset-roomy`}>
              <Text className="text-site-body">Depth layer</Text>
            </View>
          </View>
        </LabSection>

        <LabSection
          title="Split reveal"
          note="Not split at all under reduced motion — the heading stays one node for the screen reader."
        >
          <Heading
            level={2}
            size="display-xl"
            className="motion-split font-moyo-display text-site-title md:text-site-title"
          >
            Practice becomes understanding that lasts
          </Heading>
        </LabSection>
      </Container>
    </Main>
  );
}

interface LabSectionProps {
  title: string;
  note: string;
  children: React.ReactNode;
}

function LabSection({ title, note, children }: LabSectionProps) {
  return (
    <Section className="border-moyo-hair gap-stack border-l-moyo-outline pl-inset-roomy">
      <Heading
        level={2}
        size="title"
        className="font-moyo-display text-site-subtitle md:text-site-subtitle"
      >
        {title}
      </Heading>
      <Paragraph className="max-w-content-prose text-site-body text-moyo-ink-muted">
        {note}
      </Paragraph>
      {children}
    </Section>
  );
}

/**
 * Declared outside the component so it is a stable reference and the scene is
 * rebuilt by its declared deps rather than by every render. Selector strings are
 * scoped by `gsap.context` to the `<Main>` this lab owns, so none of them can
 * reach another route's markup.
 */
function buildScene({ motion, scope }: MotionScene): () => void {
  motion.thunk({ targets: '.motion-thunk', stagger: 0.06, scroll: {} });
  motion.open({ targets: '.motion-workbook', scroll: {} });
  motion.peel({ targets: '.motion-sticker', scroll: {} });
  motion.draw({ targets: '.motion-underline', scroll: {} });
  motion.crossOut({ targets: '.motion-strike', scroll: {} });
  motion.snap({ targets: '.motion-block', stagger: 0.08, scroll: {} });
  motion.lockIn({ targets: '.motion-lock', scroll: {} });
  motion.pageTurn({ targets: '.motion-page' });
  motion.parallax({ targets: '.motion-parallax', distance: '-4rem' });
  const { split } = motion.splitReveal({ targets: '.motion-split', scroll: {} });

  const press = motion.compress({ targets: '.motion-press' });
  const pressable = scope.querySelector('.motion-press');
  const onPressDown = (): void => {
    press.play();
  };
  const onPressUp = (): void => {
    press.reverse();
  };
  pressable?.addEventListener('pointerdown', onPressDown);
  pressable?.addEventListener('pointerup', onPressUp);
  pressable?.addEventListener('pointerleave', onPressUp);

  const draggable = scope.querySelector<HTMLElement>('.motion-draggable');
  const unbindDrag = draggable ? motion.bindDragInertia(draggable) : undefined;

  const mark = motion.pulse({ targets: '.motion-mark' });
  if (useLabStore.getState().listening) mark.play();

  // Read AFTER every primitive has been built, and document-wide rather than
  // scene-wide: a trigger this scene's revert failed to kill would still be in
  // this number on the next rebuild, which is the whole point of showing it.
  useLabStore.getState().setTriggerCount(motion.ScrollTrigger.getAll().length);

  /*
    Returned to `gsap.context`, which runs it on revert (see
    motion/use-motion-scene.ts). Timelines and ScrollTriggers are killed by the
    context itself; only what GSAP did not create is named here — the DOM
    listeners, and the SplitText instance, whose `autoSplit` observers outlive
    the tween that used it.
  */
  return () => {
    pressable?.removeEventListener('pointerdown', onPressDown);
    pressable?.removeEventListener('pointerup', onPressUp);
    pressable?.removeEventListener('pointerleave', onPressUp);
    unbindDrag?.();
    split?.revert();
  };
}
