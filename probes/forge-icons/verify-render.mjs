import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { getGlyph, iconStroke } from '@nitro-forge/icons';
import { GLYPHS, SOURCE_COMMIT } from './generate.mjs';

const project = dirname(fileURLToPath(import.meta.url));
const build = join(project, 'build');
mkdirSync(build, { recursive: true });
execFileSync(process.execPath, ['--test', join(project, 'svg-path.test.mjs')], { stdio: 'pipe' });
const result = { sourceCommit: SOURCE_COMMIT, riveCli: execFileSync('rive', ['--version'], { encoding: 'utf8' }).trim(),
  renderer: 'Rive CLI headless at 240x240; reference: sharp SVG renderer',
  nativeRuntime: 'NOT RUN', sourceTests: 'PASS 5/5 node --test probes/forge-icons/svg-path.test.mjs', comparisons: [] };

async function reference(name, variant, path, color = '#18202D', surface = '#FFFFFF') {
  const paths = getGlyph(name, variant).map(([d, mode]) => {
    const fill = mode === 'fill' || (mode === 'knockout' && /[zZ]\s*$/.test(d));
    const ink = mode === 'knockout' ? surface : color;
    return `<path d="${d}" stroke="${fill ? 'none' : ink}" fill="${fill ? ink : 'none'}" stroke-width="${iconStroke.width}" stroke-linecap="round" stroke-linejoin="round" fill-rule="evenodd"/>`;
  }).join('');
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 24 24">${paths}</svg>`))
    .flatten({ background: '#1D1D1D' }).png().toFile(path);
}

function capture(name, filename, data = [], advance = 20) {
  const path = join(build, filename);
  execFileSync('rive', [project, `--artboard=Forge${name[0].toUpperCase()}${name.slice(1)}`,
    `--screenshot=${path}`, '--viewport=240x240', '--fit=contain',
    ...data.map((value) => `--data=${value}`), `--advance=${advance}`], { stdio: 'pipe' });
  return path;
}

async function compare(actual, expected) {
  const a = await sharp(actual).removeAlpha().raw().toBuffer();
  const b = await sharp(expected).removeAlpha().raw().toBuffer();
  assert.equal(a.length, b.length);
  let total = 0, beyond16 = 0;
  for (let index = 0; index < a.length; index += 1) {
    const difference = Math.abs(a[index] - b[index]);
    total += difference;
    if (difference > 16) beyond16 += 1;
  }
  return { meanAbsoluteChannelError: Number((total / a.length).toFixed(6)),
    channelFractionBeyond16: Number((beyond16 / a.length).toFixed(6)) };
}

for (const name of GLYPHS) for (const variant of ['outline', 'filled']) {
  const actual = capture(name, `${name}-${variant}.png`, [`selected=${variant === 'filled'}`]);
  const expected = join(build, `${name}-${variant}-svg.png`);
  await reference(name, variant, expected);
  const metrics = await compare(actual, expected);
  assert.ok(metrics.meanAbsoluteChannelError < 1, `${name}/${variant}: SVG geometry differs`);
  assert.ok(metrics.channelFractionBeyond16 < 0.02, `${name}/${variant}: SVG detail differs`);
  result.comparisons.push({ glyph: name, variant, ...metrics });
}

const transition = capture('pen', 'pen-transition.png', ['selected=true'], 2);
const final = join(build, 'pen-filled.png');
const intermediate = await compare(transition, final);
assert.ok(intermediate.meanAbsoluteChannelError > 0.5, 'Normal selection did not produce an intermediate blend');
result.selectionBlendAt33ms = intermediate;
const reduced = capture('pen', 'pen-reduced-theme.png', ['selected=true', 'reducedMotion=true', 'color=FF4263EB', 'surfaceColor=FF1D1D1D'], 2);
const themed = join(build, 'pen-themed-svg.png');
await reference('pen', 'filled', themed, '#4263EB', '#1D1D1D');
result.reducedMotionThemeAt33ms = await compare(reduced, themed);
assert.ok(result.reducedMotionThemeAt33ms.meanAbsoluteChannelError < 1, 'Reduced motion or theme binding did not take effect');

const inspection = JSON.parse(execFileSync('rive', ['inspect', project, '--summary'], { encoding: 'utf8' }));
assert.deepEqual(inspection.problems, [], 'Rive inspect found wiring problems');
assert.equal(inspection.artboards.length, GLYPHS.length);
result.artboards = inspection.artboards.map(({ name, objects }) => ({ name, objects }));
const asset = readFileSync(join(build, 'moyo_forge_icons.riv'));
result.asset = { bytes: asset.length, sha256: createHash('sha256').update(asset).digest('hex'),
  signing: 'unsigned --once; script-free vector file, nothing requires script signing' };
writeFileSync(join(build, 'render-evidence.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
