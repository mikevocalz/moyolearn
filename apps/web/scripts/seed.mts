// Dev seed. Writes the mock cast's ORG-side rows into Payload.
//
// Run: `pnpm --filter web seed`
//
// It is a script rather than a migration on purpose. Migrations describe schema;
// this describes demo content, and a migration that inserts rows fires again on
// every catch-up long after somebody has edited them. It is also idempotent by
// tenant rather than by row: a lead has no natural key, so the guard asks "does
// this district already have a pipeline?" and leaves it alone if so. Re-running
// therefore cannot duplicate a pipeline or overwrite a stage somebody moved.
//
// Only the org side is written here. The people — staff, learners, guardians —
// are Better Auth users (doc 06 §2), and Better Auth has no tables in this
// database yet; they live in `packages/app/fixtures/cast.ts` and are referenced
// from these rows by id, so the two halves join even while one is a fixture.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §7 · docs/pack/28-crm-spec.md §2–§3
// SOT-KEYWORDS: seed dev mock districts organizations leads guardianships consents idempotent
import nextEnv from '@next/env';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
nextEnv.loadEnvConfig(workspaceRoot, true, console);

const { getPayload } = await import('payload');
const { default: config } = await import('@payload-config');
// From the fixtures entry point, not the `@acme/app` barrel: the barrel is a
// client bundle and pulls React Native into a node script.
const { MOCK_ORGS, MOCK_GUARDIANS, MOCK_LEARNERS } = await import('@acme/app/fixtures/cast.ts');

const payload = await getPayload({ config });

/* ── Organizations ─────────────────────────────────────────────────────── */

for (const org of MOCK_ORGS) {
  const { docs } = await payload.find({
    collection: 'organizations',
    where: { slug: { equals: org.slug } },
    limit: 1,
  });
  const data = {
    name: org.name,
    slug: org.slug,
    kind: org.kind,
    logoUrl: org.logoUrl,
    brandAccent: org.brandAccent,
  };
  if (docs[0]?.id) {
    // Orgs ARE updated in place, unlike leads: name, logo and accent are
    // presentation the seed owns, and nobody moves them by hand in the admin.
    await payload.update({ collection: 'organizations', id: docs[0].id, data });
    console.log(`org      ~ ${org.slug}`);
  } else {
    await payload.create({ collection: 'organizations', data });
    console.log(`org      + ${org.slug}`);
  }
}

/* ── Leads ─────────────────────────────────────────────────────────────── */

/*
  A district's pipeline is bigger than a handful. Riverside gets enough families
  to push past the 25-row page size, because forward-only cursor pagination that
  has never been asked for a second page is pagination nobody has tested.

  Generated deterministically from fixed lists — no randomness, so two runs on
  two machines produce the same pipeline and a screenshot stays reproducible.
*/
const SURNAMES = [
  'Okafor', 'Whitfield', 'Bell', 'Rodriguez', 'Fischer', 'Adeyemi', 'Nakamura',
  'Delacroix', 'Osei', 'Marchetti', 'Haddad', 'Lindqvist', 'Baptiste', 'Yilmaz',
  'Kowalski', 'Mensah', 'Ferreira', 'Novak', 'Rahman', 'Castellanos',
  'Bergström', 'Achebe', 'Vasquez', 'Tremblay', 'Sinclair', 'Duarte',
  'Ibrahim', 'Petrov', 'Larsen', 'Moreau', 'Quintero', 'Abara',
];
const FIRSTS = [
  'Daniel', 'Noah', 'Sofia', 'Maya', 'Elena', 'Tomi', 'Rin', 'Camille', 'Kofi',
  'Luca', 'Amir', 'Ingrid', 'Yves', 'Deniz', 'Zofia', 'Kwame', 'Beatriz',
  'Jan', 'Ayaan', 'Lucia', 'Sven', 'Chidi', 'Mateo', 'Colette', 'Rory',
  'Ines', 'Hana', 'Dmitri', 'Freja', 'Anais', 'Paulo', 'Ngozi',
];
const SUBJECTS = [
  'Fractions', 'Algebra I', 'Algebra II', 'Geometry', 'Reading', 'Chemistry',
  'Biology', 'Pre-Calculus', 'Essay writing', 'Statistics',
];
const STAGES = [
  'Inquiry', 'Trial scheduled', 'Trial completed', 'Proposal', 'Enrolled', 'At risk',
] as const;

