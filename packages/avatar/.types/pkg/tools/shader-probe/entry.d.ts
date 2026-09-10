export interface ProbeResult {
    id: string;
    compiled: boolean;
    error: string | null;
    /** `console.error` text emitted while THIS case rendered. See the header. */
    consoleErrors: string[];
    /** Dawn's uncaptured validation/internal errors for this case. WebGPU only. */
    deviceErrors: string[];
    /** Mean luminance of the rendered patch, 0-255. Catches an all-black draw. */
    meanLuma: number;
    /** Distinct 8-bit luminance values. 1 means a flat fill — i.e. nothing shaded. */
    distinctLuma: number;
    /** The rendered patch as a data URL, so a person can look at it. */
    png: string | null;
    /**
     * `webgpu` or `webgl2`, read off the backend three actually built — NOT off
     * the flag that asked for it. `WebGPURenderer` falls back to WebGL when the
     * adapter request fails, and a WebGPU run that quietly became a WebGL run
     * would report ten green cases having proven nothing new.
     */
    backendId: string;
    /** `wgsl` or `glsl`, sniffed from the emitted source. The same guard again. */
    shaderLanguage: string;
    /** The emitted fragment source. `run.mjs` writes it next to the images. */
    fragmentShader: string | null;
}
export declare function runProbe(canvas: HTMLCanvasElement): Promise<ProbeResult[]>;
declare global {
    interface Window {
        __runProbe: (canvas: HTMLCanvasElement) => Promise<ProbeResult[]>;
    }
}
