import 'server-only';
// FD-26's cascade, against the two stores that hold an identity.
//
// This file answers three questions for `account-deletion.service.ts`: who else
// hangs off this account, what Payload rows belong to one subject, and how a
// Better Auth user stops existing.
//
// WHY PAYLOAD AND BETTER AUTH SHARE A FILE HERE, when `summary.repository.ts`
// argues one port per store. The ports still are one per store — `eraseEdu`
// lives in `edu.repository.ts`, `eraseMedia` in `bunny.repository.ts`. What
// spans is the OWNERSHIP QUESTION itself: a ward is a Payload `guardianships`
// row whose name is a Better Auth `user` column, and splitting that into two
// ports would hand the service a list of ids and a list of names to zip, which
// is a join done in a service. `people.repository.ts` reads the same two
// surfaces for the same reason.
//
// THE SUBJECT IS A BRANDED TYPE. Nothing here takes a string id: a
// `DeletionSubject` can only be minted inside `planAccountDeletion`, from the
// ownership these functions resolved off `ctx`. That is CLAUDE.md's "identity
// is never a parameter" made checkable by the compiler rather than by review,
// which on a deletion path is the difference that matters.
//
// WHAT IS DELIBERATELY NOT DELETED:
//   · `incidentReports` carrying a `legalHold` (doc 31 §4.1) — counted and
//     returned so the confirmation can say they were kept. Retaining is the
//     fail-closed direction on `docs/design/counsel-review-s4.md` §4 Q5, which
//     is open.
//   · `incidentReports` this account FILED about somebody else's child
//     (`reporterAuthId`). A safety report is not the reporter's to withdraw,
//     and the child it names is not this account's to erase.
//   · Organisation rows. An adult deleting their account removes the person,
//     never the business — its classes, assignments and enrollments belong to
//     the org. `loadAccountOwnership` refuses the deletion outright when it
//     would leave an organisation with no owner.
// SOT: packages/app/features/account/account-deletion.service.ts · docs/pack/31-grade-voice-safety-incidents.md §4.1 · docs/pack/06-auth-onboarding-spec.md §2
// SOT-KEYWORDS: account deletion repository fd-26 payload guardianship ward erasure cascade legal hold better auth delete user org owner
import { getPayload, type CollectionSlug, type Where } from 'payload';
import config from '@payload-config';
import type {
  DeleteAuthUser,
  DeletionSubject,
  EraseSubjectPayload,
  LoadAccountOwnership,
  ManagedWard,
  PayloadErasure,
} from '@acme/app/server';
import { auth } from './auth';

const WARDS_LIMIT = 50;
/** A person belongs to a handful of orgs; this bounds the pathological row. */
const MEMBERSHIP_LIMIT = 50;

async function withPayload<T>(
  fn: (payload: Awaited<ReturnType<typeof getPayload>>) => Promise<T>,
): Promise<T> {
  const payload = await getPayload({ config });
  return fn(payload);
}

interface GuardianshipRow {
  guardianAuthId: string;
  learnerAuthId: string;
}

interface UserRow {
  id: string;
  name?: string | null;
}

interface MemberRow {
  organizationId: string;
  role: string;
}

/**
 * Every collection a subject's own rows live in, with the field that names
 * them.
 *
 * EXPLICIT rather than derived from the Payload config, for the reason
 * `check-store-separation.mjs` gives about its own table list: a collection
 * added without being added here is a collection the cascade silently misses,
 * and the way to make that impossible to do by accident is to make it a line
 * somebody has to write in the same commit as the collection.
 *
 * `tutorEngagements` carries two: a subject can be the learner in one row and
 * the tutor in another, and both are theirs.
 */
