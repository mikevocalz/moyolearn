/** @jsxImportSource react */
import type { ServerFunctionClient } from 'payload';

import config from '@payload-config';
import '@payloadcms/next/css';
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts';
import React from 'react';

import { display, mono, sans } from '../fonts';
import { importMap } from './admin/importMap.js';
import './custom.css';

type Args = {
  children: React.ReactNode;
};

const serverFunction: ServerFunctionClient = async (args) => {
  'use server';

  return handleServerFunctions({
    ...args,
    config,
    importMap,
  });
};

export default function PayloadLayout({ children }: Args) {
  /*
    Payload's Next adapter hardcodes Inter and Roboto Mono into <html> and its
    public Props type omits the `fonts` slot, so the brand faces cannot be
    passed through RootLayout. Rendering them on a wrapper inside it is what
    both injects the @font-face rules (next/font only emits a face that is
    actually used) and applies the family to the whole panel — without forking
    Payload's layout onto internals that move between minors.

    custom.css separately points --font-family-sans/-mono/-display at the same
    families, so anything reading those variables resolves to a face that is now
    genuinely loaded rather than silently falling back to system-ui.
  */
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      <div
        className={`moyo-admin ${sans.className} ${sans.variable} ${mono.variable} ${display.variable}`}
      >
        {children}
      </div>
    </RootLayout>
  );
}
