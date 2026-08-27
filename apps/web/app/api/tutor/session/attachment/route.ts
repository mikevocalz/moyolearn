// PATCH /api/tutor/session/attachment — fill in an attachment once its bytes land.
//
// The turn is written the moment the child sends it and the upload drains
// afterwards, so a second device legitimately sees the message before the
// picture (session.types.ts: absent `url` is a real state, not an error). This
// is the call that catches the thread up.
//
// PATCH rather than POST because it is an idempotent field-set on an existing
// attachment: an upload queue that retries a drain must be able to send the
// same body twice without appending anything.
//
// `expiresAt` is accepted from the client and then FLOORED at the product's
// seven-day media window in the service — a caller may declare a shorter life
// for its object, never a longer one.
// SOT: CLAUDE.md §The block · packages/app/features/media/retention.ts
// SOT-KEYWORDS: tutor session attachment api route patch upload url storage key retention
import { NextRequest, NextResponse } from 'next/server';
import { attachUploadedMedia, SessionNotFound } from '@acme/app/server';
import { patchAttachment } from '@/lib/tutor-session.repository';
import { auth } from '@/lib/auth';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      { error: 'sessionId, messageId, attachmentId, url and storageKey are required' },
      { status: 400 },
    );
  }

  const sessionId = str(body.sessionId);
  const messageId = str(body.messageId);
  const attachmentId = str(body.attachmentId);
  const url = str(body.url);
  const storageKey = str(body.storageKey);

  if (
    sessionId === undefined ||
    messageId === undefined ||
    attachmentId === undefined ||
    url === undefined ||
    storageKey === undefined
  ) {
    return NextResponse.json(
      { error: 'sessionId, messageId, attachmentId, url and storageKey are required' },
      { status: 400 },
    );
  }

  try {
    await attachUploadedMedia(
      auth,
      request.headers,
      { sessionId, messageId, attachmentId, url, storageKey, expiresAt: str(body.expiresAt) },
      patchAttachment,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    // The same 404 covers "no such session", "not yours" and "no such
    // attachment" — telling them apart would let a caller probe for ids.
    if (error instanceof SessionNotFound) {
      return NextResponse.json({ error: 'No such session' }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
