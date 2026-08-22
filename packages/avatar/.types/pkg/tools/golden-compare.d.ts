import { summarise } from '../src/testing/golden.ts';
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
export declare function readCapture(dir: string): {
    index: CaptureIndex;
    images: Map<string, RgbaImage>;
};
export interface CompareOptions {
    goldensDir: string;
    outDir: string;
    update?: boolean;
    budget?: number;
}
export declare function compareCapture(captured: Map<string, RgbaImage>, options: CompareOptions): {
    report: ReturnType<typeof summarise>;
    written: string[];
};
/** Exported for the unit tests, which do not want a directory. */
export declare function listCaptureFiles(dir: string): string[];
