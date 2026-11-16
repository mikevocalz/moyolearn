// Translate the shared React marker into the host compiler's native marker.
// SOT: @tanstack/start-plugin-core/import-protection/defaults · CONTRIBUTING.md
// SOT-KEYWORDS: admin server-only boundary tanstack marker compiler adapter
import type { Plugin } from 'vite';

const sharedServerFile =
  /\/packages\/app\/(?:marketing\/|core\/protected-operation\.ts(?:\?|$))/;

/** No empty-module alias: the compiler still rejects the marker in client graphs. */
export function sharedServerBoundary(): Plugin {
  return {
    name: 'moyo-shared-server-boundary',
    enforce: 'pre',
    transform(code, id) {
      if (!sharedServerFile.test(id.replaceAll('\\', '/'))) return;
      const converted = code.replace(
        /(^|\n)import ['"]server-only['"];?/g,
        "$1import '@tanstack/react-start/server-only';",
      );
      return converted === code ? undefined : { code: converted, map: null };
    },
  };
}
