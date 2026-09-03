'use client';
// DashboardShell — the Cool-dial ops chrome: a sidebar that collapses to an icon
// rail, a top bar, and the content column.
//
// Pure presentation. Nav items and the collapse store come in as props, so the
// CRM, the educator console and the institution dashboard share one shell
// without this file learning anything about any of them.
// SOT: docs/pack/02-adaptive-screens-design-spec.md §5.3 (Cool dial) · doc 08 §4.9
// SOT-KEYWORDS: dashboard shell sidebar rail nav collapse ops chrome responsive
// Mobbin: https://mobbin.com/screens/35f5c474-ed6a-4c77-a6cb-f2e1d6b12398 (Twenty —
//   quiet sidebar, workspace switcher pinned top, settings pinned bottom) ·
//   https://mobbin.com/screens/45d9181e-ad36-4146-91ea-93ce49aef464 (Pipedrive —
//   nav grouped under small uppercase section labels) ·
//   https://mobbin.com/screens/361cd854-5aba-4f47-8457-b63c3699c4ae (Turo — the
//   collapsed state keeps a tiny label under each icon rather than icon-only) ·
//   https://mobbin.com/screens/906938fc-3914-4f31-ae27-bc08a2e9e412 (Sentry — the
//   collapse toggle lives in the sidebar itself, at its top edge) ·
//   https://mobbin.com/screens/0b39694c-dee7-4300-9f2e-ebe25b14c75e (Whop —
//   grouped nav stays scannable past twenty items)
import type { ReactNode } from 'react';
import { tv } from './tv';
import { Pressable, Text, View } from './primitives';
import { PanelLeftClose, PanelLeftOpen } from './icons';
import { Nav } from './tw';
import { NavDrawerButton } from './NavDrawerButton';
import { useReducedMotion } from './motion';
import { haptics } from './haptics';

export interface NavItem {
  id: string;
  label: string;
  /**
   * Shorter form for the collapsed rail. Supply one whenever `label` would
   * elide at ~100px — an ellipsis in a nav is worse than a shorter word, and
   * truncating the product's own vocabulary is the product's call, not the
   * layout's.
   */
  railLabel?: string;
  /**
   * Pass SIZE only — e.g. `<Users className="h-4 w-4" />`. The shell owns the
   * colour: lucide icons stroke with `currentColor`, so the wrapper sets it and
   * the icon tracks the active state for free. A colour class here wins over
   * the wrapper and freezes the icon graphite while its label goes white.
   */
  icon: ReactNode;
  onPress: () => void;
  active?: boolean;
  /** Rendered as a count pill; omit rather than passing 0. */
  badge?: number;
}

export interface NavGroup {
  /** Small caps section label. Omit for the first, unlabelled group. */
  title?: string;
  items: NavItem[];
}

/** `auto` defers to the breakpoint; the other two are the user overriding it. */
export type SidebarMode = 'auto' | 'rail' | 'menu';

export interface DashboardShellProps {
  groups: NavGroup[];
  /** Brand lockup, top of the sidebar. */
  brand: ReactNode;
  /** Compact brand mark shown on the rail. */
  brandMark: ReactNode;
  /**
   * `auto` is the responsive default — rail on a tablet, menu on a desktop —
   * and it is a THIRD state rather than a boolean seeded at mount.
   *
   * A boolean cannot say "rail by default here, menu by default there, until the
   * user decides otherwise". Resolving it in JS from a window width would work
   * but has to guess during SSR, so the first paint flickers to the other layout
   * on every load. As a mode, CSS resolves `auto` per breakpoint with no
   * measurement at all, and an explicit choice simply stops consulting it.
   */
  mode: SidebarMode;
  onSetMode: (mode: 'rail' | 'menu') => void;
  /** Below `md` the sidebar is an overlay driven by this pair. */
  menuOpen: boolean;
  onToggleMenu: () => void;
  /** Left of the top bar — breadcrumb or page title. */
  topBarStart?: ReactNode;
  /** Right of the top bar — search, actions, account. */
  topBarEnd?: ReactNode;
  children: ReactNode;
}

/*
  Which FORM is on screen at each breakpoint, as visibility classes.

  Both the menu form and the rail form of a thing are rendered and CSS picks,
  because under `auto` the answer differs by breakpoint and no JS value can hold
  two answers at once. `aria-label` on the row carries the real label, so the
  duplicate text is never announced twice.
*/
const MENU_ONLY: Record<SidebarMode, string> = {
  auto: 'flex md:hidden lg:flex',
  rail: 'flex md:hidden',
  menu: 'flex',
};

