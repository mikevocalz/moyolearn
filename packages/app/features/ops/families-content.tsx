'use client';
// Families — the CRM rail group's second destination, rendered over the
// INTERIM derivation (family-groups.ts): the pipeline grouped by family text,
// server-side. A real list with zero new schema.
//
// Rows are NOT openable, deliberately: doc 28 §2's Family (household) and
// GuardianContact objects have no collections behind them, so there is no
// household record for a row to open — a press that led to a page restating
// this list would be a door painted on a wall. The household ADR builds the
// record; openability arrives with it.
// SOT: docs/pack/28-crm-spec.md §2 · packages/app/features/ops/family-groups.ts
// SOT-KEYWORDS: families crm derived grouping household list stages value org
// Mobbin: https://mobbin.com/screens/93a62f43-285a-43d5-aa6c-6d7af134b5c0 (Copilot
//   Money — grouped account rows: name leads, the aggregate amount holds the
//   trailing edge) ·
//   https://mobbin.com/screens/f0e0352c-2bfb-46ff-b23c-eb56b2fdd9c0 (Xero —
//   status chips ride the row between the identity and the amount) ·
//   https://mobbin.com/screens/7612f4c4-4104-4dbc-8e5f-579dde687f2b (Airtable —
//   a grouped view's header carries the record count for its group).
//   Structure only.
import { Badge, EmptyState, Heading, LoadingSkeleton } from '@acme/ui';
import { Text, View } from '@acme/ui/primitives';
import { STAGE_TONE } from './ops.data';
import type { FamilyGroup } from './family-groups';
import { useFamilies } from './use-families';
import { GUTTER, SectionHeader } from './leads-content';

function FamilyRow({ group }: { group: FamilyGroup }) {
  return (
    <View className="gap-stack rounded-card border-2 border-border bg-surface-raised p-inset shadow-card">
      <View className="flex-row flex-wrap items-start justify-between gap-element">
        <View className="min-w-0 flex-1 gap-0">
          <Text className="text-body font-semibold text-text">{group.family}</Text>
          <Text className="text-caption text-text-muted">
            {group.leads} {group.leads === 1 ? 'lead' : 'leads'} in the pipeline
          </Text>
        </View>
        <Text className="font-mono text-data text-text">{group.totalValue}</Text>
      </View>
      <View className="flex-row flex-wrap items-center gap-element">
        {group.stages.map((stage) => (
          <Badge key={stage} label={stage} tone={STAGE_TONE[stage]} />
        ))}
        {group.needsAttention ? <Badge label="Needs attention" tone="attention" /> : null}
      </View>
    </View>
  );
}

export function FamiliesScreen() {
  const { families, status } = useFamilies();

  return (
    <View className={`gap-section ${GUTTER}`}>
      <View className="gap-element">
        <Heading level={1} size="display-sm" className="text-text">
          Families
        </Heading>
        <Text className="text-body-lg text-text-muted">
          Every household in the funnel, with where its leads stand.
        </Text>
      </View>

      <View className="gap-stack">
        <SectionHeader title="Households" count={String(families.length)} />
        {status === 'pending' ? (
          <LoadingSkeleton count={4} />
        ) : status === 'error' ? (
          <EmptyState
            icon={<Text className="text-title">!</Text>}
            title="Could not load families"
            description="The list is stale, not gone. Try again in a moment."
          />
        ) : families.length === 0 ? (
          <EmptyState
            icon={<Text className="text-title">＋</Text>}
            title="No families yet"
            description="Families appear here as leads join the pipeline — add your first lead on the Leads page."
          />
        ) : (
          <View className="gap-stack">
            {families.map((group) => (
              <FamilyRow key={group.family} group={group} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
