// SigV4 presigning for Bunny's S3 layer. Pure: it takes the secret as an
// argument and reads no environment, so it can be unit-tested and exercised by a
// script — `bunny.repository.ts` is the `server-only` wrapper that supplies env.
//
// By hand rather than an SDK: the job is four HMACs and a query string, and
// pulling the AWS SDK into a serverless function to produce one URL is megabytes
// for arithmetic that fits on a screen. It is also the only way to be certain
// what gets signed — and a mismatch between the signed `Content-Type` and the
// header the client sends fails with a signature error that reads like a
// credentials problem.
// SOT: https://bunny.net/docs/storage/s3 · docs/decisions/bunny-storage-presign-spike.md
// SOT-KEYWORDS: bunny sigv4 presign s3 signature pure upload
import { createHash, createHmac } from 'node:crypto';

const sha256 = (data: string) => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string) => createHmac('sha256', key).update(data).digest();

/*
  RFC 3986, not `encodeURIComponent` — the latter leaves `!'()*` alone, and S3
  signs the encoded form. A filename with an apostrophe would sign one string and
  request another.
*/
const rfc3986 = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** A key is a path: each segment is escaped, the separators are not. */
export const encodeKey = (key: string) => key.split('/').map(rfc3986).join('/');

export interface SignPutInput {
  zone: string;
  secret: string;
  region: string;
  key: string;
  contentType: string;
  expiresIn: number;
  now?: Date;
}

/** A presigned PUT URL. The signature IS the credential — send nothing else. */
export function signPutUrl({
  zone,
  secret,
  region,
  key,
  contentType,
  expiresIn,
  now = new Date(),
}: SignPutInput): string {
  const host = `${region}-s3.storage.bunnycdn.com`;
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${region}/s3/aws4_request`;

  /*
    `content-type` is SIGNED. Deliberately: an unsigned type would let a caller
    ask for an image slot and store an executable, since Bunny keeps whatever
    Content-Type it is handed and later serves it back.
  */
  const query = [
    'X-Amz-Algorithm=AWS4-HMAC-SHA256',
    `X-Amz-Credential=${rfc3986(`${zone}/${scope}`)}`,
    `X-Amz-Date=${amzDate}`,
    `X-Amz-Expires=${expiresIn}`,
    'X-Amz-SignedHeaders=content-type%3Bhost',
  ]
    .sort()
    .join('&');

  const canonical = [
    'PUT',
    `/${zone}/${encodeKey(key)}`,
    query,
    `content-type:${contentType}\nhost:${host}\n`,
    'content-type;host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return `https://${host}/${zone}/${encodeKey(key)}?${query}&X-Amz-Signature=${signature}`;
}
