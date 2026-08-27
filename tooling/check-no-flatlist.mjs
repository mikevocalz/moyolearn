#!/usr/bin/env node
// FlatList and its family are banned. LegendList is the list primitive, wrapped
// by `VirtualList` in packages/ui.
//
// This is a gate rather than a convention because the rule was already being
// followed perfectly and nothing enforced it — the count has been zero for the
// life of the repo, and the first `import { FlatList } from 'react-native'`
// anyone writes would have sailed through review, typecheck and 206 tests.
// A rule kept by everyone remembering it is a rule with one bad day in it.
//
// SectionList and VirtualizedList are the same import with a different name,
// and FlashList is the same decision made twice; all four fail here.
// SOT: CLAUDE.md §Patterns are law · packages/ui/VirtualList.tsx
// SOT-KEYWORDS: flatlist legendlist virtual list gate banned sectionlist flashlist
import { execSync } from 'node:child_process';

const BANNED = ['FlatList', 'SectionList', 'VirtualizedList', 'FlashList'];
const EXCLUDE = '--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=.expo';

/*
  This file names all four, so it would match itself. Excluding by filename
  rather than by a magic comment keeps the banned words spelled out here — a
  gate whose own rule is written in evasive spelling teaches the wrong lesson.
*/
const SELF = 'tooling/check-no-flatlist.mjs';

let failures = 0;
for (const name of BANNED) {
  let out = '';
  try {
    out = execSync(
      `grep -rnE "\\b${name}\\b" packages apps --include=*.ts --include=*.tsx ${EXCLUDE}`,
      { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    ).trim();
  } catch (error) {
    // grep exits 1 for "no match", which is the answer we want. Anything else
    // is a broken probe, and a silent one would report a clean repo forever.
    if (error.status !== 1) throw error;
  }

  const hits = out
    .split('\n')
    .filter(Boolean)
    .filter((line) => !line.startsWith(SELF));

  for (const hit of hits) {
    failures++;
    console.error(`  ${name} — ${hit}`);
  }
}

if (failures) {
  console.error(
    `\n${failures} banned list usage(s). Use \`VirtualList\` from @acme/ui — it is ` +
      'LegendList on native and @tanstack/react-virtual on web. Do not import ' +
      'a list from react-native.',
  );
  process.exit(1);
}
console.log(`lists OK — no ${BANNED.join('/')} anywhere; LegendList is the primitive`);