const pipelineFor = (slug: string, owners: string[], count: number, offset: number) =>
  Array.from({ length: count }, (_, i) => {
    const n = i + offset;
    const stage = STAGES[n % STAGES.length]!;
    const enrolled = stage === 'Enrolled' || stage === 'At risk';
    // Cohorts straddle MIN_COHORT (10) so the dashboard exercises BOTH branches
    // of attendance suppression from the default seed, not just from a test.
    const cohortSize = enrolled ? 12 + (n % 21) : n % 8;
    const sessions = enrolled ? 8 + ((n * 7) % 40) : n % 3;
    return {
      orgId: slug,
      family: SURNAMES[n % SURNAMES.length]!,
      learner: FIRSTS[n % FIRSTS.length]!,
      subject: SUBJECTS[n % SUBJECTS.length]!,
      stage,
      owner: owners[n % owners.length]!,
      valueCents: sessions * 4500,
      currency: 'USD',
      sessions,
      // Only booked families have a next session; the rest render "—".
      nextSessionAt:
        stage === 'Inquiry' || stage === 'Proposal'
          ? null
          : new Date(new Date().setHours(9 + (n % 8), (n % 2) * 30, 0, 0)).toISOString(),
      // The health scorer owns this (doc 28 §6); the seed only sets a plausible
      // starting state on the stages a human is meant to act on.
      needsAttention: stage === 'Trial scheduled' || stage === 'Proposal' || stage === 'At risk',
      attendancePct: cohortSize >= 10 ? 60 + ((n * 13) % 40) : null,
      cohortSize,
      learnerRef: null as string | null,
    };
  });

const PIPELINES: Record<string, ReturnType<typeof pipelineFor>> = {
  'riverside-unified': pipelineFor('riverside-unified', ['Amara', 'Jonah'], 31, 0),
  'lincoln-public': pipelineFor('lincoln-public', ['Elena', 'Kenji'], 14, 5),
};

// The learners who exist as people get their pointer set, so the LearnerRef wall
// (doc 28 §2 — a pointer, never a joinable relationship) is exercised by real data.
for (const learner of MOCK_LEARNERS) {
  const rows = PIPELINES[learner.orgSlug];
  const match = rows?.find((r) => r.learner === learner.name.split(' ')[0]);
  if (match) match.learnerRef = learner.id;
}

for (const [slug, rows] of Object.entries(PIPELINES)) {
  const existing = await payload.find({
    collection: 'leads',
    where: { orgId: { equals: slug } },
    limit: 1,
  });
  if (existing.docs.length > 0) {
    console.log(`leads    = ${slug} (already has a pipeline, left alone)`);
    continue;
  }
  for (const data of rows) {
    await payload.create({ collection: 'leads', data });
  }
  console.log(`leads    + ${slug} (${rows.length})`);
}

/* ── Guardianships and consents ────────────────────────────────────────── */

/*
  Doc 06 §3.1 makes these one transaction with the learner's creation: link, then
  consent. The learner half is a fixture here, so this writes the two rows that
  DO have collections and points them at the fixture ids.
*/
for (const guardian of MOCK_GUARDIANS) {
  for (const learnerId of guardian.learnerIds) {
    const link = await payload.find({
      collection: 'guardianships',
      where: {
        and: [
          { guardianAuthId: { equals: guardian.id } },
          { learnerAuthId: { equals: learnerId } },
        ],
      },
      limit: 1,
    });
    if (link.docs.length === 0) {
      await payload.create({
        collection: 'guardianships',
        data: {
          guardianAuthId: guardian.id,
          learnerAuthId: learnerId,
          relationship: 'parent',
          status: 'active',
        },
      });
      console.log(`guardian + ${guardian.id} → ${learnerId}`);
    }

    /*
      Consents are immutable and versioned (doc 06 §6) — the collection refuses
      update and delete outright. So this only ever CREATES, and only when the
      pair has no record: re-running must not write a second consent, because a
      duplicate row would read as a re-consent that never happened.
    */
    const consent = await payload.find({
      collection: 'consents',
      where: {
        and: [
          { guardianAuthId: { equals: guardian.id } },
          { learnerAuthId: { equals: learnerId } },
        ],
      },
      limit: 1,
    });
    if (consent.docs.length === 0) {
      await payload.create({
        collection: 'consents',
        data: {
          learnerAuthId: learnerId,
          guardianAuthId: guardian.id,
          method: guardian.consentMethod,
          scope: 'account,ai-tutoring,transcripts',
          policyVersion: '2026-08-01',
          evidenceRef: `seed:${guardian.id}:${learnerId}`,
          grantedAt: new Date('2026-08-01T12:00:00Z').toISOString(),
        },
      });
      console.log(`consent  + ${guardian.id} → ${learnerId} (${guardian.consentMethod})`);
    }
  }
}

console.log('\nSeed complete.');
process.exit(0);
