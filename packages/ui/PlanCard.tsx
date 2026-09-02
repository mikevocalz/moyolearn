'use client';
// Pricing tier card (doc 38 §5 FD-13 · §5B PW-05/PW-08 · §8 `PlanCard` ·
// J-component-plan §2 row 6).
//
// DATA PROPS ONLY: name, price, period, trial line and badge arrive from the
// role-scoped plan query — no price is ever hardcoded here. Two laws ride the
// `tier` prop: guardian routes may only pass `family` (enforced by a
// route-level type, doc 38 §5 FD-13 — deliberately not a runtime check), and
// this component may NEVER mount on a learner surface, any tier, any state
// (doc 05 · PW-03b · CLAUDE.md children's surfaces).
// Selection shares RoleChoiceCard's pattern (J §2 row 6): radio semantics,
// role-accent underlay + ring from the enclosing RoleScope, check chip, weight
// — never colour alone. Sanctioned role-accent consumer (check-role-accent).
// The badge is text via Badge, not just colour (doc 38 §5 FD-13 a11y).
// SOT: docs/38-front-door-and-flow.md §8 · docs/design/overhaul-v2/J-component-plan.md §2 row 6
// SOT-KEYWORDS: plan card pricing tier family business trial badge paywall fd-13 pw-05
import { tv } from './tv';
import { Badge } from './Badge';
import { PressScale } from './press-scale';
import { Article, View } from './primitives';
import { Text } from './Text';
import { Check } from './icons';
import { haptics } from './haptics';

const plan = tv({
  slots: {
    root:
      'w-full gap-element rounded-card border-2 border-border bg-surface-raised p-inset-roomy text-left ' +
      'transition-all duration-fast motion-reduce:transition-none',
    head: 'flex-row items-start justify-between gap-stack',
    name: 'text-lg font-semibold text-text',
    price: 'font-display text-display-sm text-text',
    period: 'text-base text-text-muted',
    check: 'h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border-strong bg-role-accent',
    includes: 'gap-element pt-1',
  },
  variants: {
    interactive: {
      true: {
        root:
          'shadow-card hover:border-border-strong ' +
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2',
      },
    },
    selected: {
      true: {
        root: 'bg-role-accent-underlay shadow-card ring-4 ring-role-accent hover:border-border',
        name: 'font-bold',
      },
    },
  },
  defaultVariants: { interactive: false, selected: false },
});

export type PlanTier = 'family' | 'business';

export interface PlanCardProps {
  name: string;
  /** e.g. `$11` — from the plan query, never a literal in product code. */
  price: string;
  /** e.g. `/mo` */
  period: string;
  /** e.g. `after your free month` */
  trialLine?: string;
  /** e.g. `Early-bird price` — rendered as text, never colour alone. */
  badge?: string;
  /** ≤ 4 plain rows (doc 38 §5 FD-13). */
  includes?: readonly string[];
  /**
   * The rendering guard's type seam: guardian routes are typed to `'family'`
   * only, so a business tier on a parent surface is a compile error, not a
   * review catch. Carried for that contract; both tiers draw identically.
   */
  tier: PlanTier;
  selected?: boolean;
  /** Present = the card is a radio in the plan chooser; absent = static (PW-05 summary). */
  onSelect?: () => void;
  className?: string;
}

export function PlanCard({
  name,
  price,
  period,
  trialLine,
  badge,
  includes,
  tier: _tier,
  selected = false,
  onSelect,
  className,
}: PlanCardProps) {
  const s = plan({ interactive: !!onSelect, selected });
  const content = (
    <>
      <View className={s.head()}>
        <Text className={s.name()}>{name}</Text>
        <View className="flex-row items-center gap-element">
          {badge ? <Badge tone="attention" label={badge} /> : null}
          {selected ? (
            <View aria-hidden className={s.check()}>
              <Check className="h-4 w-4 text-ink-950" />
            </View>
          ) : null}
        </View>
      </View>
      {/* Price + period announce as one unit (doc 38 §5 FD-13 a11y). */}
      <Text aria-label={`${price} ${period}`}>
        <Text className={s.price()}>{price}</Text>
        <Text className={s.period()}>{period}</Text>
      </Text>
      {trialLine ? <Text tone="muted" variant="caption">{trialLine}</Text> : null}
      {includes?.length ? (
        <View className={s.includes()}>
          {includes.map((line) => (
            <View key={line} className="flex-row items-center gap-element">
              <Check aria-hidden className="h-4 w-4 shrink-0 text-text-muted" />
              <Text className="text-sm text-text">{line}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );

  if (!onSelect) {
    return <Article className={s.root({ className })}>{content}</Article>;
  }
  return (
    <PressScale
      role="radio"
      aria-checked={selected}
      accessibilityState={{ checked: selected }}
      onPress={() => { haptics.selection(); onSelect(); }}
      className={s.root({ className })}
      outerClassName="w-full"
    >
      {content}
    </PressScale>
  );
}
