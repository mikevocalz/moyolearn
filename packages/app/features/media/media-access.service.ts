import 'server-only';
// Who may READ a stored media object, decided once, here.
//
// `/api/media/view` is the one door to a child's homework photo or voice note
// now that the pull zone refuses unsigned reads (doc 29 §5). It used to sign any
// URL under the zone for any signed-in account: the UUID in the path was the
// only thing between one family's photographs and every other family that
// could guess or be leaked a URL. Signing is not authorisation, and a door that
// authenticates without authorising is a door with a lock on the outside.
//
// THE RULE IS THE WARD RULE, read backwards from the key. `buildKey` files every
// object under `<kind>/<owner>/…` where owner is `mediaOwner(ctx)` — the learner
// for a family account, the org for a school one. So the key names its owner,
// and the caller may read it when that owner is themselves, their org, or a
// learner they hold an ACTIVE guardianship of (`assertCanActFor`, the same
// predicate every homework path answers with). Anything else is `MediaNotFound`
// — never a 403, which would confirm the object exists.
// SOT: docs/pack/29-bunny-media-spec.md §5 · docs/verification/security-pass-2026-11.md H4 · CONTRIBUTING.md §The block
// SOT-KEYWORDS: media access service view signed url ownership ward rule guardian org key owner not found idor
import type { Auth } from '@acme/auth/server';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation.ts';
import { assertCanActFor } from '../homework/homework.service.ts';
import type { LoadGuardianWards } from '../summary/summary.service.ts';
import { mediaKeyOwner, storageKeyFromCdnUrl } from './presign.rules.ts';

/** Not under our zone, not a key we mint, or not the caller's to see — one answer. */
export class MediaNotFound extends Error {}

export interface MediaAccessPorts {
  readonly loadGuardianWards: LoadGuardianWards;
  /** `signCdnUrl` in production; the test seam hands back what it was given. */
  readonly sign: (url: string) => string;
  /** `NEXT_PUBLIC_BUNNY_CDN_BASE_URL`. Empty means no URL can be ours. */
  readonly cdnBase: string;
  /** `BUNNY_MEDIA_PREFIX`, the namespace `signUpload` writes every key under. */
  readonly mediaPrefix: string;
}

/**
 * The ownership half, on a resolved `ctx`. Exported so the test can drive it
 * with explicit identities, the way `createSubmissionFor` is driven next door.
 */
export async function signMediaUrlFor(
  ctx: ProtectedCtx,
  url: string,
  ports: MediaAccessPorts,
): Promise<string> {
  const key = storageKeyFromCdnUrl(url, ports.cdnBase);
  if (key === null) throw new MediaNotFound('Not found');
  const owner = mediaKeyOwner(key, ports.mediaPrefix);
  if (owner === null) throw new MediaNotFound('Not found');

  if (owner !== ctx.learnerId && !(ctx.orgId !== undefined && owner === ctx.orgId)) {
    try {
      await assertCanActFor(ctx, owner, ports.loadGuardianWards);
    } catch (error) {
      if (error instanceof Error && error.message === 'Forbidden') {
        throw new MediaNotFound('Not found');
      }
      throw error;
    }
  }
  return ports.sign(url);
}

/** The route's door: session → ctx → ownership → signature. */
export async function signOwnedMediaUrl(
  auth: Auth,
  headers: Headers,
  url: string,
  ports: MediaAccessPorts,
): Promise<string> {
  return protectedOperation(auth, headers, (ctx) => signMediaUrlFor(ctx, url, ports), {
    telemetry: { op: 'media.view', resource: 'media', action: 'read' },
  });
}
