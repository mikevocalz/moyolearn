'use client';
// AvatarSheet — the account sheet's CHROME: the mobile form of the Profile/You
// surface (ADR-106). Chrome, never navigation — it deep-links, it never
// duplicates a tab. Composes BottomSheet + SheetSurface with a slotted layout:
// identity header slot, a free slot for the ContextSwitcher (one gesture from
// the avatar — the Slack lesson), then sectioned deep-link rows. Role accent
// belongs ONLY on the identity Avatar's ring (doc 36 §5 allowlist) — the
// content supplies it; this chrome stays neutral. Density follows the dial:
// the wrapping <Dial> re-points type/spacing tokens and the one value with no
// utility consumer — row height — maps explicitly to the dial's row tokens.
// Mobbin: mobbin.com/screens/abdab1a1-c88c-40b9-8197-65c7cae286be (Fabric — identity header atop the sheet, workspace switcher one section below, terminal Logout last) ·
// mobbin.com/screens/7ed0fd81-e883-4b70-bf04-c77b7a0a264f (Grok Bot — identity row + grouped setting rows + separated sign-out group) ·
// mobbin.com/screens/c2fb8ccd-b86f-4cde-b9b4-adf9027fd320 (Transit — account sheet leads with identity, destructive actions pinned to the end). Structure only.
// SOT: docs/decisions/adr-106-account-sheet-is-profile-you.md ·
//      docs/design/overhaul-v2/J-component-plan.md §3
// SOT-KEYWORDS: avatar sheet account profile you chrome identity rows dial

import type { ReactNode } from 'react';
import { tv, type VariantProps } from './tv';
import { BottomSheet } from './BottomSheet';
import { Dial, type DialTemperature } from './Dial';
import { ChevronRight } from './icons';
import { Pressable, Text, View } from './primitives';

const avatarSheet = tv({
  slots: {
    root: 'gap-group',
    section: 'gap-element',
    sectionTitle: 'text-caption text-text-muted',
    row:
      'flex-row items-center gap-stack rounded-md px-3 ' +
      'transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken ' +
      'motion-reduce:transition-none',
    label: 'flex-1 text-body text-text',
  },
  variants: {
    // The dial's row-height tokens (doc 08 §2.5 density row): hot rows are the
    // roomy 64 the age-band targets ask for, cool rows sit at the adult 44.
    temperature: {
      hot: { row: 'min-h-row-hot' },
      cool: { row: 'min-h-row-cool' },
    },
    disabled: {
      true: { row: 'opacity-50' },
    },
  },
  defaultVariants: { temperature: 'cool' },
});

export interface AvatarSheetRow {
  key: string;
  label: string;
  /** Leading glyph, supplied sized and toned by the content. */
  icon?: ReactNode;
  onPress: () => void;
  /**
   * Right edge of the row. Omit for the deep-link chevron; pass `null` for
   * nothing (a terminal action like sign out navigates nowhere).
   */
  trailing?: ReactNode;
  /** For pending states (sign-out in flight) — the row stays visible, inert. */
  disabled?: boolean;
}

export interface AvatarSheetSection {
  key: string;
  title?: string;
  rows: AvatarSheetRow[];
}

export interface AvatarSheetSurfaceProps extends VariantProps<typeof avatarSheet> {
  /** Density + token re-pointing, forwarded to the wrapping <Dial>. */
  temperature?: DialTemperature;
  /** Identity header slot: Avatar (role-accent ring) + name + role noun. */
  identity: ReactNode;
  sections?: AvatarSheetSection[];
  /** Sits between identity and rows — the ContextSwitcher's seat. */
  children?: ReactNode;
  className?: string;
}

/**
 * The sheet's inner layout, exported separately (the SheetSurface pattern) so
 * stories can render it inline without the sheet portal.
 */
export function AvatarSheetSurface({
  identity,
  sections = [],
  children,
  temperature = 'cool',
  className,
}: AvatarSheetSurfaceProps) {
  const s = avatarSheet({ temperature });
  return (
    <Dial temperature={temperature} className={s.root({ className })}>
      {identity}
      {children}
      {sections.map((section) => (
        <View key={section.key} className={s.section()}>
          {section.title ? <Text className={s.sectionTitle()}>{section.title}</Text> : null}
          {section.rows.map((row) => (
            <Pressable
              key={row.key}
              role="button"
              aria-label={row.label}
              disabled={row.disabled}
              onPress={row.onPress}
              className={s.row({ disabled: row.disabled })}
            >
              {row.icon}
              <Text className={s.label()}>{row.label}</Text>
              {row.trailing === undefined ? (
                <ChevronRight size={18} className="text-text-muted" />
              ) : (
                row.trailing
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </Dial>
  );
}

export interface AvatarSheetProps extends AvatarSheetSurfaceProps {
  open: boolean;
  onClose: () => void;
  /** SheetSurface header title. */
  title?: string;
}

export function AvatarSheet({ open, onClose, title = 'Account', ...surface }: AvatarSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <AvatarSheetSurface {...surface} />
    </BottomSheet>
  );
}
