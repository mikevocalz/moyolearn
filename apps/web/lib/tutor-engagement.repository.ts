import 'server-only';
// Tutor engagement repository — ADR-108's roster edge, read for the acting
// tutor.
//
// ACTIVE ONLY, decided in the `where` and nowhere later: an ended engagement
// is history that explains old records, not a relationship to file new
// reports through, and `LoadTutorEngagements`' own contract says the filter
// lives here so no consumer has to remember it. The query is scoped by
// `ctx.learnerId` — the acting id off the Block, never input — which is what
// makes the rows it returns safe to intersect a posted subject against.
//
// NAMES RESOLVE THROUGH BETTER AUTH's internal adapter, the same read
// `incident-staff.repository.ts` makes next door, with a STRICTER fallback:
// a learner row with no display name falls back to the raw id, never to an
// email — these are children's accounts, and an email is more of the child
// than a subject picker has any business carrying. `EngagedLearner` has
// nowhere to put one, so the narrowing is structural rather than remembered.
// SOT: docs/decisions/adr-108-tutor-learner-edge.md · packages/payload/src/collections/TutorEngagements.ts · packages/app/features/safety/incidents.service.ts
// SOT-KEYWORDS: tutor engagement repository roster edge active learner name subject picker
import { getPayload } from 'payload';
import config from '@payload-config';
import type { EngagedLearner, LoadTutorEngagements } from '@acme/app/server';
import { auth } from './auth';

/**
 * A solo tutor holds a handful; a studio tutor a few dozen. A hundred is the
 * ceiling at which a roster read stops being a roster and starts being an
 * export, which this port is not.
 */
const ENGAGEMENTS_LIMIT = 100;

interface UserRow {
  id: string;
  name?: string | null;
}

export const loadTutorEngagements: LoadTutorEngagements = async (ctx) => {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: 'tutorEngagements',
    where: {
      and: [{ tutorAuthId: { equals: ctx.learnerId } }, { status: { equals: 'active' } }],
    },
    limit: ENGAGEMENTS_LIMIT,
  });

  const authCtx = await auth.$context;
  const users = await Promise.all(
    docs.map(
      (doc) =>
        authCtx.internalAdapter.findUserById(doc.learnerAuthId) as Promise<
          UserRow | null | undefined
        >,
    ),
  );

  return docs.map((doc, index): EngagedLearner => ({
    learnerId: doc.learnerAuthId,
    // Display name or the raw id — never an email (header). A vanished user
    // row shows the id, which the tutor cannot resolve and triage can.
    name: users[index]?.name ?? doc.learnerAuthId,
  }));
};
