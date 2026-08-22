#!/usr/bin/env node
// §13 generators: `pnpm gen domain <name>` / `pnpm gen feature <name>` / `pnpm gen component <Name>`
// The generator IS the pattern (doc 11 §1): a shape that is emitted can't be
// mistyped, which is stronger than any rule written down and hoped for.
// SOT: docs/pack/11-architectural-guardrails.md §1, §3, §6 · CLAUDE.md
// SOT-KEYWORDS: generator scaffold domain feature component sot-header server-only block
// ponytail: plain node script, no generator framework — templates live inline.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [kind, rawName] = process.argv.slice(2);
if (!kind || !rawName) {
  console.error('Usage: pnpm gen domain <kebab-name> | pnpm gen feature <kebab-name> | pnpm gen component <PascalName>');
  process.exit(1);
}

const write = (path, content) => {
  if (existsSync(path)) {
    console.error(`refusing to overwrite ${path}`);
    process.exit(1);
  }
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
  console.log(`created ${path}`);
};

/**
 * The SOT header every emitted file carries (CLAUDE.md · doc 11 §8).
 * `SOT-KEYWORDS` is the grep target that lets an agent find this file without
 * reading the directory — the single biggest token saving in the method.
 */
const header = ({ what, why, sot, keywords }) =>
  `// ${what}\n// ${why}\n// SOT: ${sot}\n// SOT-KEYWORDS: ${keywords}\n`;

// Lint (PR-27) makes this a build error; emitting it means new code is born compliant.
const SERVER_ONLY = `import 'server-only';\n`;

const camel = (s) => s.replace(/-./g, (m) => m[1].toUpperCase());
const pascal = (s) => s.replace(/(^|-)./g, (m) => m.slice(-1).toUpperCase());

