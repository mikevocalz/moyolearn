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
import { Menu, PanelLeftClose, PanelLeftOpen } from './icons';
import { Nav } from './tw';

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

export interface DashboardShellProps {
  groups: NavGroup[];
  /** Brand lockup, top of the sidebar. */
  brand: ReactNode;
  /** Compact brand mark shown when collapsed. */
  brandMark: ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Below `lg` the sidebar is an overlay driven by this pair. */
  menuOpen: boolean;
  onToggleMenu: () => void;
  /** Left of the top bar — breadcrumb or page title. */
  topBarStart?: ReactNode;
  /** Right of the top bar — search, actions, account. */
  topBarEnd?: ReactNode;
  children: ReactNode;
}

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
    root: 'dial-cool relative h-full flex-1 flex-row overflow-hidden bg-surface',
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
    sidebar:
      'absolute inset-y-0 left-0 z-50 w-28 flex-col border-r-2 border-border bg-surface-raised ' +
      'md:relative md:z-auto lg:relative lg:z-auto',
    sidebarInner: 'flex-1 flex-col gap-group overflow-y-auto px-element py-inset-tight lg:p-inset-tight',
    // whitespace-nowrap so the rail CLIPS the heading instead of wrapping it —
    // at 56px "PIPELINE" reflowed to one letter per line and turned the rail
    // into a column of vertical text.
    // Hidden on the rail: two-word headings cannot survive a 112px column, and
    // the icons already do the grouping there.
    groupLabel:
      'hidden shrink-0 whitespace-nowrap px-inset-tight pb-element text-caption font-semibold uppercase tracking-wide text-text-muted lg:flex',
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
    item: 'min-h-target-adult flex-col items-center justify-center gap-0 rounded-control px-0 py-element transition-colors duration-fast hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 motion-reduce:transition-none lg:flex-row lg:justify-start lg:gap-element lg:px-inset-tight lg:py-0',
    itemActive: 'bg-surface-sunken',
    itemLabel: 'w-full shrink-0 whitespace-nowrap px-0.5 text-center text-caption text-text-muted lg:w-auto lg:text-left lg:text-label',
    itemLabelActive: 'font-semibold text-text',
    // rounded-control, not a pill — the kit has no circular chrome.
    badge: 'hidden rounded-control border-2 border-border px-element font-mono text-caption text-text lg:ml-auto lg:flex',
    // Fixed height, matching the sidebar's brand row, so the two horizontal
    // rules across the top of the app are one line and not two.
    topBar:
      'h-14 shrink-0 flex-row items-center gap-stack border-b-2 border-border bg-surface-raised px-inset',
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
    collapsed: {
      /*
        Collapsed keeps a label under each icon rather than going icon-only: a
        bare icon rail costs a hover-and-wait on every navigation.

        w-24, not w-20. At 80px "Enrolments" clipped against the rail edge and
        the group headings wrapped into "PIPE / LINE" and "WORKS / PAC / E" —
        the rail has to be wide enough for the longest label the product uses,
        and the labels themselves are clamped to one line so a longer one
        truncates instead of re-wrapping the whole rail.
      */
      true: {
        sidebar: 'lg:w-28',
        // Every horizontal inset comes off the label's usable width, and at
        // w-24 with the standard insets the label box measured 43px — enough to
        // truncate "Enrolments" to "Enrol…". The rail trades its padding for
        // legible labels, since a rail whose labels are all elided is an
        // icon-only rail wearing an ellipsis.
        sidebarInner: 'lg:px-element lg:py-inset-tight',
        item: 'lg:flex-col lg:justify-center lg:gap-0 lg:px-0 lg:py-element',
        itemLabel: 'lg:w-full lg:px-0.5 lg:text-center lg:text-caption',
        // Group headings are the first thing to go: they are two-word phrases
        // that cannot survive a 96px column, and the icons already group.
        groupLabel: 'lg:hidden',
        badge: 'lg:hidden',
      },
      false: { sidebar: 'lg:w-pane-primary-narrow' },
    },
    menuOpen: {
      // `md:flex` — the tablet rail is always present; the hamburger is only
      // the phone drawer's control, which is why it is `lg:hidden` and not
      // `md:hidden` in the top bar.
      false: { sidebar: 'hidden md:flex' },
      true: { sidebar: 'flex shadow-overlay lg:shadow-none' },
    },
  },
  defaultVariants: { collapsed: false, menuOpen: false },
});

