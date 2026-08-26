// Bunny presigning — the only place the storage key is read.
//
// The signing math lives in `bunny-sign.ts`, which is pure and takes the secret
// as an argument. This file exists to supply environment and nothing else, so
// the arithmetic stays testable without a `server-only` barrier around it.
//
// VERIFIED against the live zone: credential-free presigned PUT → 200, CDN read
// back byte-identical, and a mismatched Content-Type → 403.
// See docs/decisions/bunny-storage-presign-spike.md.
// SOT: CLAUDE.md §The block
// SOT-KEYWORDS: bunny presign repository storage upload credential env
import 'server-only';
import type { SignUpload } from '@acme/app/server';
import { encodeKey, signPutUrl } from './bunny-sign';

/**
 * Minutes, not hours.
 *
 * The URL is the whole credential — anyone holding it can write that object
 * until it expires — and Bunny Storage has no scoped write key to fall back on
 * (Access Key ID is the zone name, secret is the zone password). TTL is the only
 * control available, so it is short and minted per object.
 */
const EXPIRES_IN = 15 * 60;

export const signUpload: SignUpload = (key, contentType) => {
  const zone = process.env.BUNNY_STORAGE_ZONE_NAME;
  const secret = process.env.BUNNY_STORAGE_ACCESS_KEY;
  const region = process.env.BUNNY_STORAGE_REGION ?? 'ny';
  const cdn = process.env.NEXT_PUBLIC_BUNNY_CDN_BASE_URL;
  if (!zone || !secret || !cdn) {
    throw new Error('Bunny storage is not configured — see .env.example.');
  }

  const prefix = (process.env.BUNNY_MEDIA_PREFIX ?? '').replace(/^\/+|\/+$/g, '');
  const objectKey = prefix ? `${prefix}/${key}` : key;

  return {
    uploadUrl: signPutUrl({ zone, secret, region, key: objectKey, contentType, expiresIn: EXPIRES_IN }),
    publicUrl: `${cdn.replace(/\/+$/, '')}/${encodeKey(objectKey)}`,
    key: objectKey,
    expiresIn: EXPIRES_IN,
  };
};
