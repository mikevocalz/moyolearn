import { tv, type VariantProps } from './tv';
import { ScrollView, View } from './primitives';
import { Badge } from './Badge';
import { Button } from './Button';

/**
 * FilterBar — the Cool-dial filter toolbar (J-component-plan §4).
 *
 * Five ops surfaces (org.safety, org.inbox, org.crm, tutor.incidents,
 * tutor.resources) land in one phase window; without this each would hand-roll
 * the same toolbar composition. Built once, first, instead.
 *
 * STATE LAW (binding): FilterBar owns ZERO state. It renders values and emits
 * changes — on web the owner is URL search params, on mobile the screen's
 * zustand store. That is why the controls arrive as SLOTS (`SegmentedControl`,
 * `Select`, `SearchBar`, `Menu`-anchored chips as `children`; `search` as its
 * own slot) already wired to their owner, and why clear-all only EMITS.
 *
 * Cool dial only, by contract: learner shells have no filters and K–2 bans
 * search (doc 36 §3.1) — there is no hot consumer to design for.
 *
 * Not built on `Toolbar`: that component is the h-14 title/leading/actions top
 * bar; a filter row needs variable height (wrap), a scroll region, and no
 * title semantics. It borrows Toolbar's chrome tokens instead so the two read
 * as one family.
 * Mobbin: mobbin.com/screens/ec4931ac-c3ca-46cd-8d07-39ffd02e22a9 (Navattic — list header: search leading, Filter-with-count / Sort / date controls trailing, applied chips + Clear on their own wrappable row) ·
 * mobbin.com/screens/b403408e-b983-4cd2-898c-708a2e962ad2 (Twenty — applied filter chips with x-dismiss and "+ Add filter" inline, Sort/Options pinned to the trailing edge above the table) ·
 * mobbin.com/screens/3f5f36f6-11c4-4efc-8995-b05498492386 (Xero — search field grows across the bar but stops short of the edge, Filter trailing, active chips + reset-filters emitting to the list owner). Structure only.
 * SOT: docs/design/overhaul-v2/J-component-plan.md §4 · docs/pack/36 §3.1
 * SOT-KEYWORDS: filter bar toolbar controls segmented select search chips clear-all ops cool
 */
const filterBar = tv({
  slots: {
    root: 'flex-row items-center gap-element border-b-2 border-border bg-surface',
    // Search grows into free space but stops at the form measure — a
    // viewport-wide searchbox reads as a page header, not a filter.
    search: 'max-w-content-form flex-1',
    scroll: 'flex-1',
    controls: 'flex-row items-center gap-element',
    trailing: 'flex-row items-center gap-element',
  },
  variants: {
    density: {
      comfortable: { root: 'px-4 py-2.5' },
      compact: { root: 'px-3 py-1.5' },
    },
    overflow: {
      scroll: {},
      wrap: { controls: 'flex-1 flex-wrap' },
    },
  },
  defaultVariants: { density: 'comfortable', overflow: 'scroll' },
});

export interface FilterBarProps extends VariantProps<typeof filterBar> {
  /** Filter controls, already wired to the owning store: SegmentedControl, Select, Menu chips. */
  children: React.ReactNode;
  /** Optional leading SearchBar slot (rendered before the controls). */
  search?: React.ReactNode;
  /**
   * Count of applied filters. Renders the count Badge only when > 0 — a zero
   * badge is noise (the DashboardShell badge-omission law).
   */
  activeCount?: number;
  /** Clear-all affordance — shown only while filters are active. Emits; never clears. */
  onClearAll?: () => void;
  'aria-label'?: string;
  className?: string;
}

export function FilterBar({
  children, search, activeCount = 0, onClearAll, density, overflow, className,
  'aria-label': ariaLabel = 'Filters',
}: FilterBarProps) {
  const s = filterBar({ density, overflow });
  const hasActive = activeCount > 0;

  return (
    <View role="toolbar" aria-label={ariaLabel} className={s.root({ className })}>
      {search ? <View className={s.search()}>{search}</View> : null}

      {overflow === 'wrap' ? (
        <View className={s.controls()}>{children}</View>
      ) : (
        // Overflowing chips scroll horizontally rather than reflowing the bar —
        // a toolbar that changes height under the cursor is a moving target.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className={s.scroll()}
          contentContainerClassName={s.controls()}
        >
          {children}
        </ScrollView>
      )}

      {hasActive ? (
        <View className={s.trailing()}>
          <Badge tone="primary" label={String(activeCount)} />
          {onClearAll ? (
            <Button title="Clear all" variant="ghost" size="sm" onPress={onClearAll} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