const SUBJECT_COLLECTIONS = [
  { collection: 'tutorSessions', fields: ['learnerAuthId'] },
  { collection: 'sessionTranscripts', fields: ['learnerAuthId'] },
  { collection: 'tutorMessages', fields: ['learnerAuthId'] },
  { collection: 'studentModelFacts', fields: ['learnerAuthId'] },
  { collection: 'safetyEvents', fields: ['learnerAuthId'] },
  { collection: 'tutorEngagements', fields: ['learnerAuthId', 'tutorAuthId'] },
  { collection: 'enrollments', fields: ['learnerAuthId'] },
  { collection: 'assignment-completions', fields: ['learnerAuthId'] },
  { collection: 'handoff-codes', fields: ['learnerAuthId', 'guardianAuthId'] },
  /*
    Consents and guardianships close the loop the creation path opened:
    `create-managed-learner.ts` writes exactly these two rows after the user,
    and its rollback deletes the user when either fails. Deleting them here is
    that action run forwards.

    `Consents.ts` sets `access.delete: () => false` — the collection is
    immutable to the API surface because a consent record is evidence of what
    was agreed at a moment in time. The Local API runs with `overrideAccess`
    true by default, so this reaches it. That is correct rather than a loophole:
    immutability protects the record against EDITING, and a guardian erasing
    their family is the one event that ends it.
  */
  { collection: 'consents', fields: ['learnerAuthId', 'guardianAuthId'] },
  { collection: 'guardianships', fields: ['learnerAuthId', 'guardianAuthId'] },
] as const;

/**
 * Wards, and whether this account is the last owner anywhere.
 *
 * `status: 'active'` on both sides of the ward question. An `invited`
 * guardianship is not yet load-bearing for consent (`Guardianships.ts`) and a
 * `revoked` one is over, so neither makes a second guardian for the purpose of
 * deciding whether a child would be left without one.
 */
export const loadAccountOwnership: LoadAccountOwnership = async (ctx) => {
  const context = await auth.$context;

  const mine = await withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'guardianships',
      where: {
        guardianAuthId: { equals: ctx.learnerId },
        status: { equals: 'active' },
      },
      limit: WARDS_LIMIT,
    });
    return docs as GuardianshipRow[];
  });

  const wards: ManagedWard[] = [];
  for (const row of mine) {
    /*
      The second-guardian test, asked per learner rather than by loading every
      guardianship in the table: a household has one or two, and the query is
      indexed on `learnerAuthId`.
    */
    const others = await withPayload(async (payload) => {
      const { docs } = await payload.find({
        collection: 'guardianships',
        where: {
          learnerAuthId: { equals: row.learnerAuthId },
          status: { equals: 'active' },
          guardianAuthId: { not_equals: ctx.learnerId },
        },
        limit: 1,
      });
      return docs.length;
    });

    const user = (await context.internalAdapter.findUserById(row.learnerAuthId)) as
      | UserRow
      | null
      | undefined;

    wards.push({
      learnerAuthId: row.learnerAuthId,
      // The id is the last resort and not a blank: a nameless row in a list of
      // children to delete has to still be distinguishable from its siblings.
      displayName: user?.name ?? row.learnerAuthId,
      soleGuardian: others === 0,
    });
  }

  const memberships = await context.adapter.findMany<MemberRow>({
    model: 'member',
    where: [{ field: 'userId', value: ctx.learnerId }],
    limit: MEMBERSHIP_LIMIT,
  });

  const soleOwnedOrgs: string[] = [];
  for (const membership of memberships) {
    if (membership.role !== 'owner') continue;
    const owners = await context.adapter.findMany<MemberRow>({
      model: 'member',
      where: [
        { field: 'organizationId', value: membership.organizationId },
        { field: 'role', value: 'owner' },
      ],
      limit: 2,
    });
    if (owners.length <= 1) soleOwnedOrgs.push(membership.organizationId);
  }

  return { wards, soleOwnedOrgs };
};

/** One `where` clause covering every field a collection can name a subject in. */
const ownedBy = (subject: DeletionSubject, fields: readonly string[]): Where => ({
  or: fields.map((field) => ({ [field]: { equals: subject.authId } })),
});

