'use client';
// Mobbin: https://mobbin.com/screens/0b8a7848-7bbb-4b35-8999-d71b47f469c3 (Featurebase —
//   panel show/hide control on the pane seam of a multi-column inbox) ·
//   https://mobbin.com/screens/1764602c-b875-482f-a13f-059bf78c15b7 (Plain —
//   sidebar collapse affordance in the pane chrome, not the content). Structure only.
// SOT: ./pane-overrides.ts (precedence) · ./README.md
// SOT-KEYWORDS: pane toggle show hide override size class control
import { useWindowDimensions } from 'react-native';
import { MotionView } from '../motion';
import { Pressable } from '../tw';
import { Text } from '../primitives';
import {
  Columns2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from '../icons';
import { haptics } from '../haptics';
import { windowSizeClassForWidth } from './constants.ts';
import { resolvePaneVisibility, type TogglablePane } from './pane-overrides.ts';
// NO `.ts` EXTENSION, and it is load-bearing. `pane-overrides.store.ts` is a TS
// RESOLUTION ANCHOR that re-exports the web fork; only the extensionless
// specifier lets Metro pick `.native`. Written with the extension, this file
// held a second, localStorage-backed store while `AdaptivePanes` read the MMKV
// one — so every press wrote to a map nothing rendered from and the controls
// were inert on device from the day they were mounted.
import { usePaneOverrideStore } from './pane-overrides.store';
import { TRANSITIONS } from './transitions.ts';

/** Each pane's pair of icons, closed state first. */
const ICONS = {
  primary: { open: PanelLeftOpen, close: PanelLeftClose },
  supplementary: { open: Columns2, close: Columns2 },
  inspector: { open: PanelRightOpen, close: PanelRightClose },
  // The detail pane is the trailing one, so it takes the trailing pair — the
  // same icon a user has already learned means "the panel on that edge".
  detail: { open: PanelRightOpen, close: PanelRightClose },
} as const;

const LABELS = {
  primary: { show: 'Show sidebar', hide: 'Hide sidebar' },
  supplementary: { show: 'Show list', hide: 'Hide list' },
  inspector: { show: 'Show inspector', hide: 'Hide inspector' },
  detail: { show: 'Show detail', hide: 'Hide detail' },
} as const;

export interface PaneToggleProps {
  pane: TogglablePane;
  /** Layout shape, matching the value handed to `resolvePaneVisibility`. */
  columnCount: 1 | 2;
  /**
   * What this pane holds, in the surface's own words — "Homework", "Natalie".
   *
   * Supplying it does two things: the word is DRAWN beside the icon, and it
   * replaces the generic accessible label ("Hide Natalie", not "Hide detail").
   * Omitted, the control stays the square icon button every adult pane surface
   * already draws, so nothing that exists today changes shape.
   *
   * A visible word is not decoration here. In the header of a session there is
   * no pane seam next to the button to say what it acts on, and two adjacent
   * panel icons that differ only in which pane they collapse are a coin flip —
   * which is exactly the failure mode of the icon-only row this replaces.
   */
  label?: string;
  className?: string;
  /**
   * Controlled mode: what this pane's state IS, and what to do about it.
   *
   * Supplied together, the control stops reading and writing `pane-overrides`
   * and reports the host's state instead. Only one surface needs this — the
   * tutor session, where the detail pane holds Natalie and her visibility is
   * her presence, not a layout preference (see `AdaptivePanes`' `detailOpen`).
   * Without it that screen would have had a second control, drawn differently,
   * for the same intent the rail already expresses.
   *
   * Everything else omits both and keeps the stored behaviour unchanged.
   */
  visible?: boolean;
  onToggle?: () => void;
}

/**
 * Explicit show/hide control for one pane.
 *
 * The button writes an override SCOPED TO THE CURRENT SIZE CLASS, so a user who
 * hides the list on a tablet still gets it on a phone, where it is the only
 * thing on screen. Precedence between this and the automatic policy lives in
 * `resolvePaneVisibility`, not here — this component only reports what is on
 * screen now and asks for the opposite.
 *
 * It renders nothing where the size class cannot show the pane at all: a
 * control that is visibly present but can never change anything is worse than
 * no control, and at compact the navigator owns which single pane is up.
 */
export function PaneToggle({
  pane,
  columnCount,
  label,
  className,
  visible: visibleProp,
  onToggle,
}: PaneToggleProps) {
  const { width } = useWindowDimensions();
  const sizeClass = windowSizeClassForWidth(width);
  const overrides = usePaneOverrideStore((state) => state.overrides);
  const toggle = usePaneOverrideStore((state) => state.toggle);

  const controlled = visibleProp !== undefined && onToggle !== undefined;
  const visible = controlled ? visibleProp : resolvePaneVisibility(sizeClass, columnCount, overrides)[pane];

  // If forcing it on changes nothing, this class cannot show the pane.
  const canToggle =
    controlled ||
    visible ||
    resolvePaneVisibility(sizeClass, columnCount, {
      ...overrides,
      [sizeClass]: { ...overrides[sizeClass], [pane]: true },
    })[pane];

  if (!canToggle) return null;

  const Icon = visible ? ICONS[pane].close : ICONS[pane].open;

  /*
    TWO GROUNDS, ONE CONTROL — and the pair of tokens has to follow the ground
    the control is standing on, not the component that draws it.

    The icon-only form sits in the pane chrome, on the CONTENT ground, where a
    raised slab with an accent glyph is what separates an action from the panes
    behind it. The labelled form only ever appears in a bar, on
    `bg-surface-header`, and wearing the content pair there put
    `on-surface-header` ink on a `surface-raised` slab — dark purple on near
    black, measured unreadable on device. In a header the control takes header
    ink, exactly like the back chevron and the CC button beside it.

    State is carried by the FILL as well as the icon, which is the grammar the
    CC button in the same bar already uses: up reads as pressed-in, down as
    outline. Rotation alone is not a state a child reads at a glance.
  */
  const chrome = label
    ? `border-on-surface-header ${visible ? 'bg-on-surface-header/15' : 'bg-transparent'}`
    : 'border-border bg-surface-raised';
  const ink = label ? 'text-on-surface-header' : 'text-accent';

  return (
    <Pressable
      role="button"
      aria-label={
        label ? `${visible ? 'Hide' : 'Show'} ${label}` : visible ? LABELS[pane].hide : LABELS[pane].show
      }
      aria-expanded={visible}
      onPress={() => {
        haptics.selection();
        if (controlled) {
          onToggle();
          return;
        }
        toggle(sizeClass, pane, visible);
      }}
      // A white slab on the primary field, so the control stays legible
      // against it; the icon takes the accent rather than ink, which is what
      // separates an action from the header's own text.
      //
      // Square at the icon-only size, and the labelled form grows sideways from
      // the same 44dp height rather than getting a second, shorter size — a
      // control row that mixes two heights reads as two systems.
      className={`h-11 min-w-11 flex-row items-center justify-center gap-element rounded-md border-2 transition-colors duration-fast motion-reduce:transition-none ${chrome} ${label ? 'px-3' : 'w-11'} ${className ?? ''}`}
    >
      {/* Rotation only — a native-driven property, so it never shares a node
          with the pane width animation on the JS thread. The supplementary
          pane reuses one icon for both states, so the half-turn is what
          communicates the change. */}
      <MotionView
        animate={{ rotate: visible ? '0deg' : '180deg' }}
        transition={TRANSITIONS.disclosure}
        transformOrigin={{ x: '50%', y: '50%' }}
      >
        <Icon size={20} className={ink} />
      </MotionView>
      {label ? (
        /*
          The pane's NAME, not its state. "Homework" stays "Homework" whether
          it is up or down — the icon and `aria-expanded` carry the state, and a
          label that flipped between "Show" and "Hide" would move under the
          reader's eye every press and change the control's width with it.
        */
        <Text className={`font-sans text-label font-semibold ${ink}`}>{label}</Text>
      ) : null}
    </Pressable>
  );
}
