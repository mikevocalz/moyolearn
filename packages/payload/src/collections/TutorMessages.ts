import type { CollectionConfig } from 'payload';

// One turn of a tutoring conversation. One row, one insert.
//
// This was a `messages` JSON array on the session document, which made every
// turn a read-modify-write of the ENTIRE transcript: O(n^2) writes across a
// conversation, lock contention on the hot row, and — because this canary
// defaults versions ON — a full snapshot of the whole conversation mirrored into
// `_tutor_sessions_v` on every single turn. 13 shadow rows for one session.
//
// Versions being off fixes the symptom. This fixes the shape that caused it:
// a turn is an append to an event log, not an edit to a document.
//
// It also makes retention TARGETABLE PER MESSAGE rather than per conversation,
// which is what doc 07 §4's erasure actually needs — a guardian erasing one
// exchange should not have to erase the session around it.
// SOT: docs/pack/12-systems-design.md §11.1 · docs/pack/23-tutorstage-handoff.md
// SOT-KEYWORDS: tutor message turn collection append event log conversation retention erasure
export const TutorMessages: CollectionConfig = {
  slug: 'tutorMessages',
  versions: false,
  admin: { useAsTitle: 'messageId', defaultColumns: ['messageId', 'sessionId', 'role'] },
  access: {
    read: ({ req }) => Boolean(req.user),
    /*
      A turn is immutable except for one thing: an attachment learning where its
      bytes landed. Update stays open for that and only that — the repository is
      the enforcement, and it names `attachments` in the only update it performs.
    */
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    // The handle the client and the upload queue both address a turn by. Unique:
    // two rows sharing it means a completed upload patches an arbitrary one.
    { name: 'messageId', type: 'text', required: true, unique: true, index: true },
    // Denormalised rather than a relationship. The read is always "this
    // session's turns, in order", and a text column with an index answers it
    // without Payload's join machinery — the same reason `learnerAuthId` is a
    // pointer and not a foreign key elsewhere in this schema.
    { name: 'sessionId', type: 'text', required: true, index: true },
    { name: 'learnerAuthId', type: 'text', required: true, index: true },
    { name: 'role', type: 'select', required: true, options: ['learner', 'tutor'] },
    { name: 'text', type: 'textarea', required: true },
    // `StoredAttachment[]`. Nested because an attachment has no life of its own:
    // it is only ever read with its turn, and erasing the turn must erase it.
    { name: 'attachments', type: 'json' },
    // Its own clock, so one exchange can be erased without the conversation.
    { name: 'expiresAt', type: 'date', required: true, index: true },
  ],
};