export function DashboardShell({
  groups,
  brand,
  brandMark,
  collapsed,
  onToggleCollapsed,
  menuOpen,
  onToggleMenu,
  topBarStart,
  topBarEnd,
  children,
}: DashboardShellProps) {
  const s = shell({ collapsed, menuOpen });

  return (
    <View className={s.root()}>
      {/* Tapping the scrim closes the menu — the affordance every overlay nav
          has, and the reason no explicit close button is needed below lg. */}
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

          The mark/lockup swap has to follow the LAYOUT, not just the `collapsed`
          prop: md–lg is a 112px rail whatever the user's desktop preference is,
          so keying only off the prop rendered the full lockup there and cut
          "Riverside Tutoring" off against the rail edge. When expanded, both are
          rendered and the breakpoint picks one — the prop alone cannot know the
          width.
        */}
        <View
          className={`h-14 shrink-0 flex-row items-center gap-element border-b-2 border-border px-inset-tight ${collapsed ? 'justify-center' : 'justify-center lg:justify-start'}`}
        >
          {collapsed ? (
            brandMark
          ) : (
            <>
              <View className="lg:hidden">{brandMark}</View>
              <View className="hidden lg:flex">{brand}</View>
            </>
          )}
        </View>

        <Nav aria-label="Sections" className={s.sidebarInner()}>
          {groups.map((group, index) => (
            <View key={group.title ?? `group-${index}`} className="gap-element">
              {group.title ? <Text className={s.groupLabel()}>{group.title}</Text> : null}
              {group.items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={item.onPress}
                  aria-current={item.active ? 'page' : undefined}
                  aria-label={item.label}
                  className={s.item({ className: item.active ? s.itemActive() : '' })}
                >
                  <View className={`shrink-0 ${item.active ? 'text-text' : 'text-text-muted'}`}>
                    {item.icon}
                  </View>
                  <Text
                    numberOfLines={1}
                    className={s.itemLabel({ className: item.active ? s.itemLabelActive() : '' })}
                  >
                    {collapsed ? (item.railLabel ?? item.label) : item.label}
                  </Text>
                  {item.badge && !collapsed ? (
                    <Text className={s.badge()}>{item.badge}</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ))}
        </Nav>

        {/* Collapse is a desktop affordance: below lg the sidebar is an overlay,
            where "collapsed" has no meaning, so the control is hidden there. */}
        <Pressable
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          aria-expanded={!collapsed}
          onPress={onToggleCollapsed}
          className={`hidden min-h-target-adult shrink-0 flex-row items-center gap-element border-t-2 border-border-faint px-inset-tight hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 lg:flex ${collapsed ? 'justify-center' : ''}`}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="h-4 w-4 shrink-0 text-text-muted" />
          ) : (
            <>
              <PanelLeftClose aria-hidden className="h-4 w-4 shrink-0 text-text-muted" />
              <Text className="text-caption text-text-muted">Collapse</Text>
            </>
          )}
        </Pressable>
      </View>

      <View className={s.content()}>
        <View className={s.topBar()}>
          <Pressable
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onPress={onToggleMenu}
            className="min-h-target-adult min-w-target-adult items-center justify-center rounded-control border-2 border-border hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 md:hidden"
          >
            <Menu aria-hidden className="h-4 w-4 text-text" />
          </Pressable>
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
