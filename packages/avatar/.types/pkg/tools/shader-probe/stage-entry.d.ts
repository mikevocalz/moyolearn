export interface StageProbeResult {
    tier: string;
    built: boolean;
    rendered: boolean;
    error: string | null;
    meanLuma: number;
    distinctLuma: number;
    drawCalls: number;
    png: string | null;
}
/** Where the fixture's ground sits — a standing height below the sphere "head". */
export declare const PROBE_GROUND_Y = 1.36;
export declare function runStageProbe(host: HTMLElement): Promise<StageProbeResult[]>;
declare global {
    interface Window {
        __runStageProbe: (host: HTMLElement) => Promise<StageProbeResult[]>;
    }
}
