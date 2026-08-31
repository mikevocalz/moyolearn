/** @jsxImportSource react */
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import config from '@payload-config';
import { generatePageMetadata, RootPage } from '@payloadcms/next/views';

import { importMap } from '../importMap.js';

type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<Record<string, string | string[]>>;
};

export const dynamic = 'force-dynamic';

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams });

export default async function Page({ params, searchParams }: Args) {
  const h = await headers();
  const rawHost = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const host = (rawHost.split(':')[0] ?? '').toLowerCase();
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'moyolearn.com').toLowerCase();
  // The admin UI is now served only by apps/admin-vite on admin.<ROOT>.
  // Requests from any other host hit a 404 so the Payload surface does not leak
  // on district or app subdomains while the migration is in progress.
  if (host !== `admin.${root}`) {
    notFound();
  }
  return RootPage({ config, params, searchParams, importMap });
}
