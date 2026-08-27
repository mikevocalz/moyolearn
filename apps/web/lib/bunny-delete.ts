// Deleting objects from Bunny Edge Storage.
//
// Pure like `bunny-sign`: takes its credentials as arguments and reads no
// environment, so the retention sweep can be exercised against a test zone
// without a `server-only` barrier in the way.
//
// Uses the classic Edge Storage API rather than the S3 layer. Deletion needs no
// signature — the zone password IS the credential — and a signed DELETE would be
// more moving parts for the same effect.
// SOT: packages/app/features/media/retention.ts
// SOT-KEYWORDS: bunny delete storage retention sweep expiry edge api
export interface BunnyZone {
  /** e.g. `ny.storage.bunnycdn.com` — region matters; the default host is not it. */
  host: string;
  zone: string;
  password: string;
}

/**
 * Deletes one object. Resolves `true` when it is gone.
 *
 * A 404 counts as success: the object being already absent is the state the
 * caller wanted, and treating it as failure makes a sweep retry forever over
 * things that no longer exist.
 */
export async function deleteObject(zone: BunnyZone, key: string): Promise<boolean> {
  const res = await fetch(`https://${zone.host}/${zone.zone}/${encodeURI(key)}`, {
    method: 'DELETE',
    headers: { AccessKey: zone.password },
  });
  return res.ok || res.status === 404;
}

/**
 * Deletes many, and reports what failed rather than throwing on the first.
 *
 * One unreachable object must not strand the rest of a sweep — the remaining
 * files are a child's data past its retention window, and leaving them because
 * an earlier delete timed out is the outcome this exists to prevent.
 */
export async function deleteObjects(
  zone: BunnyZone,
  keys: readonly string[],
): Promise<{ deleted: string[]; failed: string[] }> {
  const deleted: string[] = [];
  const failed: string[] = [];
  for (const key of keys) {
    try {
      if (await deleteObject(zone, key)) deleted.push(key);
      else failed.push(key);
    } catch {
      failed.push(key);
    }
  }
  return { deleted, failed };
}
