'use client';
// Where the board lives between sessions — the local copy and the server one.
//
// TWO STORES, ONE ENCODING. `problemStorage` is the synchronous MMKV /
// localStorage this feature already uses for the problem, and it is what makes
// the board survive a reload without a frame of blank paper. The server copy is
// what makes it survive a change of DEVICE, which the JSON snapshot this
// replaces never did — a child who started on the laptop opened the phone to an
// empty board while their conversation resumed around it.
//
// EVERY PUSH CARRIES THE WHOLE DOCUMENT, not a delta, and that is what makes
// the server side survivable. The merge on the far side is still a
// read-modify-write and can still lose a race; because the next push contains
// everything again, a lost merge is repaired rather than lost. `pushRemoteBoard`
// therefore has no retry and needs none.
// SOT: packages/app/features/tutor/board-doc.ts · packages/app/features/capture/problem-storage.shared.ts
// SOT-KEYWORDS: tutor board storage persist yjs update local server cross-device merge

import { problemStorage, readBoard, writeBoard } from '../capture';
import { API_URL } from './tutor-constants.ts';
import { decodeBoardUpdate, encodeBoardUpdate, type BoardDoc } from './board-doc.ts';

/** The local copy, read synchronously so the first paint already has it. */
export function readLocalBoard(): Uint8Array | null {
  const stored = readBoard(problemStorage);
  return typeof stored === 'string' && stored.length > 0 ? decodeBoardUpdate(stored) : null;
}

export function writeLocalBoard(doc: BoardDoc): void {
  writeBoard(problemStorage, encodeBoardUpdate(doc.encode()));
}

/**
 * The server copy.
 *
 * Failure is silent BY DESIGN and only here: a board that cannot reach the
 * server is still on the device, still on screen, and still the child's. The
 * alternative — telling a nine-year-old their scratch paper failed to save — is
 * a sentence that costs them their attention and buys them nothing they can act
 * on. What must never be silent is the reverse, a board the child cannot see;
 * that is a render path, not this.
 */
export async function fetchRemoteBoard(sessionId: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`${API_URL}/api/tutor/session/board?sessionId=${encodeURIComponent(sessionId)}`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { update?: string };
    return data.update ? decodeBoardUpdate(data.update) : null;
  } catch {
    return null;
  }
}

export async function pushRemoteBoard(sessionId: string, doc: BoardDoc): Promise<void> {
  try {
    await fetch(`${API_URL}/api/tutor/session/board`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId, update: encodeBoardUpdate(doc.encode()) }),
    });
  } catch {
    /* See the note above: the board is not lost, only unsynced. */
  }
}
