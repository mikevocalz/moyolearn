'use client';
// Enrollment — the CRM rail group's third destination ("Enrollment", doc 36
// §3.4's spelling), a reframe over the EXISTING stage machinery rather than a
// new object: the leads still short of 'Enrolled', each with the one action
// this surface is for, which is the same stage POST the pipeline badge makes.
//
// The J6 dead end this surface closes: the pipeline must not END at
// 'Enrolled', so enrolled families carry the "Book sessions" exit to
// /schedule (live — the route exists on both platforms).
// pending: org.money (contract exit `enrolled_invoice`) — the invoicing exit
// stays a comment because no org.money route exists, and a button that leads
// nowhere is a designed dead end (the nav flow law, held on-surface).
// SOT: design/screens/org/org.crm/contract.md (exits) · docs/pack/28-crm-spec.md §3 · docs/pack/36-role-navigation-flows.md §3.4
// SOT-KEYWORDS: enrollment crm stage complete enrolled book sessions schedule j6
// Mobbin: https://mobbin.com/screens/f0e0352c-2bfb-46ff-b23c-eb56b2fdd9c0 (Xero —
//   rows awaiting an action carry their quick action on the trailing edge, in
//   a section named for the state) ·
//   https://mobbin.com/screens/0ba91724-a838-4e2f-9e19-6deb22480255 (HubSpot —
//   a work queue split by state, each band a labelled group of the same rows) ·
//   https://mobbin.com/screens/63d33c52-d5a2-46c1-8441-a87a381ea758 (Relevance
//   AI — the queue's segments are states of one list, not separate lists).
//   Structure only.
import { useRouter } from 'solito/navigation';
import { Badge, Button, EmptyState, Heading, LoadingSkeleton } from '@acme/ui';
import { Text, View } from '@acme/ui/primitives';
import { STAGE_TONE, type Lead, type Stage } from './ops.data';
import { MANUAL_STAGES } from './stage-change';
import { useLeads } from './use-leads';
import { useStageAction } from './use-stage-action';
import { GUTTER, SectionHeader } from './leads-content';

/**
 * Every manual stage BEFORE 'Enrolled', derived from the enum rather than
 * typed, so a new stage joins the queue without this file knowing.
 */
const PRE_ENROLLED: readonly Stage[] = MANUAL_STAGES.slice(
  0,
  MANUAL_STAGES.indexOf('Enrolled'),
);

/*
  One read, sliced two ways. The service filters by a single stage at most, so
  this surface reads the pipeline once and partitions client-side — honest at
  an org's scale (the repository reads the whole org anyway), and the moment a
  stages[] predicate is worth having, ops.service.listLeads is where it goes.
*/
const ENROLLMENT_VIEW = { q: '', onlyAttention: false, sortDesc: false, limit: 100 } as const;

function EnrollmentRow({
  lead,
  action,
}: {
  lead: Lead;
  action: React.ReactNode;
}) {
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-element rounded-card border-2 border-border bg-surface-raised p-inset shadow-card">
      <View className="min-w-0 flex-1 gap-0">
        <Text className="text-body font-semibold text-text">{lead.family}</Text>
        <Text className="text-caption text-text-muted">
          {lead.learner} · {lead.subject} · {lead.value}
        </Text>
      </View>
      <View className="shrink-0 flex-row items-center gap-element">
        <Badge label={lead.stage} tone={STAGE_TONE[lead.stage]} />
        {action}
      </View>
    </View>
  );
}

export function EnrollmentScreen() {
  const router = useRouter();
  const { rows: serverRows, status, queryKey } = useLeads(ENROLLMENT_VIEW);
  const { rows, moveStage, pending, error: writeError } = useStageAction(serverRows, queryKey);

  const inProgress = rows.filter((l) => PRE_ENROLLED.includes(l.stage));
  const enrolled = rows.filter((l) => l.stage === 'Enrolled');

  return (
    <View className={`gap-section ${GUTTER}`}>
      <View className="gap-element">
        <Heading level={1} size="display-sm" className="text-text">
          Enrollment
        </Heading>
        <Text className="text-body-lg text-text-muted">
          Finish converting families, then hand them to scheduling.
        </Text>
      </View>

      {writeError ? (
        <View className="flex-row items-center gap-element rounded-control border-2 border-redpen px-inset-tight py-element">
          <Text className="text-body text-redpen">{writeError}</Text>
        </View>
      ) : null}

      {status === 'pending' ? (
        <LoadingSkeleton count={4} />
      ) : status === 'error' ? (
        <EmptyState
          icon={<Text className="text-title">!</Text>}
          title="Could not load the pipeline"
          description="The list is stale, not gone. Try again in a moment."
        />
      ) : (
        <>
          <View className="gap-stack">
            <SectionHeader title="Ready to complete" count={String(inProgress.length)} />
            {inProgress.length === 0 ? (
              <EmptyState
                icon={<Text className="text-title">＋</Text>}
                title="Nothing mid-conversion"
                description="Every family in the pipeline is either enrolled or brand new — add leads on the Leads page."
              />
            ) : (
              <View className="gap-stack">
                {inProgress.map((lead) => (
                  <EnrollmentRow
                    key={lead.id}
                    lead={lead}
                    action={
                      <Button
                        title="Complete enrollment"
                        size="sm"
                        disabled={pending}
                        onPress={() => moveStage({ leadId: lead.id, to: 'Enrolled' })}
                      />
                    }
                  />
                ))}
              </View>
            )}
          </View>

          <View className="gap-stack">
            <SectionHeader title="Enrolled — next steps" count={String(enrolled.length)} />
            {enrolled.length === 0 ? (
              <Text className="text-body text-text-muted">
                Completed enrollments land here with their booking step.
              </Text>
            ) : (
              <View className="gap-stack">
                {enrolled.map((lead) => (
                  <EnrollmentRow
                    key={lead.id}
                    lead={lead}
                    action={
                      <Button
                        title="Book sessions"
                        variant="outline"
                        size="sm"
                        onPress={() => router.push('/schedule')}
                      />
                    }
                  />
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}
