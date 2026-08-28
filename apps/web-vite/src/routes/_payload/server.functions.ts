/**
 * The three server functions the Payload admin runs on: one that renders an
 * admin page to a Flight payload, one that resolves the panel's layout data,
 * and one that dispatches every `ServerFunctionClient` call the panel makes
 * (form state, document locks, folder queries…).
 *
 * `.functions.` in the filename is not decoration — `payloadTanstackStartOptions`
 * sets `routeFileIgnorePattern` to `importMap\.(?:d\.ts|js|server\.ts)$|\.functions\.`,
 * so this module and the generated `importMap.js` beside it are NOT read as
 * routes by TanStack's file-route generator. Rename either and the build starts
 * inventing routes out of them.
 *
 * The config and the import map arrive through dynamic `import()` inside each
 * handler rather than at module scope, because this file is imported by the
 * route modules that ship to the browser. The Start compiler prunes the handler
 * body from the client build; a top-level import of `@payload-config` would
 * pull the Postgres adapter into the marketing bundle before it got the chance.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/exports/server.d.ts:loadAdminPage,
 *        handleServerFunctions
 *      node_modules/@payloadcms/tanstack-start/dist/exports/layouts.d.ts:loadLayoutData
 *      node_modules/@payloadcms/tanstack-start/dist/utilities/serverFunctionClient.d.ts:
 *        createServerFunctionClient
 *      node_modules/@payloadcms/tanstack-start/dist/withPayload/index.js
 *        (payloadTanstackStartOptions → routeFileIgnorePattern)
 * SOT-KEYWORDS: web-vite payload admin server functions rsc loadAdminPage
 *               importMap super admin
 */
import type { SerializableRecord } from '@payloadcms/tanstack-start/server';
import type { ServerFunctionClientArgs } from 'payload';

import { createServerFunctionClient } from '@payloadcms/tanstack-start/client';
import { createServerFn } from '@tanstack/react-start';

type LoadInput = {
  _splat?: string;
  search?: Record<string, string | string[]>;
};

/*
  One injection point for the shared config and the generated map, shared by all
  three functions below. `@payload-config` is aliased by `withPayload` to
  packages/payload/src/payload.config.ts — deployment §5.2's single config, which
  this app consumes and never extends.
*/
const getConfig = async () => (await import('@payload-config')).default;
const getImportMap = async () => (await import('./importMap.js')).importMap;

export const loadAdminPageRSC = createServerFn({ method: 'GET' })
  .validator((data: LoadInput): LoadInput => data ?? {})
  .handler(async ({ data }) => {
    const { loadAdminPage } = await import('@payloadcms/tanstack-start/server');
    return loadAdminPage({
      config: await getConfig(),
      importMap: await getImportMap(),
      search: data.search,
      splat: data._splat,
    });
  });

export const getLayoutDataFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { loadLayoutData } = await import('@payloadcms/tanstack-start/layouts');
  return loadLayoutData({ config: await getConfig(), importMap: await getImportMap() });
});

const runPayloadServerFn = createServerFn({ method: 'POST' })
  .validator((args: ServerFunctionClientArgs): ServerFunctionClientArgs => args)
  .handler(async ({ data }) => {
    const { handleServerFunctions } = await import('@payloadcms/tanstack-start/server');
    /*
      Payload types every server function's result as `unknown` — one dispatcher
      serves `getFormState`, document locks, folder queries and custom RSC
      components, which share no shape. TanStack Start refuses `unknown` at a
      server-fn boundary because it cannot prove it serializable, so the result
      is asserted to the adapter's OWN transport brand rather than widened to
      `any`. `SerializableRecord` is `Record<string, unknown>` intersected with
      TanStack's `TsrSerializable` marker — the type the adapter's `toSerializable`
      produces and the one `loadLayoutData` already returns through this same
      boundary — so the assertion names the contract instead of erasing it.
    */
    return (await handleServerFunctions({
      args: data.args,
      config: await getConfig(),
      importMap: await getImportMap(),
      name: data.name,
    })) as SerializableRecord;
  });

/*
  Sanitises args for TanStack Start's seroval wire format before dispatch.
  Payload's own callers (`getFormState`) can hand over live form state carrying
  stray functions, which seroval throws on rather than dropping.
*/
export const serverFunctionHandler = createServerFunctionClient({
  runServerFn: runPayloadServerFn,
});
