// Both runtime markers must remain fail-closed and first, with React the default.
// SOT: moyo-rules.mjs · apps/admin-vite/vite.config.ts
// SOT-KEYWORDS: lint server-only marker tanstack regression
import { RuleTester } from 'eslint';
import { moyoPlugin } from './moyo-rules.mjs';

new RuleTester().run(
  'server-only-first',
  moyoPlugin.rules['server-only-first'],
  {
    valid: [
      { code: "import 'server-only'; export const ready = true;" },
      {
        code: "import '@tanstack/react-start/server-only'; export const ready = true;",
        options: [{ runtime: 'tanstack' }],
      },
    ],
    invalid: [
      {
        code: 'export const ready = true;',
        errors: [{ messageId: 'missing' }],
      },
      {
        code: "import '@tanstack/react-start/server-only';",
        errors: [{ messageId: 'missing' }],
      },
      {
        code: "import 'server-only';",
        options: [{ runtime: 'tanstack' }],
        errors: [{ messageId: 'missing' }],
      },
      {
        code: "export const ready = true; import 'server-only';",
        errors: [{ messageId: 'notFirst' }],
      },
      {
        code: "export const ready = true; import '@tanstack/react-start/server-only';",
        options: [{ runtime: 'tanstack' }],
        errors: [{ messageId: 'notFirst' }],
      },
    ],
  },
);
