// Signing a CDN read, now that the pull zone refuses unsigned ones.
//
// Doc 29 §5: a child's homework capture is served token-authenticated, private,
// TTL'd — "not optional for this class". The zone had token auth OFF, which
// meant every voice note and homework photo was fetchable by anyone holding the
// URL, forever. Verified before the change (200, no credentials) and after
// (403 unsigned). The UUID in the path is obscurity, not access control.
//
// Bunny's URL token: token = base64url( sha256_raw( key + path + expires ) ),
// appended as ?token=…&expires=…. The KEY never leaves this module.
// SOT: docs/pack/29-bunny-media-spec.md §5
// SOT-KEYWORDS: bunny token auth signed url cdn learner media private ttl
import 'server-only';
import { createHash } from 'node:crypto';

/**
 * One hour. Long enough for a session including a child who walks away and
 * comes back; short enough that a link pasted somewhere it should not be goes
 * dead the same afternoon. Re-hydrating signs afresh, so expiry never strands a
 * legitimate reader.
 */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export function signCdnUrl(url: string, now = new Date()): string {
  const key = process.env.BUNNY_PULL_ZONE_TOKEN_KEY;
  const base = process.env.NEXT_PUBLIC_BUNNY_CDN_BASE_URL ?? '';
  // Not ours to sign (a Stream URL, an external link) — or no key, in which
  // case returning the bare URL is honest: it will 403 rather than pretend.
  if (!key || !base || !url.startsWith(base)) return url;

  const path = url.slice(base.length).split('?')[0] ?? '';
  const expires = Math.floor(now.getTime() / 1000) + SIGNED_URL_TTL_SECONDS;
  const token = createHash('sha256')
    .update(key + path + String(expires))
    .digest('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return `${base}${path}?token=${token}&expires=${expires}`;
}
