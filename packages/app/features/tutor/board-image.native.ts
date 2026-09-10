'use client';
// The whiteboard's PNG, turned into the same kind of local URI a picker hands
// back — native.
//
// A FILE, AND IT HAS TO BE ONE. The bridge can only return a data URL, and
// nothing downstream on this platform accepts one: `read-attachment.native`
// hands the uri to ExecuTorch's OCR, `photograph-for-model.native` hands it to
// expo-image-manipulator, and `transport.native` opens it with
// `new File(file.uri)`. All three want a path. Writing the bytes once, here, is
// what lets a board travel the same road a photograph already travels instead
// of forking three call sites to special-case it.
//
// The cache directory, not documents: this is a copy of something the session
// already holds, and the system may reclaim it. If it is gone, the upload
// retries against a missing file and fails — which is the same outcome a photo
// has, and better than growing a directory the child cannot see or empty.
// SOT: packages/app/features/media/transport.native.ts · packages/ui/whiteboard.types.ts
// SOT-KEYWORDS: whiteboard board png data url file cache attachment tutor native

import { Directory, File, Paths } from 'expo-file-system';

const PNG_DATA_URL = /^data:image\/png;base64,/;

export async function boardImageUri(dataUrl: string): Promise<string | null> {
  /*
    Checked rather than split on the comma. The engine promises PNG, but a
    prefix that is not the one the decoder is about to assume produces a file
    full of the wrong bytes — which surfaces three steps later as an OCR pass
    that reads nothing, with nothing to point at.
  */
  if (!PNG_DATA_URL.test(dataUrl)) return null;
  try {
    const directory = new Directory(Paths.cache, 'whiteboard');
    if (!directory.exists) directory.create({ intermediates: true });
    // The clock is enough of a name: each ask is its own file, and the previous
    // one is still referenced by the turn that sent it.
    const file = new File(directory, `board-${Date.now()}.png`);
    file.create({ overwrite: true });
    file.write(dataUrl.replace(PNG_DATA_URL, ''), { encoding: 'base64' });
    return file.uri;
  } catch (error) {
    if (__DEV__) console.warn('[boardImageUri] could not write the board:', error);
    return null;
  }
}
