#!/usr/bin/env node
// Font fallbacks must not move text when the web font arrives.
//
// apps/web-vite/src/fonts.css shadows each self-hosted face with a `* Fallback`
// face (a local Arial carrying size-adjust and ascent/descent/line-gap
// overrides), so the `font-display: swap` causes no reflow. This gate renders
// the site's own copy in a real browser three ways at five column widths: the
// real face, and Arial under the fallback's overrides. It fails when the
// fallback breaks a different number of lines or changes the block's height by
// more than one pixel, which is the layout shift a reader would see on swap.
//
// Arial is stood in for by Arimo (tooling/web-designer-pro/assets/fonts), its
// metric-identical open twin, so the answer is the same on a Mac and on the
// Ubuntu CI runner, which has no Arial.
//
// SOT: apps/web-vite/src/fonts.css · docs/site/tokens.md §5.2 ·
//      tooling/web-designer-pro/scripts/fallback.mjs
// SOT-KEYWORDS: font fallback cls size-adjust ascent-override swap layout shift
//               general-sans clash-display web-vite gate
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './web-designer-pro/scripts/lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = path.join(ROOT, 'apps/web-vite/src/fonts.css');
const PUBLIC = path.join(ROOT, 'apps/web-vite/public');
const ARIMO = path.join(ROOT, 'tooling/web-designer-pro/assets/fonts/arimo-400-latin.woff2');

// Where each face is used on the site (tokens.ts `siteFontFamilies`, site ramp):
// Clash Display sets the hero and chapter titles, General Sans the reading text.
const ROLES = {
  'Clash Display': { size: 64, weight: 600, text: 'Learning has a heart. Moyo coaches your child through the work instead of doing it for them.' },
  'General Sans': {
    size: 17,
    weight: 400,
    text:
      'Moyo coaches your child through the work instead of doing it for them. Point the camera at the homework and ' +
      'Natalie teaches the next step, at your child’s grade level, in one familiar voice, with every session ' +
      'written up for you. One plan. Every child in your family.',
  },
};
const WIDTHS = [320, 420, 520, 640, 760];

/** The `@font-face` blocks, as { family: { src?, size-adjust?, … } }. */
export function parseFaces(css) {
  const faces = {};
  for (const [, body] of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
    const decl = Object.fromEntries(
      [...body.matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]),
    );
    const family = decl['font-family']?.replace(/['"]/g, '');
    if (family) faces[family] = decl;
  }
  return faces;
}

async function main() {
  const faces = parseFaces(fs.readFileSync(CSS, 'utf8'));
  const arimo = fs.readFileSync(ARIMO).toString('base64');
  const { browser } = await launch('chromium');
  const page = await browser.newPage();
  let failures = 0;
  let checked = 0;
  for (const [family, role] of Object.entries(ROLES)) {
    const real = faces[family];
    const fallback = faces[`${family} Fallback`];
    if (!real || !fallback) {
      console.error(`  ${family}: missing its @font-face or its Fallback face in fonts.css`);
      failures += 1;
      continue;
    }
    const url = /url\(['"]?([^'")]+)['"]?\)/.exec(real.src)?.[1];
    const file = fs.readFileSync(path.join(PUBLIC, url)).toString('base64');
    const overrides = ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']
      .filter((key) => fallback[key])
      .map((key) => `${key}:${fallback[key]}`)
      .join(';');
    for (const width of WIDTHS) {
      await page.setContent(
        `<style>
          @font-face{font-family:Real;src:url(data:font/woff2;base64,${file})}
          @font-face{font-family:Fallback;src:url(data:font/woff2;base64,${arimo});${overrides}}
          div{width:${width}px;font-size:${role.size}px;font-weight:${role.weight};line-height:normal}
        </style><div id="real" style="font-family:Real">${role.text}</div><div id="fallback" style="font-family:Fallback">${role.text}</div>`,
      );
      await page.evaluate(() => document.fonts.ready);
      const [a, b] = await page.evaluate(() =>
        ['real', 'fallback'].map((id) => {
          const node = document.getElementById(id);
          const range = document.createRange();
          range.selectNodeContents(node);
          const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
          return { height: node.getBoundingClientRect().height, lines };
        }),
      );
      checked += 1;
      if (a.lines !== b.lines || Math.abs(a.height - b.height) > 1) {
        failures += 1;
        console.error(
          `  ${family} at ${width}px: real ${a.lines} lines / ${a.height}px, fallback ${b.lines} lines / ${b.height}px`,
        );
      }
    }
  }
  await browser.close();
  if (failures) {
    console.error(
      `\n${failures} fallback mismatch(es): the swap to the web font would move text. Remeasure with ` +
        '`node tooling/web-designer-pro/scripts/fallback.mjs <font.woff2>` and update fonts.css and docs/site/tokens.md §5.2.',
    );
    process.exit(1);
  }
  console.log(`font fallbacks OK — ${checked} renders, same lines and height (±1px) as the real faces`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
