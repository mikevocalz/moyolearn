import type { CollectionConfig } from 'payload';

// The live tutoring conversation, held server-side so it survives the device.
//
// Doc 23's premise is one continuing relationship with a tutor: a child starts
// homework on the family laptop and finishes it in the car. A conversation that
// lives in a zustand store ends when the tab does, so the thread is a row here
// and the store is a cache of it.
//
// UPDATABLE, unlike `sessionTranscripts` next to it. That collection is a
// capture — written once, never touched, `update: () => false` so no code path
// can renew a child's retention window. This one is a working document: every
// turn appends to `messages`, and every upload that lands afterwards patches an
// attachment inside it. The retention promise is kept differently here — see
// `expiresAt` below.
//
// `messages` is JSON rather than a Payload array field. The shape is
// `StoredMessage[]` from `packages/app/features/tutor/session.types.ts`, with
// attachments nested one level down; modelling that as `array` inside `array`
// gives two generated join tables to migrate every time an attachment gains a
// field, and the whole document is always read and written as one unit anyway.
//
// No relationship to `users`. Learner identity travels as `learnerAuthId`, the
// same convention Consents, Guardianships and StudentModelFacts use, so this
// collection never joins itself to an auth row (doc 13 §5).
// SOT: docs/pack/23-tutorstage-handoff.md · docs/pack/07-security-child-ai-safety-spec.md §4
// SOT-KEYWORDS: tutor session conversation messages persistence cross-device resume attachment retention

export const TutorSessions: CollectionConfig = {
  slug: 'tutorSessions',
  /*
    VERSIONS OFF — this canary defaults them ON (see Leads.ts), and for a
    collection holding learner content that default silently breaks the erasure
    cascade promised by docs 19 and 24.

    Payload mirrors every write into `_<table>_v`, and the retention sweep
    targets `expires_at` on the MAIN table only. So a transcript survives its own
    deletion in the shadow table: "delete my child's data" does not delete it.
    Disk growth is the symptom; the broken guarantee is the defect, and it is the
    one a district's counsel asks about.

    Measured before turning it off: 1,294 shadow rows across the schema, with
    `_student_model_facts_v_texts` holding 1,119 against 49 live — a 23x copy of
    derived learner facts that nothing was ever going to sweep.

    Versions are an editorial feature: draft/publish, revert, who-changed-what.
    None of that applies to an append-only record of a child's session.
  */
  versions: false,
  admin: { useAsTitle: 'sessionId', defaultColumns: ['sessionId', 'learnerAuthId', 'closedAt', 'expiresAt'] },
  /*
    Read is gated on a session, and `update` is deliberately NOT disabled — a
    conversation that cannot be appended to is not a conversation. What replaces
    the immutability guarantee is that no route ever writes `expiresAt` after
    creation: the service computes it once from `transcriptExpiry` and the
    repository only ever sets `messages`, so an append cannot extend the window.
  */
  access: { read: ({ req }) => Boolean(req.user) },
  fields: [
    {
      // The id the client holds across devices. Unique because "the session" is
      // a thing a second device resolves BY THIS VALUE — two rows sharing it
      // would silently fork the thread, and the fork would be invisible until a
      // parent noticed half the conversation missing.
      name: 'sessionId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    { name: 'learnerAuthId', type: 'text', required: true, index: true },
    {
      // The problem the session is working on. Optional at the schema level
      // because a session legitimately opens before the child has captured
      // anything — the composer is usable with an empty stage.
      name: 'problem',
      type: 'text',
    },
    {
      // `StoredMessage[]`. Defaulted so a row created by the admin panel reads
      // as an empty thread rather than as a null the render path has to guard.
      name: 'messages',
      type: 'json',
      required: true,
      defaultValue: [],
    },
    {
      // NULL means open, and there is at most one open session per learner.
      // Modelled as a nullable timestamp rather than an `isOpen` boolean because
      // "when did this end" is the question the ops and retention views ask, and
      // a boolean answers it with a shrug.
      name: 'closedAt',
      type: 'date',
    },
    { name: 'expiresAt', type: 'date', required: true, index: true },
  ],
};
