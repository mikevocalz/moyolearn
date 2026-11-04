/**
 * Query parameters of the device-validation probe route
 * (`moyo://device-validation-probe`), parsed in one place so the scene and the
 * device scripts agree on the vocabulary.
 *
 *   workload  video | panel | multi        (R1.2 | R1.3 | R1.5), default video
 *   count     1 | 2 | 4                    surfaces for `multi`, default 1
 *   nativeBoard, nativeRive   1 | 0        Round 2 switches, default 0
 *
 * Unknown or malformed values fall back to the default rather than throwing:
 * the route is opened by `adb shell am start -d <url>`, and a typo there should
 * still show a scene whose header names what was actually chosen.
 *
 * SOT: apps/mobile/app/device-validation-probe.tsx
 * SOT-KEYWORDS: device validation probe params workload count native board rive flags
 */

/** Which Round 1 workload the probe draws. */
export type ValidationWorkload = 'video' | 'panel' | 'multi';

/** How many simultaneous video surfaces the `multi` workload draws. */
export type ValidationSurfaceCount = 1 | 2 | 4;

/** The parsed probe request. */
export interface ValidationProbeRequest {
  workload: ValidationWorkload;
  count: ValidationSurfaceCount;
  /** Round 2: draw the tutor board with the native renderer when it is linked. */
  nativeBoard: boolean;
  /** Round 2: draw the board's Rive chrome with ViroCore's native Rive producer when it is linked. */
  nativeRive: boolean;
}

const WORKLOADS: readonly ValidationWorkload[] = ['video', 'panel', 'multi'];
const COUNTS: readonly ValidationSurfaceCount[] = [1, 2, 4];

/** The minimal reader both `URLSearchParams` and a test double satisfy. */
export interface ParamReader {
  get(name: string): string | null;
}

function flag(value: string | null): boolean {
  return value === '1' || value === 'true';
}

/** Parses the route's query; `undefined` (no route params) gives the defaults. */
export function parseValidationProbeRequest(params: ParamReader | undefined): ValidationProbeRequest {
  const workloadRaw = params?.get('workload') ?? null;
  const countRaw = Number(params?.get('count') ?? Number.NaN);
  return {
    workload: WORKLOADS.find((w) => w === workloadRaw) ?? 'video',
    count: COUNTS.find((c) => c === countRaw) ?? 1,
    nativeBoard: flag(params?.get('nativeBoard') ?? null),
    nativeRive: flag(params?.get('nativeRive') ?? null),
  };
}

/**
 * Where each video surface sits, in metres, for `count` surfaces facing the
 * viewer at `distanceM`. One surface is centred; two sit side by side; four
 * form a 2×2 grid. Every surface keeps the clip's 16:9 aspect at `widthM`.
 */
export function videoSurfaceLayout(
  count: ValidationSurfaceCount,
  widthM: number,
  distanceM: number,
  eyeHeightM: number,
): { position: [number, number, number]; width: number; height: number }[] {
  const height = (widthM * 9) / 16;
  const gap = 0.05;
  const columns = count === 1 ? 1 : 2;
  const rows = count === 4 ? 2 : 1;
  const cells: { position: [number, number, number]; width: number; height: number }[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      const x = (c - (columns - 1) / 2) * (widthM + gap);
      const y = eyeHeightM - (r - (rows - 1) / 2) * (height + gap);
      cells.push({ position: [x, y, -distanceM], width: widthM, height });
    }
  }
  return cells;
}
