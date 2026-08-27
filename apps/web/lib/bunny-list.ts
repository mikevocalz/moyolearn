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

export async function listFolder(
  zone: { host: string; zone: string; password: string },
  prefix: string,
): Promise<BunnyObject[]> {
  const path = prefix.replace(/^\/+|\/+$/g, '');
  const res = await fetch(`https://${zone.host}/${zone.zone}/${path ? `${path}/` : ''}`, {
    headers: { AccessKey: zone.password, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Bunny list failed (${res.status})`);

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
  const nested = await Promise.all(
    folders.map((folder) => listRecursive(zone, `${prefix}/${folder.name}`, depth + 1)),
  );
  return [...files, ...nested.flat()];
}
