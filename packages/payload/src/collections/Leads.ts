import type { CollectionConfig } from 'payload';

// The CRM pipeline object (doc 28 §2–§3). One row per family in the funnel.
//
// THE WALL is structural here, not a convention: a lead carries relationship,
// scheduling and billing context and NO learning content. There is deliberately
// no relationship to `studentModelFacts`, `sessionTranscripts` or `skills`, and
// `learnerRef` is a plain text pointer rather than a Payload relationship — so
// the ops schema cannot join its way to a child's mastery data even by accident.
// Doc 28 §4's automation ethics rule ("never act on learner mastery or struggle")
// is enforced by the field list: those fields do not exist in this schema, so an
// automation cannot reference them.
//
// `stage` is the trial-centric pipeline of §3. `At risk` is in the enum because
// the health scorer (§6) writes it, but MANUAL_STAGES in @acme/app deliberately
// excludes it from what a human may choose — a hand-set value the scorer owns
// gets overwritten on its next run.
//
// `orgId` is the tenant boundary. It is written from `ctx` at the service layer
// and never accepted from client input (CLAUDE.md · The block).
// SOT: docs/pack/28-crm-spec.md §2 (object model) · §3 (pipeline) · §6 (health)
// SOT-KEYWORDS: leads crm pipeline stage family tenant org ops collection wall

export const Leads: CollectionConfig = {
  slug: 'leads',
  admin: {
    useAsTitle: 'family',
    defaultColumns: ['family', 'stage', 'owner', 'value', 'nextSession'],
    group: 'Operations',
  },
  access: { read: ({ req }) => Boolean(req.user) },
  /*
    No Payload version table. This canary defaults versions ON, which doubles the
    schema for every collection — and a lead's history is doc 28 §2's Activity
    timeline (notes, calls, emails, consent-scoped), not a row-level diff nobody
    in ops will ever open.
  */
  versions: false,
  indexes: [
    // The dashboard's default read is "this org, needing attention, newest
    // first". A composite index matches that access path; three single-column
    // indexes would not.
    { fields: ['orgId', 'needsAttention', 'createdAt'] },
    { fields: ['orgId', 'stage'] },
  ],
  fields: [
    { name: 'orgId', type: 'text', required: true, index: true },
    { name: 'family', type: 'text', required: true, index: true },
    /*
      A pointer, not a relationship. Doc 28 §2 makes LearnerRef a reference to
      the identity docs precisely so the CRM cannot traverse into learner data;
      a Payload `relationship` would hand every ops query a populated join.
    */
    { name: 'learnerRef', type: 'text' },
    { name: 'learner', type: 'text' },
    { name: 'subject', type: 'text' },
    {
      name: 'stage',
      type: 'select',
      required: true,
      defaultValue: 'Inquiry',
      index: true,
      options: [
        'Inquiry',
        'Trial scheduled',
        'Trial completed',
        'Proposal',
        'Enrolled',
        'At risk',
      ],
    },
    { name: 'owner', type: 'text' },
    /*
      Money as integer CENTS, never a float and never a formatted string. A
      float cannot represent 0.1 exactly, so summing a pipeline in dollars
      drifts; the display string is built at the edge from this.
    */
    { name: 'valueCents', type: 'number', defaultValue: 0 },
    { name: 'currency', type: 'text', defaultValue: 'USD' },
    { name: 'sessions', type: 'number', defaultValue: 0 },
    { name: 'nextSessionAt', type: 'date' },
    /*
      Derived by the §6 health scorer from business signals only — missed
      sessions, reschedule rate, invoice lateness, portal inactivity. Never from
      a learning signal.
    */
    { name: 'needsAttention', type: 'checkbox', defaultValue: false, index: true },
    /*
      Attendance is an AGGREGATE and therefore subject to k-anonymity
      suppression (doc 19 §5). Stored as the raw percentage; whether a reader may
      see it is decided at read time against the cohort size, so the suppression
      decision is never baked into the row.
    */
    { name: 'attendancePct', type: 'number' },
    { name: 'cohortSize', type: 'number', defaultValue: 0 },
  ],
};
