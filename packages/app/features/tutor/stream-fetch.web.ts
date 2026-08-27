// The browser's fetch already streams: `response.body` is a ReadableStream and
// `getReader()` yields chunks as they arrive. Nothing to add.
// SOT-KEYWORDS: tutor stream fetch web sse native fetch
export const streamFetch: typeof fetch = (input, init) => fetch(input, init);
