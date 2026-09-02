// Families repository — the only place the ops routes touch the `families`
// collection (ADR-109's household object, doc 28 §2).
//
// One translation (`toFamily`), used by every read and both writes' echoes —
// the record shape cannot drift between the list, the detail, the contacts
// save and the create-path upsert. `learnerRefs` flatten to their strings
// here and are NEVER resolved: they are pointers out of the Operations Cloud,
// and this file is registered in `tooling/check-crm-wall.mjs`'s CRM_ROOTS so
// the lint sees any attempt to follow one.
//
// The tenant predicate is applied HERE, on every read and every write, because
// this is the last layer before the database — a filter that lives any further
// up is a filter a future caller can forget.
// SOT: CLAUDE.md §The block · docs/decisions/adr-109-family-household-object.md · docs/pack/28-crm-spec.md §2
// SOT-KEYWORDS: families repository payload crm household contacts learner refs tenant org upsert
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { Family as FamilyRow } from '@acme/payload';
import type {
  FamilyRecord,
  LoadFamilies,
  LoadFamily,
  SaveFamilyContacts,
  UpsertFamilyByName,
} from '@acme/app/server';

async function withPayload<T>(fn: (payload: Awaited<ReturnType<typeof getPayload>>) => Promise<T>): Promise<T> {
  const payload = await getPayload({ config });
  return fn(payload);
}

const toFamily = (doc: FamilyRow): FamilyRecord => ({
  id: String(doc.id),
  name: doc.name,
  contacts: (doc.contacts ?? []).map((contact) => ({
    name: contact.name,
    relationship: contact.relationship,
    email: contact.email ?? undefined,
    phone: contact.phone ?? undefined,
  })),
  learnerRefs: (doc.learnerRefs ?? []).map((entry) => entry.ref),
});

export const loadFamilies: LoadFamilies = async (ctx) => {
  if (!ctx.orgId) return [];
  return withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'families',
      where: { orgId: { equals: ctx.orgId } },
      limit: 1000,
      // Alphabetical here is incidental — the service re-sorts attention-first;
      // a stable order just keeps equal-attention pages deterministic.
      sort: 'name',
    });
    return docs.map((doc) => toFamily(doc));
  });
};

export const loadFamily: LoadFamily = async (ctx, familyId) => {
  if (!ctx.orgId) return null;
  const id = Number(familyId);
  if (!Number.isInteger(id)) return null;

  return withPayload(async (payload) => {
    /*
      Resolved by WHERE — id AND org — for the leads-repository reason: a find
      by bare id would hand a guessed cross-tenant id another org's household.
      Anding the tenant makes the wrong org's read an empty page, which the
      route reports as a 404 indistinguishable from "never existed".
    */
    const { docs } = await payload.find({
      collection: 'families',
      where: { and: [{ id: { equals: id } }, { orgId: { equals: ctx.orgId } }] },
      limit: 1,
    });
    const doc = docs[0];
    return doc ? toFamily(doc) : null;
  });
};

export const saveFamilyContacts: SaveFamilyContacts = async (ctx, familyId, contacts) => {
  if (!ctx.orgId) return null;
  const id = Number(familyId);
  if (!Number.isInteger(id)) return null;

  return withPayload(async (payload) => {
    /*
      Updated by WHERE, not by id — the saveLeadStage reason: `update({ id })`
      would rewrite another org's contact list whenever a caller guessed its
      id; anding the tenant makes the wrong org's write match zero rows.
      The list is replaced whole: the record page edits the full set and the
      parse floor already bounded it, so a diff protocol would be machinery
      without a reader.
    */
    const { docs } = await payload.update({
      collection: 'families',
      where: { and: [{ id: { equals: id } }, { orgId: { equals: ctx.orgId } }] },
      data: { contacts },
    });
    const doc = docs[0];
    return doc ? toFamily(doc) : null;
  });
};

export const upsertFamilyByName: UpsertFamilyByName = async (ctx, name) => {
  return withPayload(async (payload) => {
    const key = name.trim();
    const find = async () => {
      const { docs } = await payload.find({
        collection: 'families',
        where: { and: [{ orgId: { equals: ctx.orgId } }, { name: { equals: key } }] },
        limit: 1,
      });
      return docs[0];
    };

    const existing = await find();
    if (existing) return String(existing.id);

    try {
      const created = await payload.create({
        collection: 'families',
        /*
          The tenant is written from `ctx` HERE, never accepted from input —
          the service already refused a session with no org, so the assertion
          documents rather than guards.
        */
        data: { orgId: ctx.orgId!, name: key },
      });
      return String(created.id);
    } catch (error) {
      /*
        Two staff adding the same family's leads at once race past the find;
        the DB's unique (org_id, name) turns the loser into this error, and the
        re-find returns the winner's row — the upsert stays idempotent under
        concurrency instead of surfacing a duplicate-key 500 for a household
        that now exists.
      */
      const winner = await find();
      if (winner) return String(winner.id);
      throw error;
    }
  });
};
