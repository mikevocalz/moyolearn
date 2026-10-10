// Bound the chemistry request before JSON parsing, including chunked bodies.
// Keep the worker credential on its configured origin by rejecting redirects.
// SOT: docs/compute/qdk-chemistry.md
// SOT-KEYWORDS: chemistry request body bytes worker credential redirect
import 'server-only';

type JsonResult = { ok: true; value: unknown } | { ok: false; tooLarge: boolean };

export async function readChemistryJson(request: Request): Promise<JsonResult> {
  const limit = 512;
  if (Number(request.headers.get('content-length') ?? 0) > limit) {
    return { ok: false, tooLarge: true };
  }
  if (!request.body) return { ok: false, tooLarge: false };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
    return { ok: true, value };
  } catch {
    return { ok: false, tooLarge: false };
  } finally {
    reader.releaseLock();
  }
}

export function fetchChemistryWorker(origin: URL, token: string, moleculeId: string) {
  return fetch(new URL('/v1/chemistry/energy', origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Chemistry-Worker-Token': token,
    },
    body: JSON.stringify({ moleculeId }),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(25_000),
  });
}
