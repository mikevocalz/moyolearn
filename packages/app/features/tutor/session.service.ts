// Server-side tutor session service — the conversation, kept where the device isn't.
//
// Doc 23's premise is one continuing relationship with a tutor rather than a
// series of amnesiac encounters, so the thread is a server object and the
// zustand store is a cache of it. This file is what makes "finish it in the
// car" true: the same learner, on any device, resolves the SAME open session.
//
// Identity is absent from every input shape on purpose (CLAUDE.md §The block).
// `sessionId` is the one client-supplied handle, and it is never trusted on its
// own — every port is scoped by `ctx.learnerId` at the repository, so naming
// someone else's session resolves to nothing rather than to their homework.
//
// Ports are injected rather than imported: only repositories touch Payload, and
// a service that reached for one directly would drag the whole CMS into the
// mobile bundle the moment a feature imported it.
// SOT: docs/pack/23-tutorstage-handoff.md · CLAUDE.md §The block
// SOT-KEYWORDS: tutor session service conversation persistence cross-device resume attachment retention protected operation
import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Auth } from '@acme/auth/server';
import { transcriptExpiry } from '@acme/student-model';
/*
  The retention module directly, not the media barrel. `../media/index.ts` pulls
  the upload queue provider, the camera hooks and tus with it — a server-only
  file that imported the barrel would drag React Native into the Next server
  graph for one date function. Same reason `api/media/sweep` reaches for this
  exact file.
*/
import { mediaExpiry } from '../media/retention';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation';
import type { StoredAttachment, StoredMessage, TutorSessionSnapshot } from './session.types';

/**
 * A session as a repository stores it.
 *
 * `learnerAuthId` is present because a READ has to report who a row belongs to;
 * on the write path the repository takes it from `ctx` and ignores this field,
 * so there is no ordering of arguments that files a session under a stranger.
 */
export interface TutorSessionRow {
  sessionId: string;
  learnerAuthId: string;
  problem: string;
  messages: readonly StoredMessage[];
  expiresAt: string;
}

/** The fields an upload fills in once its bytes have landed. */
export interface AttachmentPatch {
  url: string;
  storageKey: string;
  expiresAt: string;
}

/**
 * Raised when a `sessionId` resolves to nothing FOR THIS LEARNER.
 *
 * Deliberately one error for both "no such session" and "not yours": a caller
 * that could tell the two apart could enumerate other children's session ids.
 */
export class SessionNotFound extends Error {}

/*
  Repository ports. The mutating ones answer `false` rather than throwing when
  the row is missing, so the "not yours" decision is made HERE, once, instead of
  being re-derived by every adapter.
*/
export type LoadOpenSession = (ctx: ProtectedCtx) => Promise<TutorSessionRow | null>;
export type CreateSession = (ctx: ProtectedCtx, row: TutorSessionRow) => Promise<void>;
export type AppendMessage = (
  ctx: ProtectedCtx,
  sessionId: string,
  message: StoredMessage,
) => Promise<boolean>;
export type PatchAttachment = (
  ctx: ProtectedCtx,
  sessionId: string,
  messageId: string,
  attachmentId: string,
  patch: AttachmentPatch,
) => Promise<boolean>;

export interface OpenSessionInput {
  /** Used ONLY when a session is created. An existing thread keeps its problem. */
  problem?: string;
}

export interface AddMessageInput {
  sessionId: string;
  role: StoredMessage['role'];
  text: string;
  attachments: readonly StoredAttachment[];
}

export interface AttachUploadedMediaInput {
  sessionId: string;
  messageId: string;
  attachmentId: string;
  url: string;
  storageKey: string;
  /**
   * A window the client believes the object has. Honoured only when it is
   * SHORTER than the product's — see `retentionWindow`.
   */
  expiresAt?: string;
}

const snapshot = (row: TutorSessionRow): TutorSessionSnapshot => ({
  sessionId: row.sessionId,
  problem: row.problem,
  messages: row.messages,
});

