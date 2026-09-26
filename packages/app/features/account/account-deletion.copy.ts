// FD-26's words, in one place.
//
// They are here rather than inline in the screen for the reason doc 07 §S27's
// copy is: what a deletion screen promises is the product's most checkable
// claim, and a sentence that lives beside the button it labels drifts from the
// cascade it describes the first time the cascade changes. Every line below is
// traceable to code — the removed list to `eraseSubjectPayload` /
// `eraseEduSubject` / `eraseSubjectMedia`, the kept list to `legalHold`
// (doc 31 §4.1) and `learnerMediaScope`, the timing to the fact that the
// cascade is transactional and synchronous.
//
// NO SHAME, NO RETENTION PLAY. CLAUDE.md forbids engagement-pressure copy on a
// children's surface, and a deletion screen is where that rule gets tested:
// "Are you sure? You'll lose all your progress" is the industry default and it
// is exactly the guilt wording the rule names. So there is no "we'll miss
// you", no count of days streaked, no offer to pause instead. The screen states
// what happens and gets out of the way — `memory-content.tsx` argues the same
// position for the eraser, and this is the same argument at account scale.
//
// WHAT IS NOT CLAIMED. No backup window is stated. `docs/38-front-door-and-flow.md:450`
// drafts "deleted within 30 days", but nothing in this repo sets or enforces a
// backup retention period — `docs/pack/07-security-spec.md:60` names backups and
// a quarterly restore drill and no window — so printing a number would be a
// promise about a schedule that does not exist. What IS provable is stated:
// the live records go on confirm, and the one documented delay is a school
// account's uploads on `MEDIA_TTL_DAYS`.
// SOT: docs/38-front-door-and-flow.md §5A FD-26 · docs/pack/31-grade-voice-safety-incidents.md §4.1 · CLAUDE.md §Children's surfaces
// SOT-KEYWORDS: account deletion copy fd-26 confirm consequence list kept removed learner cannot delete guardian withdraw plain language
import { MEDIA_TTL_DAYS } from '../media/retention.ts';

/** Doc 38 FD-26's type-to-confirm word. Compared case-sensitively. */
export const DELETE_CONFIRM_WORD = 'DELETE';

export const ACCOUNT_DELETION_COPY = {
  title: 'Delete your account',
  /**
   * One sentence, no preamble. A deletion screen that opens by asking whether
   * the person is sure has already decided its own outcome matters more than
   * theirs.
   */
  lede: 'This removes your account and everything under it from Moyo. It cannot be undone.',
  removedHeading: 'What is removed',
  removed: [
    'Your sign-in, your profile, and every device you are signed in on.',
    'Every tutoring session, the words in it, and the notes Natalie kept about the work.',
    'Homework photos, voice notes, and whiteboard exports you or your learners uploaded.',
    'Session reports, the record of what was practised, and your consent records.',
  ],
  keptHeading: 'What is kept',
  kept: [
    'Safety reports that are held for legal reasons. These are kept on a schedule our lawyers set, not ours, and they are not used for tutoring.',
    'Records that no longer name anyone — totals we use to see whether the tutoring works.',
  ],
  timingHeading: 'How long it takes',
  timing:
    'The records above are deleted when you confirm, not later. Uploads on a school account are stored under the school rather than under one child, so those are removed on their own ' +
    `${MEDIA_TTL_DAYS}-day schedule instead.`,
  confirmLabel: `Type ${DELETE_CONFIRM_WORD} to confirm`,
  confirmHint: 'Capital letters, exactly as shown.',
  primary: 'Delete account',
  secondary: 'Keep my account',
  /** The guardian's half of the same screen. Rendered only when they have wards. */
  wardsHeading: 'Your learners',
  wardsLede:
    'Deleting your account also deletes the learners only you look after, and everything above applies to them too. A learner another grown-up also looks after stays with them.',
  wardsKept: (names: readonly string[]): string =>
    `${names.join(' and ')} stays, because another grown-up on the account looks after them too.`,
  /** The per-child control the consent screen promised (`consent-flow-content.tsx:82`). */
  learnerRowHint: 'Deleting a learner removes their account and everything Moyo holds about them.',
  learnerDeleteAction: 'Delete learner',
  learnerDialogTitle: (name: string): string => `Delete ${name}?`,
  learnerDialogBody: (name: string): string =>
    `${name}'s account, their sessions, their homework photos and everything Natalie remembers about them are deleted. Your own account is not touched.`,
} as const;

/**
 * What settings shows a guardian-managed learner.
 *
 * The honest answer is that they cannot do this, and the reason is not about
 * them: their account exists because a grown-up gave permission for it
 * (`create-managed-learner.ts`), and that permission is the grown-up's to take
 * back. So the row says where to go rather than offering a button that refuses.
 *
 * Written at the child's register and with no pressure in either direction —
 * nothing here tries to keep them, and nothing implies they did something to
 * end up reading it.
 */
export const LEARNER_DELETION_COPY = {
  heading: 'Deleting this account',
  body: 'A grown-up set this account up, so a grown-up can delete it. Ask them to open Settings on their own Moyo account and choose Delete learner.',
} as const;

/**
 * Refusals, as sentences. The keys are `DeletionRefusal` — the service never
 * sends words across the wire, so this map is the only place a refusal becomes
 * something a person reads.
 *
 * `sole-org-owner` names the way out rather than the rule, because "you are the
 * last owner" is a fact about our data model and "make someone else an owner"
 * is something the person can actually do.
 */
export const DELETION_REFUSAL_COPY = {
  'managed-learner': LEARNER_DELETION_COPY.body,
  'not-your-learner': 'That learner is not on your account.',
  'sole-org-owner':
    'You are the only owner of an organisation on Moyo. Make someone else an owner first, then delete your account — otherwise the organisation would be left with nobody able to manage it.',
} as const;

/** Everything the receipt still owes the person after a successful deletion. */
export const DELETION_OUTCOME_COPY = {
  mediaIncomplete:
    'Your account is deleted. Some uploaded photos or recordings could not be removed just now — they are deleted automatically on their own schedule.',
  heldReports:
    'Your account is deleted. A safety report about this account is held for legal reasons and was kept; it is not used for tutoring.',
  failed: 'Your account could not be deleted just now. Nothing was removed — try again.',
} as const;
