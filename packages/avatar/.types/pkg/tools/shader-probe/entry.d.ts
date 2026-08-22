export interface ProbeResult {
    id: string;
    compiled: boolean;
    error: string | null;
    /** Mean luminance of the rendered patch, 0-255. Catches an all-black draw. */
    meanLuma: number;
    /** Distinct 8-bit luminance values. 1 means a flat fill — i.e. nothing shaded. */
    distinctLuma: number;
    /** The rendered patch as a data URL, so a person can look at it. */
    png: string | null;
}
export declare function runProbe(canvas: HTMLCanvasElement): Promise<ProbeResult[]>;
declare global {
    interface Window {
        __runProbe: (canvas: HTMLCanvasElement) => Promise<ProbeResult[]>;
    }
}
