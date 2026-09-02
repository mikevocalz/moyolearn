import 'server-only';
// Sessions repository — ADR-110's calendar rows, read for the ops hero.
//
// The tenant predicate lives HERE (`orgId = ctx.orgId`), and so does the
// display translation: the port's `Session` is already the view the hero
// renders ("09:00–09:45", names, 'Virtual'), the Leads money/clock idiom, so
// no screen ever holds a raw row. Times render in the server's zone — the
// same zone `listSessions` used to draw the day window, so a session never
// falls outside the day that queried it. A multi-region org needs a per-org
// zone on the collection; `listSessions`' header names that seam.
//
// TUTOR NAMES resolve through Better Auth's internal adapter, the
// `tutor-engagement.repository.ts` read next door, with the same fallback
// discipline: display name or the raw id, never an email.
// SOT: docs/decisions/adr-110-sessions-object.md · packages/payload/src/collections/Sessions.ts · packages/app/features/ops/ops.service.ts
// SOT-KEYWORDS: sessions repository ops hero today window org scoped view translation tutor name
import { getPayload } from 'payload';
import config from '@payload-config';
import type { Session as SessionRow } from '@acme/payload';
import type { LoadSessions } from '@acme/app/server';
import { auth } from './auth';

interface UserRow {
  id: string;
  name?: string | null;
}

/** "09:00" in the server's zone — both ends of the range read the same way. */
const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

export const loadSessions: LoadSessions = async (ctx, window) => {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: 'sessions',
    where: {
      and: [
        { orgId: { equals: ctx.orgId } },
        { scheduledAt: { greater_than_equal: window.from } },
        { scheduledAt: { less_than: window.to } },
      ],
    },
    sort: 'scheduledAt',
    limit: 200,
  });
  const rows = docs as SessionRow[];

  // One adapter read per DISTINCT tutor, not per row — a day is a handful of
  // tutors teaching many sessions.
  const authCtx = await auth.$context;
  const tutorIds = [...new Set(rows.map((row) => row.tutorAuthId))];
  const tutors = new Map(
    await Promise.all(
      tutorIds.map(async (id): Promise<[string, string]> => {
        const user = (await authCtx.internalAdapter
          .findUserById(id)
          .catch(() => null)) as UserRow | null | undefined;
        // Display name or raw id — never an email (the engagement repo's rule).
        return [id, user?.name ?? id];
      }),
    ),
  );

  return rows.map((row) => ({
    id: String(row.id),
    time: `${clock(row.scheduledAt)}–${clock(row.endsAt)}`,
    learner: row.learner,
    subject: row.subject ?? '',
    tutor: tutors.get(row.tutorAuthId) ?? row.tutorAuthId,
    mode: row.mode === 'in-person' ? ('In person' as const) : ('Virtual' as const),
    ...(row.needsAttention ? { needsAttention: true as const } : {}),
  }));
};
