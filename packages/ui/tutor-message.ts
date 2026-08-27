// A turn in the tutor conversation.
//
// The stage used to render ONE state — the current thing Natalie was saying —
// so a photo a child sent had nowhere to appear and scrolled back to nothing.
// A tutoring session is a conversation with a history: what was asked, what was
// shown, what was answered. A child re-reading the hint from two turns ago is
// the normal case, not an edge one.
// SOT: docs/pack/23-tutorstage-handoff.md §3
// SOT-KEYWORDS: tutor message thread transcript history bubble learner natalie
import type { TutorAttachment } from './tutor-attachment.ts';

export interface TutorMessage {
  id: string;
  /** `learner` renders trailing and tinted; `tutor` leads and sits on surface. */
  role: 'learner' | 'tutor';
  text: string;
  /** Photos, documents and voice notes sent with this turn. */
  attachments?: readonly TutorAttachment[];
  /** Set while a tutor turn is still streaming, so the bubble can say so. */
  streaming?: boolean;
}
