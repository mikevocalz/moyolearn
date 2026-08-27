// POST /api/tutor/session/message — append one turn to the learner's thread.
//
// The server assigns `id` and `createdAt`; the client cannot. Ordering a
// conversation by a timestamp a phone chose is how a reply renders above the
// question it answers, and two devices in the same thread would collide on an
// id the moment both were offline.
//
// `sessionId` is the only handle the client supplies, and owning it is checked
// downstream: the repository scopes every query by `ctx.learnerId`, so a
// stranger's id resolves to nothing and this route answers 404 — the same
// answer a genuinely missing session gets, so the endpoint cannot be used to
// discover which session ids exist.
// SOT: CLAUDE.md §The block · docs/pack/23-tutorstage-handoff.md
// SOT-KEYWORDS: tutor session message api route append turn attachment protected operation
import { NextRequest, NextResponse } from 'next/server';
import { addMessage, SessionNotFound, type StoredAttachment } from '@acme/app/server';
import { appendMessage } from '@/lib/tutor-session.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const num = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined);

/*
  An attachment that does not parse REJECTS the whole turn rather than being
  dropped from it. A message is what the child sent; silently posting it minus
  the photograph they attached would show them a turn they did not write.

  `url`/`storageKey`/`expiresAt` are accepted but not required — an attachment
  normally arrives before its bytes and is filled in by the PATCH route once the
  upload drains (session.types.ts). Any window the client names is floored at
  the product's seven days inside the service.
*/
function parseAttachment(value: unknown): StoredAttachment | null {
  if (!isRecord(value)) return null;

  const id = str(value.id);
  const name = str(value.name);
  const mimeType = str(value.mimeType);
  const kind = str(value.kind);
  if (id === undefined || name === undefined || mimeType === undefined) return null;
  if (kind !== 'image' && kind !== 'document' && kind !== 'audio') return null;

  return {
    id,
    kind,
    name,
    mimeType,
    url: str(value.url),
    storageKey: str(value.storageKey),
    durationSec: num(value.durationSec),
    transcript: str(value.transcript),
    expiresAt: str(value.expiresAt),
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: 'sessionId, role and text are required' }, { status: 400 });
  }

  const sessionId = str(body.sessionId);
  const role = str(body.role);
  const text = str(body.text);
  if (sessionId === undefined || text === undefined) {
    return NextResponse.json({ error: 'sessionId, role and text are required' }, { status: 400 });
  }
  // A register the render path switches on, so an unrecognised value is rejected
  // rather than coerced — a typo must not file a child's words as the tutor's.
  if (role !== 'learner' && role !== 'tutor') {
    return NextResponse.json({ error: 'role must be learner or tutor' }, { status: 400 });
  }

  const rawAttachments = body.attachments ?? [];
  if (!Array.isArray(rawAttachments)) {
    return NextResponse.json({ error: 'attachments must be an array' }, { status: 400 });
  }
  const attachments: StoredAttachment[] = [];
  for (const raw of rawAttachments) {
    const attachment = parseAttachment(raw);
    if (!attachment) {
      return NextResponse.json({ error: 'attachments are malformed' }, { status: 400 });
    }
    attachments.push(attachment);
  }

  try {
    const message = await addMessage(
      auth,
      request.headers,
      { sessionId, role, text, attachments },
      appendMessage,
    );
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    if (error instanceof SessionNotFound) {
      return NextResponse.json({ error: 'No such session' }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
