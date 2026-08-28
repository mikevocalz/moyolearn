/**
 * The site's masthead — wordmark, four anchors, one primary CTA.
 *
 * `Start learning` is the ONE primary action on the page and it carries the
 * same label here, in the hero and in chapter 08. The copy deck §1 makes that
 * structural rather than stylistic: doc 38 §6's rule is that the same action
 * keeps the same name through the whole flow, and the screen this lands on is
 * the front door (FD-01), so the site's verb and the app's first screen must
 * not disagree. `Log in` is the glossary form; `Sign in` is never used.
 *
 * ── THE ANCHOR CONTRACT ─────────────────────────────────────────────────────
 * The nav is the one surface that has to know every chapter's id, and it is
 * built before four of them exist. The ids below are the contract; a chapter
 * that renders under a different id silently breaks a nav link, and nothing
 * fails at build time to tell you.
 *
 *   #hero          chapter 01 (this lane)   — also the skip-link target
 *   #desk          chapter 02 (this lane)
 *   #conversation  chapter 03 (this lane)   — `How it works`
 *   #for-parents   chapter 06               — `For parents`
 *   #for-schools   chapter 07               — `For schools`
 *   #start         chapter 08               — `Pricing`
 *
 * The skip link points at `#hero` rather than at a `#main-content` the route
 * would have to supply, so this component is complete on its own: a skip link
 * that depends on somebody else adding an id is a skip link that ships broken.
 *
 * Because the bar is sticky, it also owes every one of those anchors a scroll
 * offset — without it a chapter's first line lands behind the bar. That is
 * declared once in `./site-nav.css`, next to the element that causes it, rather
 * than as a `scroll-mt-*` repeated on every `<Section>` on the page.
 *
 * Mobbin: no nav-specific pass exists in docs/site/mobbin/ — the index was
 * queried for heroes, bentos, conversations and footers, not for mastheads. The
 * two structural moves borrowed here therefore come from the hero pass and are
 * cited as such: https://mobbin.com/sites/sections/4e363497-beed-4917-9f40-2ddee269fb2c
 * (Craft — hierarchy carried by fill weight rather than by position or size, so
 * the CTA is the only filled object in the bar and `Log in` sits beside it as
 * plain type) · https://mobbin.com/sites/sections/4de98a06-dbff-4e54-83c6-a301c519bba0
 * (SSENSE — the size gap IS the hierarchy, which is why the mobile takeover
 * sets its links at chapter scale instead of shrinking the desktop bar into a
 * drawer). Structure only.
 *
 * SOT: docs/site/copy-deck.md §1 · docs/site/tokens.md · docs/site/motion-matrix.md
 *      docs/site/component-inventory.md (#9, `MoyoSiteNav`)
 * SOT-KEYWORDS: site nav masthead sticky wordmark anchors cta start learning
 *               log in mobile takeover menu zustand thunk compress web-vite
 */
import { useEffect } from 'react';
import { Container, Text } from '@acme/ui/typography';
import { Button, Header, Link, Nav, View } from '@acme/ui/primitives';
import { create } from 'zustand';
import { useMotionScene } from '@/motion';
import type { MotionScene } from '@/motion';
import './site-nav.css';

const SCOPE = '.site-nav';

const APP_START = '/onboarding';
const APP_LOGIN = '/login';

/** The four sitemap anchors, in the deck's order. */
const LINKS = [
  { href: '#conversation', label: 'How it works' },
  { href: '#for-parents', label: 'For parents' },
  { href: '#for-schools', label: 'For schools' },
  { href: '#start', label: 'Pricing' },
] as const;

/**
 * Whether the mobile takeover is showing. Module-scope Zustand rather than
 * component state, per the site's convention — and deliberately not merged into
 * `usePerfStore`, which stays the one place motion preference lives.
 *
 * It starts closed, which is also what the server renders, so the first client
 * render matches the prerendered document byte for byte.
 */
