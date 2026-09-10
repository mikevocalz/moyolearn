'use client';
// The whiteboard's PNG, turned into the same kind of local URI a picker hands
// back — web.
//
// WHY NOT JUST USE THE DATA URL. It would work for the reading and for the
// model, and it would break the two things that come after: `upload-queue`
// PERSISTS its items, so a 400 KB base64 string would be written into storage
// on every ask (localStorage caps around 5 MB in most browsers), and the turn
// keeps the uri in the transcript. An object URL is a handle, not a payload.
//
// It is also what the rest of the app already produces: `pick-note-image` and
// the camera sheet both hand back object URLs, and `transport.web`'s own note
// says "`file.uri` is an object URL on web". A board that produced a different
// shape would be a second kind of local image for every consumer to learn.
//
// Object URLs die with the document, exactly as the pickers' do — a reload
// loses a not-yet-uploaded board the same way it loses a not-yet-uploaded
// photo. That is the existing contract, not a new hole.
// SOT: packages/app/features/media/transport.web.ts · packages/ui/whiteboard.types.ts
// SOT-KEYWORDS: whiteboard board png data url object url attachment tutor web

export async function boardImageUri(dataUrl: string): Promise<string | null> {
  try {
    // A local read: `fetch` decodes a data: URL without touching the network.
    const blob = await fetch(dataUrl).then((res) => res.blob());
    return URL.createObjectURL(blob);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[boardImageUri] could not read the board:', error);
    }
    return null;
  }
}
