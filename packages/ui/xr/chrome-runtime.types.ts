/** The view-model seam shared by native Rive and deterministic command tests. */
export interface ChromeRuntime {
  getNumber(name: string): number;
  setNumber(name: string, value: number): void;
  setBoolean(name: string, value: boolean): void;
  setString(name: string, value: string): void;
  observeNumber(name: string, callback: ((value: number) => void) | undefined): void;
}