interface NavState {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const useNavStore = create<NavState>()((set) => ({
  open: false,
  toggle: () => set((state) => ({ open: !state.open })),
  close: () => set({ open: false }),
}));

const RULE = 'border-moyo-rule border-moyo-outline border-x-0 border-t-0';
const CONTROL = 'moyo-pressable items-center justify-center min-h-target-adult px-inset-roomy py-inset';
/** The one filled object in the bar. Slab frame, because it is the page's primary. */
const CTA = `site-nav-cta ${CONTROL} border-moyo-slab rounded-moyo-square border-moyo-outline bg-moyo-primary text-moyo-on-primary text-site-body`;

export function SiteNav() {
  const open = useNavStore((state) => state.open);
  const toggle = useNavStore((state) => state.toggle);
  const close = useNavStore((state) => state.close);

  useMotionScene(SCOPE, buildNavScene, [open]);

  /*
    A full-screen takeover owes the keyboard three things, and none of them are
    animation: Escape closes it, opening it moves focus into it, and following
    one of its links dismisses it. The third is handled here rather than with an
    `onPress` per link because the anchors are same-page — the browser scrolls
    without unmounting anything, so a menu that does not close itself lands the
    reader on a chapter hidden behind a full-screen panel.
  */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    const takeover = document.querySelector<HTMLElement>('.site-nav-takeover');
    const onClick = (event: MouseEvent): void => {
      if ((event.target as HTMLElement | null)?.closest('a')) close();
    };

    document.addEventListener('keydown', onKeyDown);
    takeover?.addEventListener('click', onClick);
    document.querySelector<HTMLElement>('.site-nav-close')?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      takeover?.removeEventListener('click', onClick);
    };
  }, [open, close]);

  return (
    <Header className={`site-nav sticky top-0 z-50 bg-moyo-paper ${RULE}`}>
      {/*
        The first focusable element on the page. `sr-only` until focused, then a
        real, visible, outlined control — a skip link nobody can see when they
        tab to it is a skip link that does not exist.
      */}
      <Link
        href="#hero"
        className="sr-only focus:not-sr-only focus:absolute focus:left-0 focus:top-0 focus:z-50 focus:border-moyo-rule focus:border-moyo-outline focus:bg-moyo-paper-raised focus:px-inset-roomy focus:py-inset focus:text-site-body"
      >
        Skip to main content
      </Link>

      <Container
        width="wide"
        className="flex-row items-center justify-between gap-group py-inset"
      >
        <Link
          href="/"
          aria-label="Moyo AI — home"
          className="font-moyo-display text-site-subtitle uppercase"
        >
          Moyo AI
        </Link>

        <Nav aria-label="Primary" className="hidden lg:flex lg:flex-row lg:items-center lg:gap-group">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-site-body">
              {link.label}
            </Link>
          ))}
        </Nav>

        <View className="hidden lg:flex lg:flex-row lg:items-center lg:gap-stack">
          <Link href={APP_LOGIN} className="text-site-body underline">
            Log in
          </Link>
          <Link href={APP_START} className={CTA}>
            Start learning
          </Link>
        </View>

        {/*
          The mobile trigger. A real <button>, because it operates a widget on
          this page rather than going anywhere — and it carries `aria-expanded`
          so the state is announced rather than only drawn.
        */}
        <Button
          className={`site-nav-cta ${CONTROL} border-moyo-rule rounded-moyo-square border-moyo-outline bg-moyo-paper-raised text-site-body lg:hidden`}
          onPress={toggle}
          aria-expanded={open}
        >
          {open ? 'Close menu' : 'Open menu'}
        </Button>
      </Container>

      {open ? (
        /*
          A takeover, not a drawer. The links are set at chapter scale on a
          full sheet of paper — the SSENSE size-gap move applied to navigation,
          so a phone gets the same "the sentence is the object" reading the hero
          gets rather than a shrunken copy of the desktop bar.
        */
        <View
          role="dialog"
          aria-modal
          aria-label="Menu"
          className="site-nav-takeover fixed inset-0 z-50 gap-section overflow-y-auto bg-moyo-paper p-inset-roomy"
        >
          <View className="flex-row items-center justify-between gap-group">
            <Text className="font-moyo-display text-site-subtitle uppercase md:text-site-subtitle">
              Moyo AI
            </Text>
            <Button
              className={`site-nav-close site-nav-cta ${CONTROL} border-moyo-rule rounded-moyo-square border-moyo-outline bg-moyo-paper-raised text-site-body`}
              onPress={close}
            >
              Close menu
            </Button>
          </View>

          <Nav aria-label="Primary" className="gap-group">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="site-nav-item font-moyo-display text-site-title uppercase"
              >
                {link.label}
              </Link>
            ))}
          </Nav>

          <View className="gap-stack">
            <Link href={APP_START} className={`site-nav-item ${CTA} self-start`}>
              Start learning
            </Link>
            <Link href={APP_LOGIN} className="site-nav-item text-site-body underline">
              Log in
            </Link>
          </View>
        </View>
      ) : null}
    </Header>
  );
}

/**
 * The bar itself never animates — chrome that moves on every scroll is noise.
 * Two things do:
 *
 *   The takeover's contents THUNK in, staggered, when it opens. Rebuilt on the
 *   `open` dependency, so the stagger runs each time rather than once per page.
 *
 *   Every control COMPRESSES toward its own shadow on press. `compress` is the
 *   one primitive on `reducedMotion: 'instant'`: a control that stops
 *   responding has lost its affordance for exactly the reader who asked for
 *   less movement, so it keeps its beats and loses its duration.
 *
 * Under reduced motion the takeover's items are simply present, at rest, in
 * place. Nothing about the menu depends on an animation completing.
 */
function buildNavScene({ motion, scope }: MotionScene): () => void {
  // Guarded rather than fired blind: with the takeover closed there are no
  // items, and a primitive handed an empty selector logs a missing-target
  // warning on every render of a page that is behaving correctly.
  if (scope.querySelector('.site-nav-item')) {
    motion.thunk({ targets: '.site-nav-item', stagger: 0.06 });
  }

  const disposers: (() => void)[] = [];
  for (const control of scope.querySelectorAll<HTMLElement>('.site-nav-cta')) {
    const press = motion.compress({ targets: control });
    const down = (): void => {
      press.play();
    };
    const up = (): void => {
      press.reverse();
    };
    control.addEventListener('pointerdown', down);
    control.addEventListener('pointerup', up);
    control.addEventListener('pointerleave', up);
    control.addEventListener('focus', down);
    control.addEventListener('blur', up);
    disposers.push(() => {
      control.removeEventListener('pointerdown', down);
      control.removeEventListener('pointerup', up);
      control.removeEventListener('pointerleave', up);
      control.removeEventListener('focus', down);
      control.removeEventListener('blur', up);
    });
  }

  return () => {
    for (const dispose of disposers) dispose();
  };
}
