import { tv, type VariantProps } from './tv';
import { Pressable, View } from './primitives';
import { Text } from './Text';
import { Button } from './Button';
import { FadeIn } from './motion';
import { Info, OctagonAlert, TriangleAlert, WifiOff, X } from './icons';

/**
 * Banner — persistent inline status notice (J-component-plan §3).
 *
 * The gap it fills: `Toast`/`notify` are transient, `EmptyState` is a
 * whole-surface state; nothing rendered a non-blocking in-flow notice for
 * incident / entitlement / offline / staleness states. This does.
 *
 * Tone set is the plan's, verbatim: `info | warning | incident | offline`.
 * There is no `success` banner — a good state is a Badge (`grade`), not a
 * persistent notice — and no `danger` name: the safety lane calls it an
 * incident, and the rendering law travels with the name. Colour lives on the
 * leading tile, NEVER the card frame (same containment as ToastCard): doc 31
 * §5.2 — severity never floods a row, no red page-frames. Doc 38 §5B:
 * entitlement banners are non-blocking, which is why only `incident` announces
 * as an alert; everything else is polite `status`.
 *
 * Dial is inherited from the `Dial` scope (tokens re-point themselves); band
 * voice is content, not a component axis. Dismissal is CONTROLLED: passing
 * `onDismiss` shows the close affordance, and the owner unmounts the banner —
 * it never hides itself.
 * Mobbin: mobbin.com/screens/2b00c4b9-d2a6-4a6a-9d95-2aba49348be1 (Alta — "Network offline" notice sits inline above the content: leading status icon, title + one supporting line, flow continues below it) ·
 * mobbin.com/screens/ea5d92c2-73fc-4fc7-9fb6-a6d32d332097 (Kit — in-flow announcement card at the top of the overview with an explicit Close affordance; content, not chrome, decides when it goes) ·
 * mobbin.com/screens/e775e577-e5f3-4bd0-a864-e7881c29c77a (Finch — warning notice anatomy: dismiss X, bold title, supporting body, single action — severity carried by the icon, not a flooded frame). Structure only.
 * SOT: docs/design/overhaul-v2/J-component-plan.md §3 · docs/pack/31 §5.2 · docs/pack/38 §5B
 * SOT-KEYWORDS: banner inline notice tone incident offline entitlement staleness non-blocking status
 */
const banner = tv({
  slots: {
    root:
      'w-full flex-row items-start gap-stack rounded-card border-2 border-border bg-surface-raised p-3.5',
    // The same rounded-square containment ToastCard uses, so a banner and a
    // toast carrying the same status read as one system.
    tile: 'h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-border',
    icon: '',
    body: 'flex-1 gap-0.5 py-0.5',
    title: 'text-sm font-semibold text-text',
    description: 'text-sm leading-snug text-text-muted',
    action: 'shrink-0',
    close:
      'h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-fast ' +
      'hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none',
  },
  variants: {
    tone: {
      info: { tile: 'bg-primary', icon: 'text-on-primary' },
      // Highlighter is the needs-attention tone (doc 08 §4.8, Badge precedent)
      // — attention without alarm, which is exactly what an entitlement or
      // trial-ending notice is allowed to be.
      warning: { tile: 'bg-highlighter', icon: 'text-on-highlighter' },
      incident: { tile: 'bg-danger', icon: 'text-on-danger' },
      offline: { tile: 'bg-surface-sunken', icon: 'text-text-muted' },
    },
  },
  defaultVariants: { tone: 'info' },
});

const GLYPH = {
  info: Info,
  warning: TriangleAlert,
  incident: OctagonAlert,
  offline: WifiOff,
} as const;

export interface BannerProps extends VariantProps<typeof banner> {
  title: string;
  description?: string;
  /** One action — deep-link or retry. A second action belongs on the target screen. */
  action?: { label: string; onPress: () => void };
  /** Controlled dismissal: shows the close affordance; the owner unmounts the banner. */
  onDismiss?: () => void;
  className?: string;
}

export function Banner({ tone, title, description, action, onDismiss, className }: BannerProps) {
  const s = banner({ tone });
  const Glyph = GLYPH[tone ?? 'info'];

  return (
    // FadeIn already renders its final frame statically under Reduce Motion.
    <FadeIn
      role={tone === 'incident' ? 'alert' : 'status'}
      className={s.root({ className })}
    >
      <View aria-hidden className={s.tile()}>
        <Glyph size={18} className={s.icon()} />
      </View>

      <View className={s.body()}>
        <Text className={s.title()}>{title}</Text>
        {description ? <Text className={s.description()}>{description}</Text> : null}
      </View>

      {action ? (
        <View className={s.action()}>
          <Button title={action.label} variant="ghost" size="sm" onPress={action.onPress} />
        </View>
      ) : null}

      {onDismiss ? (
        <Pressable role="button" aria-label="Dismiss" onPress={onDismiss} className={s.close()}>
          <X size={16} className="text-text-muted" />
        </Pressable>
      ) : null}
    </FadeIn>
  );
}
