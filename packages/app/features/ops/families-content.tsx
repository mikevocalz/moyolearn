'use client';
// Families — the CRM rail group's second destination, rendered over ADR-109's
// real household rows, each carrying the stage rollup over its leads
// (family-groups.ts holds the pure math).
//
// Rows OPEN now: the deferral this file used to record — "there is no
// household record for a row to open" — retired when doc 28 §2's Family
// object landed as a collection. A row is a route-based door to
// /families/[familyId], the lead-detail idiom.
// SOT: docs/pack/28-crm-spec.md §2 · docs/decisions/adr-109-family-household-object.md
// SOT-KEYWORDS: families crm household list rollup stages value org openable record
// Mobbin: https://mobbin.com/screens/93a62f43-285a-43d5-aa6c-6d7af134b5c0 (Copilot
//   Money — grouped account rows: name leads, the aggregate amount holds the
//   trailing edge) ·
//   https://mobbin.com/screens/f0e0352c-2bfb-46ff-b23c-eb56b2fdd9c0 (Xero —
//   status chips ride the row between the identity and the amount) ·
//   https://mobbin.com/screens/7612f4c4-4104-4dbc-8e5f-579dde687f2b (Airtable —
//   a grouped view's header carries the record count for its group).
//   Structure only.
import { Link } from 'solito/link';
import { Badge, EmptyState, Heading, LoadingSkeleton } from '@acme/ui';
import { Text, View } from '@acme/ui/primitives';
import { STAGE_TONE } from './ops.data';
import type { FamilyGroup } from './family-groups';
import { useFamilies } from './use-families';
import { GUTTER, SectionHeader } from './leads-content';
import { familyDetailPath } from './ops-paths';

function FamilyRow({ group }: { group: FamilyGroup }) {
  return (
    <Link href={familyDetailPath(group.id)} aria-label={`Open family: ${group.family}`}>
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
    </Link>
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
              <FamilyRow key={group.id} group={group} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