const RAIL_ONLY: Record<SidebarMode, string> = {
  auto: 'hidden md:flex lg:hidden',
  rail: 'hidden md:flex',
  menu: 'hidden',
};

/*
  The same rule for TEXT, and it must not say `flex`.

  Making a label a flex container stops `text-center` centring it — the label
  becomes a flex item aligned to the start instead — which is why "Enrol" sat
  flush against the rail's left edge while every label without a rail variant
  stayed centred under its icon.
*/
const MENU_ONLY_TEXT: Record<SidebarMode, string> = {
  auto: 'block md:hidden lg:block',
  rail: 'block md:hidden',
  menu: 'block',
};

const RAIL_ONLY_TEXT: Record<SidebarMode, string> = {
  auto: 'hidden md:block lg:hidden',
  rail: 'hidden md:block',
  menu: 'hidden',
};

const shell = tv({
  slots: {
    /*
      `dial-cool` scopes the whole surface: 44px rows, 12–16 insets, the 2px
      whisper shadow. Ops chrome never runs Hot.
    */
    /*
      `h-full`, and the CALLER owns the viewport height — see the ops layout.
      `h-dvh` here silently did nothing, because react-native-css compiles this
      root's classes to inline styles and drops `dvh`; the shell then sized to
      its content and the sidebar scrolled with the page.
    */
    root: 'dial-cool relative h-full flex-1 flex-row overflow-hidden bg-tenant-surface',
    /*
      `border-border`, not `border-border-strong`. Inside `.dial-cool` that
      resolves to `border-soft` — ink at 80% — which is what doc 02 §5.3
      specifies for Cool chrome. Every rule here was full-strength ink (pure
      white in dark mode): the spine, the brand divider and the top bar all
      shouted at one volume, so the active tab could not read as louder than the
      frame it was breaking, and the whole shell looked like stacked errors.
      Chrome is soft; the current tab is the one strong border on the surface.
    */
    /*
      THREE layouts, one element.

      < md   overlay drawer, hidden until the hamburger opens it.
      md–lg  a 112px LABELLED rail — icon over a one-word label, in flow.
      >= lg  in flow, width driven by the user's own collapse preference.

      A 56px hover-expand rail was tried here and removed. Two reasons, and the
      second is the disqualifying one:

      1. It relied on the rail CLIPPING its labels, so at rest every item showed
         a single letter — "T", "C", "L" — and the group headings showed "PIPE".
         Partial words read as a rendering fault, not as an affordance. Making
         the labels genuinely hidden at rest instead needs a parent-hover →
         child-style rule (`group-hover:`), which is a CSS descendant selector;
         react-native-css compiles classNames to inline styles, so a child
         cannot see an ancestor's hover state. It would need JS hover state.
      2. md–lg is overwhelmingly TOUCH. Hover does not exist there, so the
         labels would never appear on the devices that need them most.

      A labelled rail needs no hover, works on touch, and never shows half a
      word. It is also already proven — it is the same layout the lg collapsed
      state uses.
    */
    /*
      The base is the MENU, and the rail is only ever the `collapsed` variant.

      It used to be the other way round: the base was a 112px rail and `lg:`
      classes grew it into a menu, while `collapsed` shrank it back at `lg:`. So
      the rail was encoded twice, and between md and lg the sidebar was a rail
      NOBODY COULD LEAVE — the toggle whose entire job is menu-versus-rail was
      `lg:flex` and simply absent at the width where you were stuck in one.
      One source of truth now: `collapsed` decides, everywhere the sidebar is
      docked.
    */
    /*
      `bg-tenant-sidebar` is the RAIL's plane, and the drawer inherits it for
      free because the drawer IS this element — the three layouts above are one
      node that CSS re-forms, not three surfaces that have to be kept in step.
      Nothing here may fork the fill per layout: an overlay drawer painted
      `tenant-surface` would read as the page sliding over itself rather than as
      the rail coming out to meet you, which is exactly the defect the Hot shell
      had (apps/web RoleShell) before it was pointed at this same token.
    */
    sidebar:
      'absolute inset-y-0 left-0 z-50 w-pane-primary-narrow flex-col border-r-2 border-tenant-border bg-tenant-sidebar ' +
      'md:relative md:z-auto',
    sidebarInner: 'flex-1 flex-col gap-group overflow-y-auto p-inset-tight',
    // whitespace-nowrap so the rail CLIPS the heading instead of wrapping it —
    // at 56px "PIPELINE" reflowed to one letter per line and turned the rail
    // into a column of vertical text.
    // Hidden on the rail: two-word headings cannot survive a 112px column, and
    // the icons already do the grouping there.
    groupLabel:
      'flex shrink-0 whitespace-nowrap px-inset-tight pb-element text-caption font-semibold uppercase tracking-wide text-tenant-sidebar-muted',
    /*
      Active = a filled rounded rect, no border. Six shipped sidebars were
      pulled for this (Revolut Business, TravelPerk, Slite, Linear, Kajabi,
      Docusign) and five of the six mark the current section exactly this way;
      only Docusign uses a left bar.

      An earlier pass tried a binder-index-tab — the active item filled in the
      page colour, three-sided border, overhanging the spine to join the
      content. It was subject-native and it did not work: against a bordered
      neubrutalist frame the break in the spine read as a rendering fault, not
      as intent. The nav is not where this product should be inventive; the
      fill, the type and the tokens already make it ours.

      Doc 08 §4.9's highlighter pip is still overruled by §3.2 — the accent
      belongs to the thing needing a decision. Weight plus a neutral fill carry
      state here, which costs no colour at all.
    */
    item: 'min-h-target-adult flex-row items-center justify-start gap-element rounded-control px-inset-tight py-0 text-tenant-sidebar-foreground transition-colors duration-fast hover:bg-tenant-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tenant-focus-ring motion-reduce:transition-none',
    itemActive: 'bg-tenant-sidebar-active',
    itemLabel: 'w-auto shrink-0 whitespace-nowrap text-left text-label text-tenant-sidebar-muted',
    itemLabelActive: 'font-semibold text-tenant-sidebar-active-foreground',
    // rounded-control, not a pill — the kit has no circular chrome.
    badge: 'ml-auto flex rounded-control border-2 border-tenant-border px-element font-mono text-caption text-tenant-sidebar-foreground',
    // Fixed height, matching the sidebar's brand row, so the two horizontal
    // rules across the top of the app are one line and not two.
    topBar:
      'h-16 shrink-0 flex-row items-center gap-stack border-b-2 border-tenant-header-border bg-tenant-header px-inset text-tenant-header-foreground',
    content: 'min-w-0 flex-1 flex-col overflow-hidden',
    scroll: 'flex-1 overflow-y-auto',
    /*
      z-40 UNDER the sidebar's z-50, and stock numeric utilities rather than
      `z-overlay`/`z-nav`: Tailwind builds z-index utilities from bare numbers,
      not from a `--z-*` namespace, so those token-shaped names generate nothing.
      The inert classes left the scrim painting over the drawer and the drawer
      itself unstacked, so the page showed straight through the open menu.
    */
    scrim: 'absolute inset-0 z-40 bg-ink-950/50 md:hidden',
  },
  variants: {
    mode: {
      /*
        The responsive default: a tablet is not a small desktop. At md the
        content pane cannot spare 256px of chrome, so the sidebar starts as a
        rail; at lg there is room for the menu and the labels, headings and
        badges earn their space. Neither is a prison — the control below flips
        into `rail` or `menu` and this variant stops applying.
      */
      auto: {
        sidebar: 'md:w-28 lg:w-pane-primary-narrow',
        sidebarInner: 'md:px-element md:py-inset-tight lg:p-inset-tight',
        item: 'md:flex-col md:justify-center md:gap-0 md:px-0 md:py-element lg:flex-row lg:justify-start lg:gap-element lg:px-inset-tight lg:py-0',
        itemLabel: 'md:w-full md:px-0.5 md:text-center md:text-caption lg:w-auto lg:text-left lg:text-label',
        groupLabel: 'md:hidden lg:flex',
        badge: 'md:hidden lg:ml-auto lg:flex',
      },
      /*
        Chosen rail. Keeps a label under each icon rather than going icon-only:
        a bare icon rail costs a hover-and-wait on every navigation.

        w-28, not w-20. At 80px "Enrolments" clipped against the rail edge and
        the group headings wrapped into "PIPE / LINE" — the rail has to fit the
        longest label the product uses, and labels are clamped to one line so a
        longer one truncates instead of re-wrapping the whole rail.
      */
      rail: {
        sidebar: 'md:w-28',
        sidebarInner: 'md:px-element md:py-inset-tight',
        item: 'md:flex-col md:justify-center md:gap-0 md:px-0 md:py-element',
        itemLabel: 'md:w-full md:px-0.5 md:text-center md:text-caption',
        // Group headings are the first to go: two-word phrases cannot survive a
        // 112px column, and the icons already do the grouping there.
        groupLabel: 'md:hidden',
        badge: 'md:hidden',
      },
      /* Chosen menu — the base slots already are the menu. */
      menu: { sidebar: 'md:w-pane-primary-narrow' },
    },
    menuOpen: {
      // `md:flex` — the tablet rail is always present; the hamburger is only
      // the phone drawer's control, which is why it is `lg:hidden` and not
      // `md:hidden` in the top bar.
      false: { sidebar: 'hidden md:flex' },
      true: { sidebar: 'flex shadow-overlay lg:shadow-none' },
    },
  },
  defaultVariants: { mode: 'auto', menuOpen: false },
});

