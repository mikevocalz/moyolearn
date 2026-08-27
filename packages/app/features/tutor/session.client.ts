'use client';
// Talking to the session routes from either platform.
//
// One module so the phone and the browser cannot drift into two slightly
// different ideas of what a turn looks like — the whole point of the feature is
// that a child sees the SAME conversation on both, and two call sites is how
// that stops being true.
//
// Every call carries credentials and no identity: the session belongs to
// whoever the cookie says you are, resolved server-side from `ctx`.
// SOT: packages/app/features/tutor/session.types.ts
// SOT-KEYWORDS: tutor session client fetch resume cross-device sync message attachment
import { API_URL } from './tutor.store.ts';
import type { StoredAttachment, StoredMessage, TutorSessionSnapshot } from './session.types.ts';

async function readJson<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * The learner's open session, created on first ask.
 *
 * `problem` is a seed used ONLY when there is nothing to resume — a device
 * joining a conversation already in progress must not overwrite what the other
 * one was working on.
 */
export async function fetchSession(problem: string): Promise<TutorSessionSnapshot | null> {
  const query = problem.length > 0 ? `?problem=${encodeURIComponent(problem)}` : '';
  const body = await readJson<{ ok: true; session: TutorSessionSnapshot }>(
    await fetch(`${API_URL}/api/tutor/session${query}`, { credentials: 'include' }),
  );
  return body?.session ?? null;
}

export async function postMessage(input: {
  sessionId: string;
  role: 'learner' | 'tutor';
  text: string;
  attachments?: readonly StoredAttachment[];
}): Promise<StoredMessage | null> {
  const body = await readJson<{ ok: true; message: StoredMessage }>(
    await fetch(`${API_URL}/api/tutor/session/message`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  return body?.message ?? null;
}

/** Points a stored attachment at the bytes, once the queue says they landed. */
export async function patchAttachment(input: {
  sessionId: string;
  messageId: string;
  attachmentId: string;
  url: string;
  storageKey: string;
}): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/tutor/session/attachment`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return response.ok;
}
