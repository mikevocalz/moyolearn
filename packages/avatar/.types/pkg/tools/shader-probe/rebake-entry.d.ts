export interface RebakePair {
    id: string;
    /** The frame from the 34.9 MB authoring container. */
    authoring: string | null;
    /** The frame from the 1.93 MB rebaked container. */
    rebaked: string | null;
    error: string | null;
}
export declare function runRebakeAB(host: HTMLElement, base: string): Promise<RebakePair[]>;
declare global {
    interface Window {
        __runRebakeAB: (host: HTMLElement, base: string) => Promise<RebakePair[]>;
    }
}
