// Listing a Bunny storage folder, so a sweep can find what has aged out.
//
// Deliberately NOT driven from a database record. A sweep that only deletes
// what the app remembers uploading misses everything it forgot: a crash between
// PUT and insert, a migration that dropped a row, a file written by an older
// build. Listing the bucket and deleting by AGE catches those too, and needs no
// schema to be correct.
//
// Bunny's list endpoint reports `LastChanged` per object, which is the upload
// time for something never rewritten — and media here is written once.
// SOT: packages/app/features/media/retention.ts
// SOT-KEYWORDS: bunny list storage sweep retention age expiry orphan
export interface BunnyObject {
  path: string;
  name: string;
  isDirectory: boolean;
  lastChanged: string;
}

interface RawEntry {
  ObjectName: string;
  Path: string;
  IsDirectory: boolean;
  LastChanged: string;
}

/**
 * Collapses a prefix to the form Bunny's path actually takes.
 *
 * Leading and trailing slashes were already stripped; the INTERIOR ones are the
 * ones that bit. `listRecursive` builds a child prefix by concatenating
 * `${prefix}/${folder.name}`, so a prefix that already ends in a slash — which
 * is exactly what `.env.example` ships (`BUNNY_MEDIA_PREFIX=moyolearn/`) —
 * produces `moyolearn//session-a`. That is a different object path from
 * `moyolearn/session-a`, Bunny answers non-2xx, and the whole sweep throws.
 * `payload.config.ts` already normalises this same variable; the sweep did not.
 */
function normalizePrefix(prefix: string): string {
  return prefix.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
}

export async function listFolder(
  zone: { host: string; zone: string; password: string },
  prefix: string,
): Promise<BunnyObject[]> {
  const path = normalizePrefix(prefix);
  const res = await fetch(`https://${zone.host}/${zone.zone}/${path ? `${path}/` : ''}`, {
    headers: { AccessKey: zone.password, accept: 'application/json' },
  });

  /*
    A MISSING FOLDER IS AN EMPTY FOLDER, NOT A FAILED SWEEP.

    Bunny answers 404 for a prefix that holds no objects, and the zone is SHARED
    with another product (see `.env.example`), so Moyo's prefix only exists once
    Moyo has written under it. Throwing here made "there is nothing to delete"
    indistinguishable from "the retention sweep is broken" — and a retention
    sweep that reports failure on a clean zone is one nobody can ever read as
    healthy. 404 only: every other non-2xx is still a real failure.
  */
  if (res.status === 404) return [];

  if (!res.ok) {
    /*
      The body, not just the status. Bunny puts the reason in it
      (`{"HttpCode":401,"Message":"Unauthorized"}`), and a status alone cannot
      tell a wrong AccessKey from a wrong zone name. This error becomes
      `jobs.job.output` on a dead letter, which is the only record a human
      replaying it gets — see docs/incidents/2026-09-22-jobs-drain-outage.md.
    */
    const detail = await res.text().catch(() => '');
    throw new Error(`Bunny list failed (${res.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }

  const raw = (await res.json()) as RawEntry[];
  return raw.map((entry) => ({
    // Bunny's `Path` is absolute and zone-prefixed; the delete API wants the
    // key relative to the zone, so the prefix is stripped once here rather than
    // at every call site.
    path: `${entry.Path.replace(new RegExp(`^/${zone.zone}/`), '')}${entry.ObjectName}`,
    name: entry.ObjectName,
    isDirectory: entry.IsDirectory,
    lastChanged: entry.LastChanged,
  }));
}

/** Walks folders so a sweep sees the whole tree, not just the top level. */
export async function listRecursive(
  zone: { host: string; zone: string; password: string },
  prefix: string,
  depth = 0,
): Promise<BunnyObject[]> {
  // Bounded: a cycle is impossible in object storage, but a mistaken prefix
  // that keeps resolving would otherwise recurse until the process dies.
  if (depth > 8) return [];
  const entries = await listFolder(zone, prefix);
  const files = entries.filter((e) => !e.isDirectory);
  const folders = entries.filter((e) => e.isDirectory);
  const parent = normalizePrefix(prefix);
  const nested = await Promise.all(
    // `parent` is already normalised, so the join cannot produce a `//` even
    // when the caller's prefix carried a trailing slash.
    folders.map((folder) =>
      listRecursive(zone, parent ? `${parent}/${folder.name}` : folder.name, depth + 1),
    ),
  );
  return [...files, ...nested.flat()];
}
