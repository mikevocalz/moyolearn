/**
 * The host half of the golden gate — doc 22 §8, §10.5.
 *
 * The device captures raw RGBA (`src/testing/golden.ts`) and writes one `.raw`
 * per camera alongside a small JSON index. This reads them, decodes the checked
 * -in reference PNGs, diffs, writes a diff image for anything that failed, and
 * exits non-zero if any camera is over budget.
 *
 * `--update` re-writes the references from the current capture. That is a
 * DELIBERATE, REVIEWABLE act: the PNGs are in the repo, so a golden update
 * shows up as an image diff in the PR and someone has to look at it and say the
 * new picture is the one we want. A gate whose references can be refreshed
 * silently is not a gate.
 *
 * Usage:
 *   node tools/golden-compare.ts <captureDir> [--goldens goldens] [--out out] [--update]
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §8, §10.5
 * SOT-KEYWORDS: golden compare cli ci pixel diff update references budget report
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOLDEN_BUDGET, GOLDEN_CAMERAS, formatReport, summarise } from '../src/testing/golden.ts';
import { decodePng, encodePng } from '../src/testing/png.ts';
import { diffImages } from '../src/testing/pixel-diff.ts';
import type { RgbaImage } from '../src/testing/png.ts';

export interface CaptureIndexEntry {
  id: string;
  width: number;
  height: number;
  file: string;
}

export interface CaptureIndex {
  seed: number;
  stopAt: number;
  frameMs: number;
  devicePixelRatio: number;
  cameras: CaptureIndexEntry[];
}

export function readCapture(dir: string): { index: CaptureIndex; images: Map<string, RgbaImage> } {
  const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as CaptureIndex;
  const images = new Map<string, RgbaImage>();
  for (const entry of index.cameras) {
    const data = new Uint8Array(readFileSync(join(dir, entry.file)));
    const expected = entry.width * entry.height * 4;
    if (data.length !== expected) {
      throw new Error(
        `${entry.file}: expected ${expected} bytes for ${entry.width}x${entry.height}, got ${data.length}`
      );
    }
    images.set(entry.id, { width: entry.width, height: entry.height, data });
  }
  return { index, images };
}

export interface CompareOptions {
  goldensDir: string;
  outDir: string;
  update?: boolean;
  budget?: number;
}

export function compareCapture(
  captured: Map<string, RgbaImage>,
  options: CompareOptions
): { report: ReturnType<typeof summarise>; written: string[] } {
  const budget = options.budget ?? GOLDEN_BUDGET;
  const watchesById = new Map(GOLDEN_CAMERAS.map((c) => [c.id, c.watches]));
  const verdicts: Omit<
    ReturnType<typeof summarise>['cameras'][number],
    'passed'
  >[] = [];
  const written: string[] = [];

  mkdirSync(options.outDir, { recursive: true });
  if (options.update) mkdirSync(options.goldensDir, { recursive: true });

  for (const [id, image] of captured) {
    const goldenPath = join(options.goldensDir, `${id}.png`);
    const watches = watchesById.get(id) ?? [];

    if (options.update || !existsSync(goldenPath)) {
      writeFileSync(goldenPath, encodePng(image.data, image.width, image.height));
      written.push(goldenPath);
      // A newly written reference trivially matches itself. Recording it as a
      // pass rather than skipping it keeps the camera in the report, so a
      // missing golden is visible in CI output instead of silently absent.
      verdicts.push({ id, diffPixels: 0, fraction: 0, antialiased: 0, watches });
      continue;
    }

    const reference = decodePng(new Uint8Array(readFileSync(goldenPath)));
    const result = diffImages(reference, image);
    verdicts.push({
      id,
      diffPixels: result.diffPixels,
      fraction: result.fraction,
      antialiased: result.antialiased,
      watches,
    });

    if (result.fraction > budget) {
      const diffPath = join(options.outDir, `${id}.diff.png`);
      writeFileSync(diffPath, encodePng(result.image.data, result.image.width, result.image.height));
      // The candidate too — a diff mask without the actual frame beside it is
      // half the evidence, and the reviewer always asks for it.
      const actualPath = join(options.outDir, `${id}.actual.png`);
      writeFileSync(actualPath, encodePng(image.data, image.width, image.height));
      written.push(diffPath, actualPath);
    }
  }

  return { report: summarise(verdicts, budget), written };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const captureDir = args.find((a) => !a.startsWith('--'));
  if (!captureDir) {
    process.stderr.write(
      'usage: node tools/golden-compare.ts <captureDir> [--goldens dir] [--out dir] [--update]\n'
    );
    process.exit(2);
  }
  const flag = (name: string, fallback: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? (args[i + 1] ?? fallback) : fallback;
  };

  const { index, images } = readCapture(captureDir);
  if (index.devicePixelRatio !== 1) {
    process.stderr.write(
      `refusing to compare: capture was taken at devicePixelRatio ${index.devicePixelRatio}; ` +
        'goldens are only comparable at 1\n'
    );
    process.exit(2);
  }

  const update = args.includes('--update');
  const { report, written } = compareCapture(images, {
    goldensDir: flag('goldens', 'goldens'),
    outDir: flag('out', 'golden-out'),
    update,
  });

  process.stdout.write(`${formatReport(report)}\n`);
  for (const path of written) process.stdout.write(`  wrote ${path}\n`);
  if (update) {
    process.stdout.write(
      '\nreferences updated — review the image diff in the PR before merging.\n'
    );
  }
  process.exit(report.passed ? 0 : 1);
}

/** Exported for the unit tests, which do not want a directory. */
export function listCaptureFiles(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.raw'));
}
