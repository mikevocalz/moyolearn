'use client';
// The ops Overview screen: session context resolved into the dashboard
// content's props, and NOTHING else. The DashboardShell chrome this file used
// to own — with its private sidebar whose section rows wrote a store nothing
// read — retired when /ops joined RoleShell like every other rail destination
// (doc 36 §3.4): one chrome for the org role, owned by the web shell, and the
// mobile Overview tab renders this same slimmed screen instead of a second
// web CRM.
// SOT: docs/pack/28-crm-spec.md · docs/pack/36-role-navigation-flows.md §3.4 · apps/web/components/site/RoleShell.tsx
// SOT-KEYWORDS: ops screen overview session district operator dashboard crm
// Mobbin: no reference pull — this file draws no layout of its own; it resolves
//   session context into props. The dashboard's structure and citations live in
//   ops-dashboard-content.tsx.
import { OpsDashboardContent } from './ops-dashboard-content';
import { useAppSession } from '../../providers/session';
import { MOCK_ORGS, MOCK_STAFF, orgBySlug } from '../../fixtures/cast.ts';
import { REVENUE_BY_ORG } from './ops.data';
import { useSessions } from './use-sessions';

export function OpsScreen() {
  /*
    The district comes from the SESSION, not from a literal. This screen used to
    type "Riverside Tutoring" into two separate places and greet a hardcoded
    "Amara" while the leads table scoped itself to whatever org the real session
    carried — so the chrome could confidently name one district while the table
    below it showed another's families.

    Falling back to the first org rather than rendering blank: an ops user always
    belongs somewhere, and a screen with no district is harder to diagnose than
    one naming the wrong one.
  */
  const { activeContext } = useAppSession();
  const org = orgBySlug(activeContext.orgId ?? '') ?? MOCK_ORGS[0]!;
  const operator = MOCK_STAFF.find((m) => m.orgSlug === org.slug && m.role === 'owner');

  /*
    ADR-110's real read: today's rows off the `sessions` collection, scoped to
    the session's org behind `protectedOperation`. Loading and error travel
    WITH the rows now — discarding them here was how a failed fetch rendered
    as a calm "0 sessions" day. Revenue stays the honest fixture ops.data.ts
    documents (doc 19 §5's rollups do not exist yet).
  */
  const { sessions, loading, error } = useSessions();
  const sessionsStatus = loading ? 'loading' : error ? 'error' : 'ready';

  /*
    Computed, not typed. `today` was the string "Tuesday, 26 August", which was
    correct on exactly one day. `OpsDashboardContentProps` already documents this
    as "computed by the caller so this stays pure" — the caller just wasn't.
  */
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <OpsDashboardContent
      today={today}
      operatorName={operator?.name.split(' ')[0] ?? 'there'}
      sessions={sessions}
      sessionsStatus={sessionsStatus}
      revenue={REVENUE_BY_ORG[org.slug] ?? []}
    />
  );
}
