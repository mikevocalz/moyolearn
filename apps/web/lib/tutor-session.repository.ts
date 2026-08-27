// Tutor-session repository — the only place the session routes touch Payload.
//
// Every query here is scoped by `ctx.learnerId`, not just filtered by the
// `sessionId` the caller sent. That is the whole security model of the feature:
// a client naming someone else's session gets an empty result set, which the
// service reads as `SessionNotFound`, which the route returns as a 404. There
// is no code path where the id alone is sufficient.
//
// `messages` is a JSON column, so an append is a read-modify-write rather than
// an INSERT. Two devices appending in the same instant can therefore lose a
// turn. That is accepted rather than papered over: the alternative is a
// messages collection with a join per read, and the conversation is always
// loaded and rendered as one document anyway. If it ever bites, the fix is an
// optimistic-concurrency column here — not a retry in the client.
// SOT: CLAUDE.md §The block · docs/pack/23-tutorstage-handoff.md
// SOT-KEYWORDS: tutor session repository payload messages append attachment patch cross-device
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import type {
  AppendMessage,
  CreateSession,
  LoadOpenSession,
  PatchAttachment,
  StoredAttachment,
  StoredMessage,
} from '@acme/app/server';

async function withPayload<T>(fn: (payload: Awaited<ReturnType<typeof getPayload>>) => Promise<T>): Promise<T> {
  const payload = await getPayload({ config });
  return fn(payload);
}

/*
  JSON as it comes back out of the column.

  Payload generates a json field as a union that includes `unknown[]`, which is
  not something the rest of the codebase is allowed to hold (CLAUDE.md §Types).
  Naming the shape once here means exactly one cast at the database edge and a
  decoder that is ordinary typed code from that point on.
*/
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Payload's generated type for a `json` field, structurally. */
type StoredJson = JsonValue | undefined;

const asObject = (value: JsonValue | undefined): Record<string, JsonValue> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;

const asString = (value: JsonValue | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asNumber = (value: JsonValue | undefined): number | undefined =>
  typeof value === 'number' ? value : undefined;

/*
  Decoded rather than cast, because the admin panel can hand-edit this column
  and a malformed entry must cost the reader that ONE turn, not the whole
  conversation. Anything that fails to decode is dropped; every field the
  contract defines is carried through, so a decode-and-rewrite (which is what
  `appendMessage` and `patchAttachment` both do) is lossless.
*/
function decodeAttachment(value: JsonValue): StoredAttachment | null {
  const raw = asObject(value);
  if (!raw) return null;

  const id = asString(raw.id);
  const name = asString(raw.name);
  const mimeType = asString(raw.mimeType);
  const kind = asString(raw.kind);
  if (id === undefined || name === undefined || mimeType === undefined) return null;
  if (kind !== 'image' && kind !== 'document' && kind !== 'audio') return null;

  return {
    id,
    kind,
    name,
    mimeType,
    url: asString(raw.url),
    storageKey: asString(raw.storageKey),
    durationSec: asNumber(raw.durationSec),
    transcript: asString(raw.transcript),
    expiresAt: asString(raw.expiresAt),
  };
}

function decodeMessage(value: JsonValue): StoredMessage | null {
  const raw = asObject(value);
  if (!raw) return null;

  const id = asString(raw.id);
  const role = asString(raw.role);
  const text = asString(raw.text);
  const createdAt = asString(raw.createdAt);
  if (id === undefined || text === undefined || createdAt === undefined) return null;
  if (role !== 'learner' && role !== 'tutor') return null;

  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments.map(decodeAttachment).filter((a): a is StoredAttachment => a !== null)
    : [];

  return { id, role, text, attachments, createdAt };
}

function decodeMessages(stored: StoredJson): StoredMessage[] {
  if (!Array.isArray(stored)) return [];
  return stored.map(decodeMessage).filter((m): m is StoredMessage => m !== null);
}

/**
 * The learner's live thread, newest first.
 *
 * `closedAt` null IS the open marker, so the query asks for its absence rather
 * than trusting a sort to put the right row on top. The sort is the tie-break
 * for the case that should not happen — two open rows — and it resolves it
 * toward the one the child was most recently typing into.
 */
export const loadOpenSession: LoadOpenSession = async (ctx) =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'tutorSessions',
      where: {
        and: [{ learnerAuthId: { equals: ctx.learnerId } }, { closedAt: { exists: false } }],
      },
      sort: '-createdAt',
      limit: 1,
    });

    const doc = docs[0];
    if (!doc) return null;

    return {
      sessionId: doc.sessionId,
      learnerAuthId: doc.learnerAuthId,
      problem: doc.problem ?? '',
      messages: decodeMessages(doc.messages as StoredJson),
      expiresAt: doc.expiresAt,
    };
  });

export const createSession: CreateSession = async (ctx, row) => {
  await withPayload((payload) =>
    payload.create({
      collection: 'tutorSessions',
      data: {
        sessionId: row.sessionId,
        // From `ctx`, never from the row. The service fills the row's copy from
        // the same place, but a write path that reads identity off its payload
        // is one refactor away from writing a session under a stranger's id.
        learnerAuthId: ctx.learnerId,
        problem: row.problem,
        messages: [...row.messages],
        expiresAt: row.expiresAt,
      },
    }),
  );
};

/** The learner's own row for `sessionId`, or null. The ownership gate. */
async function findOwned(
  payload: Awaited<ReturnType<typeof getPayload>>,
  learnerAuthId: string,
  sessionId: string,
) {
  const { docs } = await payload.find({
    collection: 'tutorSessions',
    where: {
      and: [{ sessionId: { equals: sessionId } }, { learnerAuthId: { equals: learnerAuthId } }],
    },
    limit: 1,
  });
  return docs[0] ?? null;
}

export const appendMessage: AppendMessage = async (ctx, sessionId, message) =>
  withPayload(async (payload) => {
    const doc = await findOwned(payload, ctx.learnerId, sessionId);
    if (!doc) return false;

    await payload.update({
      collection: 'tutorSessions',
      id: doc.id,
      /*
        `messages` only. `expiresAt` is never in an update payload anywhere in
        this file, which is what replaces `sessionTranscripts`' `update: false`
        — an append cannot renew a child's retention window because no append
        can name the field.
      */
      data: { messages: [...decodeMessages(doc.messages as StoredJson), message] },
    });
    return true;
  });

export const patchAttachment: PatchAttachment = async (
  ctx,
  sessionId,
  messageId,
  attachmentId,
  patch,
) =>
  withPayload(async (payload) => {
    const doc = await findOwned(payload, ctx.learnerId, sessionId);
    if (!doc) return false;

    let found = false;
    const messages = decodeMessages(doc.messages as StoredJson).map((message) => {
      if (message.id !== messageId) return message;
      return {
        ...message,
        attachments: message.attachments.map((attachment) => {
          if (attachment.id !== attachmentId) return attachment;
          found = true;
          return { ...attachment, ...patch };
        }),
      };
    });

    // A miss is reported rather than written. Rewriting the document unchanged
    // would answer "patched" to a caller naming an attachment that does not
    // exist, and the upload that produced the call would be marked drained.
    if (!found) return false;

    await payload.update({
      collection: 'tutorSessions',
      id: doc.id,
      data: { messages },
    });
    return true;
  });