export function DashboardShell({
  groups,
  brand,
  brandMark,
  mode,
  onSetMode,
  menuOpen,
  onToggleMenu,
  topBarStart,
  topBarEnd,
  children,
}: DashboardShellProps) {
  const s = shell({ mode, menuOpen });

  /*
    What each breakpoint is SHOWING, which is what the toggle at that breakpoint
    has to invert. `auto` means rail at md and menu at lg, so the two controls
    below disagree with each other on purpose — and that disagreement is exactly
    why one shared button could never be labelled correctly.
  */
  const railAtMd = mode === 'auto' ? true : mode === 'rail';
  const railAtLg = mode === 'auto' ? false : mode === 'rail';

  /*
    The kit's own reduce-motion reader, matching ShellTabBar's rationale
    verbatim: a haptic is not motion, but Reduce Motion is the only sensory-load
    preference either OS will actually report, so a reader who asked the device
    to calm down does not get buzzed for navigating.
  */
  const reducedMotion = useReducedMotion();

  return (
    <View className={s.root()}>
      {/*
        Tapping the scrim closes the menu, and it is NOT the only way out.

        This comment used to say a scrim tap was "the reason no explicit close
        button is needed". The drawer now carries one in its brand row (see
        below), and the reason is narrower than "the scrim is inaccessible" —
        measured, this scrim is a labelled button and IS in the tab order, one
        stop ahead of the drawer. What it has no version of is a VISIBLE
        affordance: it asks a sighted first-time user to work out that the
        dimmed page is a control, and nothing on screen says so. HIG Modality
        wants an explicit, obvious dismissal for a modal surface. So the scrim
        stays — it costs nothing and everyone reaches for it — and the button is
        what makes the exit something you can see rather than infer.
      */}
      {menuOpen ? (
        <Pressable
          aria-label="Close menu"
          onPress={onToggleMenu}
          className={s.scrim()}
        />
      ) : null}

      <View className={s.sidebar()}>
        {/*
          Brand only. The toggle used to share this row and had 96px to fit a
          32px mark, a 44px target and their gaps — so it overflowed the rail
          and collided with the top bar's rule. It now lives in the footer.

          The swap follows the same variant that sets the width, so the two
          cannot disagree. Both are rendered and CSS picks — including the phone
          drawer, which is a full-width overlay where a lone mark would look
          broken, so below md the lockup always wins.
        */}
        <View
          className={`h-14 shrink-0 flex-row items-center gap-element border-b-2 border-border px-inset-tight justify-start ${
            mode === 'auto' ? 'md:justify-center lg:justify-start' : mode === 'rail' ? 'md:justify-center' : ''
          }`}
        >
          <View className={MENU_ONLY[mode]}>{brand}</View>
          <View className={RAIL_ONLY[mode]}>{brandMark}</View>
          {/*
            The drawer's own exit, and `md:hidden` because it is the ONLY
            breakpoint where this element is an overlay — at md and up the
            sidebar is in flow, nothing is covering the page, and a close button
            would be asking to dismiss something that was never modal. The
            width toggle in the footer is the docked form's control instead.

            Trailing edge of the brand row, which is where Beli and Hootsuite
            both put it: it sits on the drawer's own top rule opposite the
            lockup, so the row reads brand-then-exit in one line rather than
            floating a control over the nav list. It also lands under the
            thumb's natural arc on the drawer's inner edge, away from the back
            gesture on the screen's leading edge.
          */}
          <NavDrawerButton action="close" onPress={onToggleMenu} className="ml-auto md:hidden" />
        </View>

        <Nav aria-label="Sections" className={s.sidebarInner()}>
          {groups.map((group, index) => (
            <View key={group.title ?? `group-${index}`} className="gap-element">
              {group.title ? <Text className={s.groupLabel()}>{group.title}</Text> : null}
              {group.items.map((item) => (
                <Pressable
                  key={item.id}
                  /*
                    Selection tick on a nav press, the same vocabulary and the
                    same two rules ShellTabBar landed: `haptics.selection` (the
                    lightest tick the kit has — a destination change is not an
                    action confirmation), never on the item you are already on,
                    because a buzz with nothing happening on screen is noise.

                    `@acme/ui`'s haptics is a platform-forked trio, so this is
                    honest rather than aspirational: the web fork is four free
                    no-ops and the native fork no-ops again when Pulsar's
                    TurboModule is missing from the binary. Today this shell
                    only mounts on the web, so the call costs nothing and does
                    nothing — it is here so a native mount inherits the tick
                    instead of quietly shipping the one nav in the product that
                    does not respond.
                  */
                  onPress={() => {
                    if (!item.active && !reducedMotion) haptics.selection();
                    item.onPress();
                  }}
                  aria-current={item.active ? 'page' : undefined}
                  aria-label={item.label}
                  className={s.item({ className: item.active ? s.itemActive() : '' })}
                >
                  <View className={`shrink-0 ${item.active ? 'text-tenant-sidebar-active-foreground' : 'text-tenant-sidebar-muted'}`}>
                    {item.icon}
                  </View>
                    {/*
                      The rail label is rendered as a SECOND node rather than
                      swapped in JS, because which one is right depends on the
                      breakpoint whenever the mode is `auto`. `aria-label` on the
                      row above carries the full label either way, so a screen
                      reader never hears the abbreviation.
                    */}
                    {item.railLabel ? (
                      <>
                        <Text
                          className={s.itemLabel({
                            className: `${MENU_ONLY_TEXT[mode]} ${item.active ? s.itemLabelActive() : ''}`,
                          })}
                        >
                          {item.label}
                        </Text>
                        <Text
                          className={s.itemLabel({
                            className: `${RAIL_ONLY_TEXT[mode]} ${item.active ? s.itemLabelActive() : ''}`,
                          })}
                        >
                          {item.railLabel}
                        </Text>
                      </>
                    ) : (
                      <Text
                        className={s.itemLabel({ className: item.active ? s.itemLabelActive() : '' })}
                      >
                        {item.label}
                      </Text>
                    )}
                  {item.badge ? <Text className={s.badge()}>{item.badge}</Text> : null}
                </Pressable>
              ))}
            </View>
          ))}
        </Nav>

        {/*
          ONE control, whose LABEL is responsive and whose ACTION is resolved at
          press time.

          It was two Pressables — `md:flex lg:hidden` and `hidden lg:flex` — so
          that each breakpoint could show a correctly-labelled button under
          `auto`, where the tablet is railed while the desktop is not. Two
          buttons appeared stacked in the rail. One control cannot do that at
          all, which is worth more than the symmetry was.

          The label still varies by breakpoint, on child nodes, and the press
          handler asks `matchMedia` which width it is actually on. Reading it in
          the handler rather than at render keeps the server and the first paint
          out of it entirely — a width measured during render is a width the
          server has to guess, and guessing it means the first paint flips.
        */}
        <Pressable
          aria-label="Toggle menu width"
          onPress={() => {
            const atLg =
              typeof window !== 'undefined' &&
              window.matchMedia('(min-width: 64rem)').matches;
            onSetMode((atLg ? railAtLg : railAtMd) ? 'menu' : 'rail');
          }}
          className="hidden min-h-target-adult shrink-0 flex-row items-center justify-center gap-element border-t-2 border-border-faint px-inset-tight hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 md:flex"
        >
          <View className={RAIL_ONLY[mode]}>
            {railAtMd ? (
              <PanelLeftOpen aria-hidden className="h-4 w-4 shrink-0 text-text-muted" />
            ) : (
              <PanelLeftClose aria-hidden className="h-4 w-4 shrink-0 text-text-muted" />
            )}
          </View>
          <View className={`${MENU_ONLY[mode]} flex-row items-center gap-element`}>
            {railAtLg ? (
              <PanelLeftOpen aria-hidden className="h-4 w-4 shrink-0 text-text-muted" />
            ) : (
              <>
                <PanelLeftClose aria-hidden className="h-4 w-4 shrink-0 text-text-muted" />
                <Text className="text-caption text-text-muted">Collapse</Text>
              </>
            )}
          </View>
        </Pressable>
      </View>

      <View className={s.content()}>
        <View className={s.topBar()}>
          {/* Same component as the drawer's close, so the pair cannot drift.
              `md:hidden` for the same reason it is: above md there is no
              overlay to open. */}
          <NavDrawerButton action="open" expanded={menuOpen} onPress={onToggleMenu} className="md:hidden" />
          {topBarStart}
          {/* `ml-auto` rather than `justify-between`: with only one child, a
              space-between bar leaves the action stranded on the left. */}
          {topBarEnd ? (
            <View className="ml-auto flex-row items-center gap-element">{topBarEnd}</View>
          ) : null}
        </View>
        <View className={s.scroll()}>{children}</View>
      </View>
    </View>
  );
}
