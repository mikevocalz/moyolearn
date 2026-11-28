'use client';
// Pricing tier card (doc 38 §5 FD-13 · §5B PW-05/PW-08 · §8 `PlanCard` ·
// J-component-plan §2 row 6).
//
// DATA PROPS ONLY: name, price, period, trial line and badge arrive from the
// plan catalogue (`@acme/auth/plan-catalog` for families, the ops display table
// for orgs) — no price is ever hardcoded here. Two laws ride the `context` /
// `tier` pair: a guardian surface can only pass `family` and an org surface
// only `business` (a discriminated union, so the other pairing is a compile
// error), and this component NEVER draws on a learner surface, any tier, any
// state (doc 05 · PW-03b · CONTRIBUTING.md children's surfaces). The runtime
// half of both laws is `planCardDecision`, tested on its own.
// Selection shares RoleChoiceCard's pattern (J §2 row 6): radio semantics,
// role-accent underlay + ring from the enclosing RoleScope, check chip, weight
// — never colour alone. Sanctioned role-accent consumer (check-role-accent).
// The badge is text via Badge, not just colour (doc 38 §5 FD-13 a11y).
// Mobbin: mobbin.com/screens/413876ac-478b-4788-a6e6-d6950029cf14 (Duolingo — stacked tier cards with text badges ("MOST POPULAR", member count), trial line above price, selected card gains ring + check chip) ·
// mobbin.com/screens/02aabc3f-7148-44d7-95e3-2b3126583b0d (Acorns — name / description / price-per-period anatomy per card; radio flips to a filled check plus border emphasis on selection) ·
// mobbin.com/screens/2913d96b-f3bc-4491-ba77-06871c3c6469 (Klarna — plan rows with a text "Recommended" badge and trailing-aligned price; one radio group, one commit button below). Structure only.
// SOT: docs/38-front-door-and-flow.md §8 · docs/design/overhaul-v2/J-component-plan.md §2 row 6
// SOT-KEYWORDS: plan card pricing tier family business trial badge paywall fd-13 pw-05
import { tv } from './tv';
import { Badge } from './Badge';
import { PressScale } from './press-scale';
import { Article, View } from './primitives';
import { Text } from './Text';
import { Check } from './icons';
import { haptics } from './haptics';
import { planCardDecision, type PlanCardContext, type PlanTier } from './plan-card-guard';

export type { PlanCardContext, PlanTier } from './plan-card-guard';

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
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
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

/**
 * Where the card is mounted, paired with the only tier that surface may show.
 * `{ context: 'guardian', tier: 'business' }` does not type-check, and there is
 * no `learner` member at all: a learner surface cannot construct these props.
 */
export type PlanCardScope =
  | { context: 'guardian'; tier: 'family' }
  | { context: 'org'; tier: 'business' };

export interface PlanCardData {
  name: string;
  /** e.g. `$24.99` — from the plan catalogue, never a literal in product code. */
  price: string;
  /** e.g. `/mo` */
  period: string;
  /** e.g. `after your free month` */
  trialLine?: string;
  /** e.g. `Trial` — rendered as text, never colour alone. */
  badge?: string;
  /** ≤ 4 plain rows (doc 38 §5 FD-13). */
  includes?: readonly string[];
  selected?: boolean;
  /** Present = the card is a radio in the plan chooser; absent = static (PW-05 summary). */
  onSelect?: () => void;
  className?: string;
}

export type PlanCardProps = PlanCardData & PlanCardScope;

export function PlanCard({
  name,
  price,
  period,
  trialLine,
  badge,
  includes,
  context,
  tier,
  selected = false,
  onSelect,
  className,
}: PlanCardProps) {
  // The union above makes a mismatched pair unrepresentable in typed callers;
  // this is the same law for props that arrive untyped (a JS caller, a story
  // control, a serialised screen). `context` is widened so a learner value that
  // slips in at runtime is refused rather than cast away.
  if (planCardDecision(context as PlanCardContext, tier as PlanTier) === 'nothing') return null;

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
