'use client';
// FD-03's first decision — a choice that must read as a choice, not a form
// (doc 38 §5 FD-03 · §8 `RoleChoiceCard` · J-component-plan §2 row 9).
//
// Radio-in-radiogroup semantics: the SCREEN owns the `radiogroup`; each card is
// one `radio`. Selection is never colour alone (doc 38 §7): the role-accent
// underlay + ring travel WITH a filled check chip and title weight 700.
// The accent classes here are a sanctioned consumer of the role-accent gate
// (tooling/check-role-accent.mjs) — J §2 row 9 is the design decision: the
// selection ring uses role tokens, resolved by the enclosing RoleScope (or the
// explicit `accent` prop), and only ever as bg-/ring- fills, never text/border.
// Min height is 72dp per §8 — numerically the young target token, which keeps
// the hot-dial sizing a token, not a hardcode.
// Mobbin: mobbin.com/screens/2c9d91ca-7d27-4a1e-b30e-039e88b9ef99 (Duolingo ABC — "Who's learning to read?": icon + title + one-line description per audience card, exactly FD-03's parent/teacher fork) ·
// mobbin.com/screens/48b99dc6-9509-4ca2-b775-a1039e4e2890 (CapCut — role radiogroup where the selected card carries accent ring AND a filled corner check, never colour alone) ·
// mobbin.com/screens/48261957-4520-4048-9b13-d14a95600c2f (Canva — "What will you be using this for?" persona cards: leading icon tile, label, generous tap area). Structure only.
// SOT: docs/38-front-door-and-flow.md §8 · docs/design/overhaul-v2/J-component-plan.md §2 row 9
// SOT-KEYWORDS: role choice card radio signup who's this for accent onboarding fd-03
import type { ReactNode } from 'react';
import type { AccentRole } from '@acme/theme';
import { tv } from './tv';
import { PressScale } from './press-scale';
import { RoleScope } from './RoleScope';
import { View } from './primitives';
import { Text } from './Text';
import { Check } from './icons';
import { haptics } from './haptics';

const roleChoice = tv({
  slots: {
    root:
      'min-h-target-young w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-inset text-left ' +
      'transition-all duration-fast hover:border-border-strong ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 ' +
      'motion-reduce:transition-none',
    iconWrap: 'h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-sunken',
    body: 'min-w-0 flex-1 gap-0.5',
    title: 'text-base font-semibold text-text',
    check: 'h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface-sunken',
  },
  variants: {
    selected: {
      true: {
        root: 'bg-role-accent-underlay shadow-card ring-4 ring-role-accent hover:border-border',
        iconWrap: 'bg-role-accent-underlay',
        title: 'font-bold',
        check: 'border-border-strong bg-role-accent',
      },
    },
    disabled: { true: { root: 'opacity-50 shadow-none hover:border-border' } },
  },
  defaultVariants: { selected: false, disabled: false },
});

export interface RoleChoiceCardProps {
  title: string;
  /** ≤ 90 chars per §8 — one supporting sentence, not a paragraph. */
  description: string;
  /** 32dp glyph; colour comes from text classes on the node, accent from the chip. */
  icon?: ReactNode;
  selected?: boolean;
  onSelect: () => void;
  /** Explicit door hue; omitted, it inherits the enclosing RoleScope (doc 36 §5). */
  accent?: AccentRole;
  disabled?: boolean;
  className?: string;
}

export function RoleChoiceCard({
  title,
  description,
  icon,
  selected = false,
  onSelect,
  accent,
  disabled,
  className,
}: RoleChoiceCardProps) {
  const s = roleChoice({ selected, disabled });
  const card = (
    <PressScale
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      accessibilityState={{ checked: selected, disabled }}
      onPress={disabled ? undefined : () => { haptics.selection(); onSelect(); }}
      className={s.root({ className })}
      outerClassName="w-full"
    >
      {icon ? <View className={s.iconWrap()}>{icon}</View> : null}
      <View className={s.body()}>
        <Text className={s.title()}>{title}</Text>
        <Text tone="muted" className="text-sm">{description}</Text>
      </View>
      <View aria-hidden className={s.check()}>
        {selected ? <Check className="h-4 w-4 text-ink-950" /> : null}
      </View>
    </PressScale>
  );
  return accent ? <RoleScope role={accent} className="w-full">{card}</RoleScope> : card;
}
