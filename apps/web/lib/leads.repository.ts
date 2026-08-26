// Leads repository — the only place the ops routes touch Payload.
//
// It is also the only place that knows a lead is stored as integer cents, a
// timestamp and a raw attendance percentage while the dashboard renders "$1,080",
// "09:00" and a suppressible cell. That translation belongs at the edge: the
// service sorts and pages over one shape, and the collection stays free to hold
// values no display string can round-trip.
//
// The tenant predicate is applied HERE, on every read and every write, because
// this is the last layer before the database — a filter that lives any further
// up is a filter a future caller can forget.
// SOT: CLAUDE.md §The block · docs/pack/28-crm-spec.md §2–§3 · docs/pack/19-learning-outcomes-spec.md §5
// SOT-KEYWORDS: leads repository payload crm ops pipeline stage tenant org suppression
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import { attendanceCell, type Lead } from '@acme/app';
import type { LoadLeads, SaveLeadStage } from '@acme/app/server';

async function withPayload<T>(fn: (payload: Awaited<ReturnType<typeof getPayload>>) => Promise<T>): Promise<T> {
  const payload = await getPayload({ config });
  return fn(payload);
}

/*
  Money is stored in cents and formatted once, here. `maximumFractionDigits: 0`
  because a tutoring pipeline is quoted in whole dollars and "$1,080.00" adds two
  characters of noise to every row of a dense grid.
*/
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);

/*
  The dashboard shows a time, not a date: every row in "today's pipeline" is
  today. Rendered in the SERVER's zone, which is right while an org and its
  tutors share one; a multi-region org needs a per-org zone on the collection,
  and this is the function that would read it.
*/
const clock = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const NO_SESSION = '—';

export const loadLeads: LoadLeads = async (ctx) => {
  if (!ctx.orgId) return [];
  return withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'leads',
      where: { orgId: { equals: ctx.orgId } },
      limit: 1000,
      /*
        Newest first is the dashboard's default order and matches the
        `orgId, needsAttention, createdAt` index; the service re-sorts only when
        the user picks a column, so the common request never sorts twice.
      */
      sort: '-createdAt',
    });

    return docs.map<Lead>((doc) => ({
      id: String(doc.id),
      family: doc.family,
      learner: doc.learner ?? '',
      subject: doc.subject ?? '',
      stage: doc.stage,
      owner: doc.owner ?? '',
      nextSession: doc.nextSessionAt ? clock.format(new Date(doc.nextSessionAt)) : NO_SESSION,
      sessions: doc.sessions ?? 0,
      value: money(doc.valueCents ?? 0, doc.currency ?? 'USD'),
      attendance: attendanceCell(doc.attendancePct, doc.cohortSize),
      needsAttention: doc.needsAttention ?? false,
    }));
  });
};

export const saveLeadStage: SaveLeadStage = async (ctx, leadId, patch) => {
  if (!ctx.orgId) return false;
  const id = Number(leadId);
  if (!Number.isInteger(id)) return false;

  return withPayload(async (payload) => {
    /*
      Updated by WHERE, not by id. `update({ id })` would move a lead belonging
      to another org whenever a caller guessed its id; anding the tenant into the
      predicate makes the wrong org's write match zero rows instead.
    */
    const { docs } = await payload.update({
      collection: 'leads',
      where: { and: [{ id: { equals: id } }, { orgId: { equals: ctx.orgId } }] },
      data: patch,
    });
    return docs.length > 0;
  });
};