/**
 * The media window, floored at the product's promise.
 *
 * `retention.ts` gives a child's uploaded bytes seven days, and the sweep that
 * enforces it works off bucket age — so an `expiresAt` a client could inflate
 * would not extend the file's life, it would just make the thread claim a
 * picture is still there after the sweep took it. A shorter request is real,
 * though: a caller that knows its object is transient may say so.
 */
function retentionWindow(requested: string | undefined, now: Date): string {
  const horizon = mediaExpiry(now);
  if (requested === undefined) return horizon;
  const asked = Date.parse(requested);
  return Number.isNaN(asked) || asked >= Date.parse(horizon) ? horizon : requested;
}

/**
 * Resolves the learner's open session, creating one if there isn't a live thread.
 *
 * The GET that opens the tutor stage is also the GET that creates the session,
 * because the alternative — a separate "start" call — means a device that
 * crashed mid-handshake has a stage with no thread behind it, and the child sees
 * an empty conversation they know they had.
 */
export async function openSession(
  auth: Auth,
  headers: Headers,
  input: OpenSessionInput,
  loadOpenSession: LoadOpenSession,
  createSession: CreateSession,
): Promise<TutorSessionSnapshot> {
  return protectedOperation(auth, headers, async (ctx) => {
    const existing = await loadOpenSession(ctx);
    if (existing) return snapshot(existing);

    const now = new Date();
    const row: TutorSessionRow = {
      sessionId: randomUUID(),
      learnerAuthId: ctx.learnerId,
      problem: input.problem ?? '',
      messages: [],
      /*
        The conversation is a raw transcript of a child, so it gets the raw
        transcript's window (doc 07 §4 / ADR-006: 30 days) rather than a new
        number. It is written once at creation and no append touches it — the
        same "capture starts the clock" rule `sessionTranscripts` gets by being
        immutable, kept here by nothing ever writing the field twice.
      */
      expiresAt: transcriptExpiry(now),
    };
    await createSession(ctx, row);
    return snapshot(row);
  });
}

/**
 * Appends one turn and returns it as stored.
 *
 * `id` and `createdAt` are assigned HERE, not accepted: two devices typing into
 * the same thread would otherwise collide on a client clock, and ordering the
 * conversation by a timestamp a phone chose is how a reply lands above the
 * question. Attachment ids stay client-chosen — the device has to reference one
 * before the server has ever seen it, to patch in the URL when the upload
 * drains — but they only ever address attachments inside a message the caller
 * already owns.
 */
export async function addMessage(
  auth: Auth,
  headers: Headers,
  input: AddMessageInput,
  appendMessage: AppendMessage,
): Promise<StoredMessage> {
  return protectedOperation(auth, headers, async (ctx) => {
    const now = new Date();
    const message: StoredMessage = {
      id: randomUUID(),
      role: input.role,
      text: input.text,
      attachments: input.attachments.map((attachment) => ({
        ...attachment,
        /*
          A window is stamped only once a URL exists. An attachment written
          ahead of its bytes is a real state (session.types.ts), and giving it
          an expiry now would start the clock on a file that has not been
          uploaded yet — the thread would call it expired while it was still
          in the device's upload queue.
        */
        expiresAt:
          attachment.url === undefined
            ? undefined
            : retentionWindow(attachment.expiresAt, now),
      })),
      createdAt: now.toISOString(),
    };

    const appended = await appendMessage(ctx, input.sessionId, message);
    if (!appended) throw new SessionNotFound('No such session');
    return message;
  });
}

/**
 * Fills in one attachment's URL once its upload has landed.
 *
 * Separate from `addMessage` because the turn is written the moment the child
 * sends it and the bytes drain afterwards — a second device legitimately sees
 * the message before the picture, and this is the call that catches it up.
 */
export async function attachUploadedMedia(
  auth: Auth,
  headers: Headers,
  input: AttachUploadedMediaInput,
  patchAttachment: PatchAttachment,
): Promise<void> {
  return protectedOperation(auth, headers, async (ctx) => {
    const patched = await patchAttachment(ctx, input.sessionId, input.messageId, input.attachmentId, {
      url: input.url,
      storageKey: input.storageKey,
      expiresAt: retentionWindow(input.expiresAt, new Date()),
    });
    if (!patched) throw new SessionNotFound('No such session');
  });
}
