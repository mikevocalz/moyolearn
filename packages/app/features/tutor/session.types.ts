// The conversation, as something that outlives the tab it was typed into.
//
// A child does homework on the family laptop and finishes it on a phone in the
// car. Doc 23's premise is one continuing relationship with a tutor, not a
// series of amnesiac encounters, so the thread has to be a thing the SERVER
// knows about rather than a thing a zustand store happens to be holding.
//
// Identity is deliberately absent from every shape here. `learnerAuthId` comes
// from `ctx` at the service boundary and never travels as a parameter
// (CLAUDE.md §The block) — a session a client can name is a session a client
// can name someone else's.
// SOT: docs/pack/23-tutorstage-handoff.md · CLAUDE.md §The block
// SOT-KEYWORDS: tutor session message conversation persistence cross-device resume sync
import type { TutorAttachmentKind } from '@acme/ui';
import type { SessionBudgetState } from '@acme/inference';

export interface StoredAttachment {
  id: string;
  kind: TutorAttachmentKind;
  name: string;
  mimeType: string;
  /**
   * The CDN URL, once the bytes have landed.
   *
   * ABSENT IS A REAL STATE, not an error: the message is written the moment the
   * child sends it and the upload drains afterwards, so a second device can
   * legitimately see the turn before the picture. It renders as pending rather
   * than broken.
   */
  url?: string;
  /** What the retention sweep deletes, and what a re-render resolves. */
  storageKey?: string;
  durationSec?: number;
  transcript?: string;
  expiresAt?: string;
}

export interface StoredMessage {
  id: string;
  role: 'learner' | 'tutor';
  text: string;
  attachments: readonly StoredAttachment[];
  createdAt: string;
}

export interface TutorSessionSnapshot {
  sessionId: string;
  problem: string;
  messages: readonly StoredMessage[];
  /**
   * Whether the composer is open, and why not when it isn't (doc 12 §7).
   *
   * It rides the snapshot rather than getting a route of its own because the
   * budget has to be known BEFORE a turn is attempted: doc 12 §7's exhausted
   * state is an end-of-session summary, not a failed request, and a state a
   * screen learns by asking and being refused is a state it learns too late.
   * Every device that resolves the thread resolves the allowance with it.
   *
   * `SessionBudgetState` carries no turn counts on its terminal arm and no
   * money on any of them — CLAUDE.md §Children's surfaces forbids a price
   * rendering on a learner surface, and a field that isn't there cannot.
   */
  budget: SessionBudgetState;
}