/**
 * One delete, counted, with a reported error treated as a failure.
 *
 * Generic over the slug rather than inlined per collection, because
 * `SUBJECT_COLLECTIONS` is a list and iterating it hands `payload.delete` a
 * UNION of slugs, which resolves to the by-id overload and loses `docs`/
 * `errors`. Binding the slug to a type parameter here keeps the many-overload
 * selected at one call site instead of eleven.
 *
 * THROWING IS THE POINT. `retention.repository.ts` argues it for facts and it
 * is sharper at account scale: a row that fails to delete is a record about a
 * child surviving an erasure somebody was told had happened, and counting it
 * short would report that as success.
 */
async function deleteOwned<TSlug extends CollectionSlug>(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: TSlug,
  where: Where,
): Promise<number> {
  const result = await payload.delete({ collection, where, depth: 0 });
  if (result.errors.length > 0) {
    throw new Error(
      `${collection} delete failed for ${result.errors.length} row(s): ` +
        result.errors.map((error) => error.message).join('; '),
    );
  }
  return result.docs.length;
}

/**
 * Every Payload row this subject owns, gone — except the ones a legal hold
 * keeps.
 *
 * NOT TRANSACTIONAL, and it cannot be: Payload's Local API deletes per
 * collection and these rows span a dozen tables plus their relationship side
 * tables. The ordering compensates in the direction that matters. Content goes
 * before the links that explain whose content it was, so an interruption
 * leaves rows that can still be traced and re-swept — the reverse leaves a
 * child's transcripts with no guardianship or consent row pointing at them,
 * which is `sweep.sql`'s orphan case and the one state that makes the
 * guarantee false rather than merely late.
 *
 * A delete that reports errors THROWS rather than being counted short, for the
 * reason `retention.repository.ts` names: a row that fails to delete is a
 * record about a child surviving an erasure somebody was told had happened.
 */
export const eraseSubjectPayload: EraseSubjectPayload = async (_ctx, subject) =>
  withPayload(async (payload): Promise<PayloadErasure> => {
    let rows = 0;

    /*
      Summaries first and counted apart. Doc 34 §3 gives them no `expires_at`
      and `sweep.sql` cannot touch them, so this is their only deleter — a zero
      here on an account that had sessions is a bug, and it is only visible
      because the number is separate from the rest.
    */
    const summaries = await deleteOwned(payload, 'sessionSummaries', {
      learnerAuthId: { equals: subject.authId },
    });

    for (const { collection, fields } of SUBJECT_COLLECTIONS) {
      rows += await deleteOwned(payload, collection, ownedBy(subject, fields));
    }

    /*
      Incidents last, and split. A report ABOUT this subject with no hold is
      theirs and goes; one carrying `legalHold` is kept and counted, because
      doc 31 §4.1 puts those on counsel's schedule and counsel has not yet
      answered whether a guardian's erasure may reach them
      (counsel-review-s4.md §4 Q5). Retaining is the fail-closed answer to an
      open preservation question — and the count is what stops the kept row
      from being a secret.

      Reports this subject FILED about another child are neither: they stay,
      and they are not counted here, because they are not a record of this
      account at all.
    */
    const held = await payload.find({
      collection: 'incidentReports',
      where: {
        subjectLearnerAuthId: { equals: subject.authId },
        legalHold: { exists: true },
      },
      limit: 0,
      depth: 0,
    });

    rows += await deleteOwned(payload, 'incidentReports', {
      subjectLearnerAuthId: { equals: subject.authId },
      legalHold: { exists: false },
    });

    return { rows, summaries, heldReports: held.totalDocs };
  });

/**
 * The Better Auth half: the user row, its sessions and its linked accounts, in
 * one call — `internalAdapter.deleteUser` deletes all three, which is what
 * makes signing back in impossible rather than merely inconvenient.
 *
 * Organisation memberships are removed first and by hand: Better Auth's delete
 * does not know about the organization plugin's `member` table, and a member
 * row pointing at a user id that no longer resolves is a row that shows up on
 * an org's people screen as a person nobody can remove.
 */
export const deleteAuthUser: DeleteAuthUser = async (_ctx, subject) => {
  const context = await auth.$context;
  await context.adapter.deleteMany({
    model: 'member',
    where: [{ field: 'userId', value: subject.authId }],
  });
  await context.internalAdapter.deleteUser(subject.authId);
};
