// Bunny presigning — the only place the storage key is read.
//
// The signing math lives in `bunny-sign.ts`, which is pure and takes the secret
// as an argument. This file exists to supply environment and nothing else, so
// the arithmetic stays testable without a `server-only` barrier around it.
//
// VERIFIED against the live zone: credential-free presigned PUT → 200, CDN read
// back byte-identical, and a mismatched Content-Type → 403.
// See docs/decisions/bunny-storage-presign-spike.md.
// It is also the only place a learner's objects are DELETED on request, for the
// same reason: an eraser that computed the prefix itself would be a second
// opinion about where the bytes are, and the failure mode of a wrong opinion
// here is deleting somebody else's child's files.
// SOT: CLAUDE.md §The block · packages/app/features/media/presign.rules.ts
// SOT-KEYWORDS: bunny presign repository storage upload credential env erase forget everything learner media prefix scope
import 'server-only';
import { learnerMediaScope } from '@acme/app/features/media/presign.rules.ts';
import type { EraseLearnerMedia, SignUpload } from '@acme/app/server';
import { encodeKey, signPutUrl } from './bunny-sign';
import { listRecursive, type BunnyObject } from './bunny-list';
import { deleteObjects } from './bunny-delete';

/**
 * Minutes, not hours.
 *
 * The URL is the whole credential — anyone holding it can write that object
 * until it expires — and Bunny Storage has no scoped write key to fall back on
 * (Access Key ID is the zone name, secret is the zone password). TTL is the only
 * control available, so it is short and minted per object.
 */
const EXPIRES_IN = 15 * 60;

/**
 * The namespace every key this file mints sits under, read once.
 *
 * Defaults to EMPTY, not to `moyolearn`. `signUpload` below is what actually
 * writes objects, and it has always used the empty default — so an eraser that
 * defaulted to a folder name (as `app/api/media/sweep` does) would walk a prefix
 * nothing was written to on any deployment where the variable is unset, find
 * nothing, and report a successful deletion of a child's files that are still
 * there. The write path defines the read path.
 */
const mediaPrefix = (): string => (process.env.BUNNY_MEDIA_PREFIX ?? '').replace(/^\/+|\/+$/g, '');

export const signUpload: SignUpload = (key, contentType) => {
  const zone = process.env.BUNNY_STORAGE_ZONE_NAME;
  const secret = process.env.BUNNY_STORAGE_ACCESS_KEY;
  const region = process.env.BUNNY_STORAGE_REGION ?? 'ny';
  const cdn = process.env.NEXT_PUBLIC_BUNNY_CDN_BASE_URL;
  if (!zone || !secret || !cdn) {
    throw new Error('Bunny storage is not configured — see .env.example.');
  }

  const prefix = mediaPrefix();
  const objectKey = prefix ? `${prefix}/${key}` : key;

  return {
    uploadUrl: signPutUrl({ zone, secret, region, key: objectKey, contentType, expiresIn: EXPIRES_IN }),
    publicUrl: `${cdn.replace(/\/+$/, '')}/${encodeKey(objectKey)}`,
    key: objectKey,
    expiresIn: EXPIRES_IN,
  };
};

/**
 * The Edge Storage zone, derived the way the media sweep derives it: the host
 * comes from the REGION, because the endpoint IS `<region>.storage.bunnycdn.com`
 * and a separate host variable is a second thing to get wrong.
 */
function storageZone(): { host: string; zone: string; password: string } {
  const name = process.env.BUNNY_STORAGE_ZONE_NAME;
  const password = process.env.BUNNY_STORAGE_ACCESS_KEY;
  const region = process.env.BUNNY_STORAGE_REGION ?? 'ny';
  if (!name || !password) throw new Error('Bunny storage is not configured — see .env.example.');
  return { host: `${region}.storage.bunnycdn.com`, zone: name, password };
}

/**
 * Every object this learner uploaded, deleted — or a stated refusal.
 *
 * HOW THE SCOPING IS PROVED, in three steps that each have to hold:
 *
 *  1. `learnerMediaScope` (pure, and the same module that BUILDS the keys)
 *     answers whether a prefix exists that selects this learner and nobody else.
 *     On a family account it is `<kind>/<learnerId>` per kind, which is exactly
 *     `buildKey`'s first two segments. On a school account there IS no such
 *     prefix — `mediaOwner` files org uploads under the org — and it says so
 *     rather than returning the org folder, because the only enumeration
 *     available there would delete other children's bytes.
 *  2. Nothing is deleted by a constructed key. `listRecursive` returns the paths
 *     BUNNY holds, and only those are passed to `deleteObjects`; a prefix that
 *     matches nothing deletes nothing instead of pattern-matching its way into a
 *     neighbouring folder.
 *  3. Every returned path is re-checked against the prefix it came from before
 *     it is deleted. `bunny-list.ts` rewrites Bunny's absolute `Path` to strip
 *     the zone, and that rewrite is the one place a listing could hand back a
 *     key outside the folder that was asked for — so the boundary is asserted on
 *     the way out as well as on the way in, and anything that fails it is
 *     reported as failed rather than silently skipped.
 *
 * BUNNY STREAM IS NOT REACHED, and cannot be. `bunny-stream-sign.ts:createVideo`
 * records a title and nothing else, so a video in the library carries no learner
 * attribution to filter on and there is no per-learner deletion to write. Videos
 * leave on `MEDIA_TTL_DAYS` through `sweepStreamVideos`, seven days, which is the
 * shortest window in the product — but it is a schedule, not this request, and
 * the caller reports it as such.
 */
export const eraseLearnerMedia: EraseLearnerMedia = async (ctx) => {
  const scope = learnerMediaScope(ctx.learnerId, ctx.orgId);
  if (!scope.scoped) return { scoped: false, reason: scope.reason };

  const zone = storageZone();
  const prefix = mediaPrefix();
  const deleted: string[] = [];
  const failed: string[] = [];

  for (const learnerPrefix of scope.prefixes) {
    const folder = prefix ? `${prefix}/${learnerPrefix}` : learnerPrefix;

    let objects: BunnyObject[];
    try {
      objects = await listRecursive(zone, folder);
    } catch (error) {
      /*
        A 404 is the commonest correct outcome there is — a learner who never
        uploaded an image has no `image/<id>/` folder — so it is an empty list
        and not a failure. EVERYTHING ELSE IS. A blanket `catch (() => [])` here
        would turn an expired access key or a Bunny outage into "nothing to
        delete", which is this feature's worst possible bug: a guardian told
        their child's files are gone because we could not ask.
      */
      if (error instanceof Error && error.message.includes('(404)')) continue;
      failed.push(folder);
      continue;
    }

    const inScope: string[] = [];
    for (const object of objects) {
      if (object.path.startsWith(`${folder}/`)) inScope.push(object.path);
      else failed.push(object.path);
    }
    const result = await deleteObjects(zone, inScope);
    deleted.push(...result.deleted);
    failed.push(...result.failed);
  }

  return { scoped: true, deleted: deleted.length, failed };
};
