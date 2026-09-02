'use client';
// The lead record — org.crm's route-based detail (contract back_behavior:
// record → pipeline → previous rail destination via BROWSER HISTORY; the
// binding state_owner list has no AdaptivePanes here, so this is a page, not a
// pane). Contact identity, stage, value and sessions from the one record read;
// the stage badge is the same write control the pipeline table uses, over the
// same optimistic hook, invalidating this record's own key.
//
// NO notes or activity timeline, deliberately: doc 28 §2's Activity object
// (notes, calls, emails — consent-scoped) has no collection behind it, so a
// timeline here would be furniture. The section arrives with that schema, not
// before it.
// SOT: design/screens/org/org.crm/contract.md · docs/pack/28-crm-spec.md §2–§3
// SOT-KEYWORDS: lead detail record crm stage value sessions contact route back
// Mobbin: https://mobbin.com/screens/f215a882-8c79-4bf8-8483-4d8ae465c3c1 (HubSpot —
//   a "data highlights" strip of labelled facts directly under the record
//   header, before any body content) ·
//   https://mobbin.com/screens/4ce614d5-5a79-4668-8902-3878e0b9b7e2 (Apollo —
//   the STAGE value in the record-details panel is a status chip, not text) ·
//   https://mobbin.com/screens/2a3d52f0-0fb6-4c4c-9777-bd44b44d5ef0 (Twenty —
//   record fields as plain label/value rows in one column, no card-per-field) ·
//   https://mobbin.com/screens/d7c51694-e293-445d-9829-557a50744b38 (Pipedrive —
//   breadcrumb-style way back to the list at the top of the record).
//   Structure only.
import { Link } from 'solito/link';
import {
  Badge,
  Button,
  EmptyState,
  Heading,
  LoadingSkeleton,
  Menu,
  SuppressibleValue,
} from '@acme/ui';
import { Text, View } from '@acme/ui/primitives';
import { STAGE_TONE, type Lead } from './ops.data';
import { MANUAL_STAGES } from './stage-change';
import { useLead } from './use-leads';
import { useStageAction } from './use-stage-action';
import { GUTTER, SectionHeader } from './leads-content';
import { leadsRootPath } from './ops-paths';

/** One labelled fact — the HubSpot data-highlight shape. */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View className="gap-0">
      <Text className="text-caption text-text-muted">{label}</Text>
      <Text className="font-mono text-data text-text">{value}</Text>
    </View>
  );
}

function LeadRecord({ lead, queryKey }: { lead: Lead; queryKey: readonly unknown[] }) {
  /*
    The SAME write path as the pipeline table, seeded with this one record and
    invalidating this record's own query key — one reducer, one optimistic
    layer, however many surfaces render the badge.
  */
  const { rows, moveStage, pending, error: writeError } = useStageAction([lead], queryKey);
  const current = rows[0] ?? lead;

  return (
    <View className={`gap-section ${GUTTER}`}>
      <View className="gap-stack">
        {/* The explicit way back — deep links arrive with no history to pop. */}
        <Link href={leadsRootPath()} aria-label="Back to leads">
          <Text className="text-caption font-semibold text-text-muted">← Leads</Text>
        </Link>
        <View className="flex-row flex-wrap items-end justify-between gap-stack">
          <View className="min-w-0 gap-0">
            <Heading level={1} size="display-sm" className="text-text">
              {current.family}
            </Heading>
            <Text className="text-body-lg text-text-muted">
              {current.learner}
              {current.subject ? ` · ${current.subject}` : ''}
            </Text>
          </View>
          {/*
            The badge IS the control, exactly as it is in the table's Stage
            cell — reusing the pattern rather than inventing a second stage
            editor for the same value.
          */}
          <Menu
            title="Move to"
            actions={MANUAL_STAGES.map((stage) => ({
              id: stage,
              title: stage,
              disabled: pending || stage === current.stage,
            }))}
            onAction={(id) => moveStage({ leadId: current.id, to: id as Lead['stage'] })}
          >
            <View className="min-h-target-adult flex-row items-center gap-element">
              <View className="shrink-0">
                <Badge label={current.stage} tone={STAGE_TONE[current.stage]} />
              </View>
              <Text aria-hidden className="shrink-0 text-caption text-text-muted">
                ▾
              </Text>
            </View>
          </Menu>
        </View>
      </View>

      {writeError ? (
        <View className="flex-row items-center gap-element rounded-control border-2 border-redpen px-inset-tight py-element">
          <Text className="text-body text-redpen">{writeError}</Text>
        </View>
      ) : null}

      <View className="gap-stack">
        <SectionHeader title="At a glance" />
        <View className="flex-row flex-wrap gap-group rounded-card border-2 border-border bg-surface-raised p-inset shadow-card">
          <Fact label="Owner" value={current.owner || '—'} />
          <Fact label="Next session" value={current.nextSession} />
          <Fact label="Sessions" value={String(current.sessions)} />
          <Fact label="Value" value={current.value} />
          <Fact
            label="Attendance"
            value={<SuppressibleValue cell={current.attendance} />}
          />
        </View>
      </View>
    </View>
  );
}

export function LeadDetailScreen({ leadId }: { leadId: string }) {
  const { lead, queryKey, status } = useLead(leadId);

  if (status === 'pending') {
    return <LoadingSkeleton count={4} className="m-inset" />;
  }

  if (status === 'error' || lead === null) {
    return (
      <View className={GUTTER}>
        <EmptyState
          icon={<Text className="text-title">!</Text>}
          title={lead === null && status !== 'error' ? 'Not in your pipeline' : 'Could not load this lead'}
          description={
            lead === null && status !== 'error'
              ? 'This record was removed, or it belongs to another organization.'
              : 'The record is stale, not gone. Try again in a moment.'
          }
          action={
            <Link href={leadsRootPath()}>
              <Button title="Back to leads" variant="outline" />
            </Link>
          }
        />
      </View>
    );
  }

  return <LeadRecord lead={lead} queryKey={queryKey} />;
}
