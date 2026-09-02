import type { CollectionConfig } from 'payload';

// The scheduled HUMAN tutoring session — doc 01 §7.1's calendar-engine core
// event, landed by ADR-110.
//
// DISTINCT FROM `tutorSessions` BY DESIGN, and the split is ADR-108's
// reasoning carried forward: that collection is the child's AI conversation
// with the product ("the tutor" there is the product), retention-scheduled
// learner content with no calendar semantics. This one is a business
// scheduling object — doc 28 §2 places Session on the CRM side of the wall
// ("relationship, scheduling, attendance, and billing context — never
// learning content"). "Hybrid" (doc 01 §7.1) is the two coexisting, joined by
// nothing.
//
// `tutorAuthId` IS THE SESSION→TUTOR EDGE ADR-108 recorded as missing: the
// tutor incident scope ("mine + my sessions", doc 31 §4.2) verifies "my"
// against ctx, which only an auth-id pointer can answer. The learner side
// follows the Leads precedent instead — display text plus a `learnerRef` text
// pointer — because a session row must not hand ops queries a join into
// learner identity, and the incident row already carries its own
// `subjectLearnerAuthId` behind the wall.
//
// No relationship to `users`. Identity travels as `*AuthId` / `*Ref` text
// pointers, the same convention Leads, TutorEngagements and Guardianships use
// (doc 13 §5).
// SOT: docs/decisions/adr-110-sessions-object.md · docs/pack/01-ai-tutoring-platform-plan.md §7.1 · docs/pack/28-crm-spec.md §2
// SOT-KEYWORDS: sessions collection calendar event human tutoring scheduled org tutor edge learner ref mode status ops hero my sessions
export const Sessions: CollectionConfig = {
  slug: 'sessions',
  /*
    VERSIONS OFF — this canary defaults them ON (see Leads.ts). A session's
    history is doc 28 §2's Activity timeline when that object arrives, not a
    row-level diff; a `_sessions_v` shadow table would be rows nothing sweeps.
  */
  versions: false,
  admin: {
    useAsTitle: 'learner',
    defaultColumns: ['scheduledAt', 'learner', 'subject', 'tutorAuthId', 'status'],
    group: 'Operations',
  },
  // Identity is never a parameter (doc 11 §3) — scoping happens in the access
  // layer, so nothing here is readable without an authenticated request.
  access: { read: ({ req }) => Boolean(req.user) },
  indexes: [
    // The ops hero's read is "this org, inside a time window, in start order";
    // the incident scope's is "this tutor's sessions". Both composites match
    // their access path where single columns would not.
    { fields: ['orgId', 'scheduledAt'] },
    { fields: ['tutorAuthId', 'scheduledAt'] },
  ],
  fields: [
    { name: 'orgId', type: 'text', required: true, index: true },
    {
      // The session→tutor edge (ADR-108's recorded gap, closed here). A Better
      // Auth pointer, never a foreign key.
      name: 'tutorAuthId',
      type: 'text',
      required: true,
      index: true,
    },
    /*
      Display text, the Leads precedent: the hero renders a name on every card
      and a display string is not a join. `learnerRef` is the optional pointer
      to the identity docs — text by the wall's rule (doc 28 §2's LearnerRef),
      so the CRM cannot traverse into learner data even by accident.
    */
    { name: 'learner', type: 'text', required: true },
    { name: 'learnerRef', type: 'text' },
    { name: 'subject', type: 'text' },
    { name: 'scheduledAt', type: 'date', required: true, index: true },
    { name: 'endsAt', type: 'date', required: true, index: true },
    {
      /*
        The lifecycle doc 28 reads: `session.missed` is a §4 automation trigger
        and attendance-driven billing counts `completed`. Nothing writes the
        terminal states yet (attendance capture is ADR-110's recorded
        non-goal); the enum exists so the write path lands on data, not on a
        migration.
      */
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      index: true,
      options: ['scheduled', 'completed', 'canceled', 'missed'],
    },
    {
      // Doc 10 §2.3's lowercase literals. Payload cannot express the
      // discriminated union (`virtual`⇒joinUrl, `in-person`⇒room), so the two
      // carriers are optional here and the read model narrows.
      name: 'mode',
      type: 'select',
      required: true,
      defaultValue: 'virtual',
      options: ['virtual', 'in-person'],
    },
    { name: 'joinUrl', type: 'text' },
    { name: 'room', type: 'text' },
    /*
      The doc 28 §6 scorer's flag, same as Leads: derived from business signals
      only — never from a learning signal — and rendered as the hero card's
      attention state.
    */
    { name: 'needsAttention', type: 'checkbox', defaultValue: false },
  ],
};