if (kind === 'domain') {
  const name = rawName.toLowerCase();
  const Name = pascal(name);
  const root = join('packages/app', name);
  const kw = (extra) => `${name} ${extra}`;

  // §3.1 domain anatomy — omit folders it genuinely doesn't need, never invent alternatives.
  write(
    join(root, `repository/${name}.repository.ts`),
    SERVER_ONLY +
      '\n' +
      header({
        what: `${Name} repository — the ONLY code in this domain that touches @acme/payload.`,
        why: 'Database isolation: swapping persistence must not reach past this file.',
        sot: 'docs/pack/11-architectural-guardrails.md §3',
        keywords: kw('repository payload persistence'),
      }) +
      `\nexport {};\n`,
  );

  write(
    join(root, `services/${name}.service.ts`),
    SERVER_ONLY +
      '\n' +
      header({
        what: `${Name} service — orchestration, cross-repo composition, business rules.`,
        why: 'The only caller of this domain\'s repository; every operation goes through the block.',
        sot: 'docs/pack/11-architectural-guardrails.md §3',
        keywords: kw('service orchestration protected-operation'),
      }) +
      `\n// The block: every operation is wrapped, so the gate order (session → context →\n` +
      `// relationship scope → role → permission → plan → rate limit → validation → handler)\n` +
      `// is carried by the type, not by memory. Identity comes from ctx — never from input (§4).\n` +
      `//\n` +
      `// import { protectedOperation } from '../core';\n` +
      `// import { ${camel(name)}Permissions } from '../permissions/${name}.permissions';\n` +
      `//\n` +
      `// export const list${Name} = protectedOperation({\n` +
      `//   resource: ${camel(name)}Permissions.resource,\n` +
      `//   action: 'read',\n` +
      `//   input: /* schema from schemas/${name}.schema.ts */,\n` +
      `//   handler: async ({ ctx, input }) => { /* ctx.orgId, never input.orgId */ },\n` +
      `// });\n` +
      `\nexport {};\n`,
  );

  write(
    join(root, `queries/${name}.keys.ts`),
    header({
      what: `${Name} query-key factory — single source of truth for keys.`,
      why: 'Inline queryKey arrays are a lint error; every cache entry derives from here.',
      sot: 'packages/config/eslint/base.mjs (no-restricted-syntax)',
      keywords: kw('query keys cache tanstack'),
    }) + `\nexport const ${camel(name)}Keys = {\n  all: ['${name}'] as const,\n};\n`,
  );

  write(
    join(root, `queries/${name}.queries.ts`),
    header({
      what: `${Name} read hooks — TanStack Query bound to the key factory.`,
      why: 'Client cache layer; carries service types across the boundary as type-only imports.',
      sot: 'docs/pack/11-architectural-guardrails.md §2',
      keywords: kw('queries hooks tanstack read'),
    }) + `\nexport {};\n`,
  );

  write(
    join(root, `schemas/${name}.schema.ts`),
    header({
      what: `${Name} input schemas — validation at the block boundary.`,
      why: 'Parsed inside protectedOperation, so handlers receive proven-shaped input.',
      sot: 'docs/pack/11-architectural-guardrails.md §3',
      keywords: kw('schema validation zod input'),
    }) + `\nexport {};\n`,
  );

  write(
    join(root, `types/${name}.types.ts`),
    header({
      what: `${Name} domain types.`,
      why: 'Derived, never hand-written — Payload/Better Auth generated types are the source.',
      sot: 'docs/pack/10-types-components-spec.md §2.3',
      keywords: kw('types derived generated'),
    }) + `\nexport {};\n`,
  );

  write(
    join(root, `permissions/${name}.permissions.ts`),
    header({
      what: `${Name} permission entries — uses packages/app/permissions core; no inline role checks.`,
      why: 'One registry drives the server gate, nav visibility, and upgrade copy (§5).',
      sot: 'docs/pack/11-architectural-guardrails.md §5',
      keywords: kw('permissions registry resource action'),
    }) + `\nexport {};\n`,
  );

  write(
    join(root, `hooks/use-${name}.ts`),
    header({
      what: `${Name} client hooks.`,
      why: 'Feature-facing surface; never reaches a repository or a deep path.',
      sot: 'docs/pack/11-architectural-guardrails.md §3',
      keywords: kw('hooks client'),
    }) + `\nexport {};\n`,
  );

  write(
    join(root, 'index.ts'),
    header({
      what: `${Name} public API — nothing deep-imported from outside (§3.1).`,
      why: 'The module boundary; features import this file and nothing below it.',
      sot: 'docs/pack/11-architectural-guardrails.md §3',
      keywords: kw('public api barrel index'),
    }) + `\nexport {};\n`,
  );

  console.log(`\nDomain '${name}' scaffolded. Add mutations/ components/ __tests__/ as they earn their place.`);
} else if (kind === 'feature') {
  const name = rawName.toLowerCase();
  const dir = join('packages/app/features', name);
  const Name = pascal(name);
  const impl = (fork) =>
    header({
      what: `${Name} screen — ${fork} fork.`,
      why: 'Platform forks exist so shared code never branches on Platform.OS at runtime.',
      sot: 'docs/pack/09-screens-first-build-order.md',
      keywords: `${name} screen feature ${fork.toLowerCase()}`,
    }) +
    `\nimport { View } from 'react-native';\nimport { Text } from '@acme/ui';\n\nexport function ${Name}Screen() {\n  return (\n    <View className="flex-1 items-center justify-center">\n      <Text>${Name}</Text>\n    </View>\n  );\n}\n`;
  write(join(dir, 'screen.native.tsx'), impl('Native'));
  write(join(dir, 'screen.web.tsx'), impl('Web'));
  write(
    join(dir, 'screen.tsx'),
    header({
      what: `${Name} screen — TS resolution anchor; bundlers load the .native/.web forks.`,
      why: 'A bare .ts/.tsx anchor beats .native.tsx in Metro resolution, so it must re-export.',
      sot: 'docs/pack/03-starter-tailoring.md',
      keywords: `${name} screen anchor fork resolution`,
    }) + `\nexport { ${Name}Screen } from './screen.web';\n`,
  );
  console.log(`\nExport ${Name}Screen from packages/app/index.ts and add thin route wrappers in apps/web and apps/mobile.`);
} else if (kind === 'component') {
  const name = rawName;
  if (!/^[A-Z]/.test(name)) {
    console.error('component name must be PascalCase');
    process.exit(1);
  }
  const dir = 'packages/ui';
  write(
    join(dir, `${name}.tsx`),
    header({
      what: `${name} — presentational component.`,
      why: 'Pure presentation: depends only on @acme/theme, never on a domain.',
      sot: 'docs/pack/10-types-components-spec.md',
      keywords: `${name.toLowerCase()} component ui presentational`,
    }) +
      `\nimport { View } from 'react-native';\n\nexport interface ${name}Props {\n  className?: string;\n}\n\nexport function ${name}({ className }: ${name}Props) {\n  return <View className={className} />;\n}\n`,
  );
  write(
    join(dir, `${name}.stories.tsx`),
    `import type { Meta, StoryObj } from '@storybook/react-vite';\nimport { ${name} } from './${name}';\n\nconst meta = {\n  title: 'UI/${name}',\n  component: ${name},\n} satisfies Meta<typeof ${name}>;\n\nexport default meta;\ntype Story = StoryObj<typeof meta>;\n\nexport const Default: Story = {};\n`,
  );
  console.log(`\nAdd "export { ${name} } from './${name}';" to packages/ui/index.ts — 'pnpm check:barrels' fails until you do.`);
} else {
  console.error(`unknown generator '${kind}' — use 'domain', 'feature' or 'component'`);
  process.exit(1);
}
