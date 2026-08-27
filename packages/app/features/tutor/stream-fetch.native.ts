// The fetch the coach stream uses on native.
//
// React Native's fetch has no streaming body — `response.body` is undefined, so
// `getReader()` returns nothing and the SSE loop exits immediately. It does that
// SILENTLY: the guard reads `if (!reader) return`, so a learner saw Natalie
// think and then say nothing at all, with no error anywhere.
//
// `stream: true` is not optional here and its absence is equally quiet —
// nitro-fetch buffers the whole body and enqueues it as ONE chunk at the end, so
// the reader loop still compiles, still parses every frame, and still shows the
// turn arriving in a single lump after the wait.
// SOT: packages/app/features/tutor/tutor.store.ts
// SOT-KEYWORDS: tutor stream fetch native sse nitro streaming coach
// Exported as `fetch`, aliased on import so nothing in this file reads as a
// call to the global one — they behave differently and the difference is the
// entire point of the file.
import { fetch as nitroFetch } from 'react-native-nitro-fetch';

export const streamFetch: typeof fetch = (input, init) =>
  nitroFetch(input as RequestInfo | URL, { ...init, stream: true });
