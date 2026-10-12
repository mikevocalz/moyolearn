import type { StoreApi } from 'zustand/vanilla';

export type MoleculeId = 'h2-equilibrium' | 'h2-stretched';
export type Prediction = 'equilibrium' | 'stretched';
export type EnergyReading = {
  moleculeId: MoleculeId;
  energyHartree: number;
  method: 'Hartree-Fock/SCF';
  basis: 'sto-3g';
  computeEngine: 'Microsoft QDK/Chemistry';
  note: string;
};
export type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'failed' }
  | { kind: 'ready'; equilibrium: EnergyReading; stretched: EnergyReading };
export type ChemistryState = { prediction: Prediction | null; run: RunState };
type ActiveRequest = { current: AbortController | null };
type EnergyReader = (id: MoleculeId, signal: AbortSignal) => Promise<EnergyReading>;

/** The controller stays in the component's ref, outside application state. */
export function cancelChemistryRun(active: ActiveRequest) {
  active.current?.abort();
  active.current = null;
}

export function chooseChemistryPrediction(
  store: StoreApi<ChemistryState>, active: ActiveRequest, prediction: Prediction,
) {
  cancelChemistryRun(active);
  store.setState({ prediction, run: { kind: 'idle' } });
}

export async function calculateChemistryRun(
  store: StoreApi<ChemistryState>, active: ActiveRequest, readEnergy: EnergyReader,
) {
  if (!store.getState().prediction || active.current) return;
  const controller = new AbortController();
  active.current = controller;
  const timeout = setTimeout(() => controller.abort(), 30_000);
  store.setState({ run: { kind: 'running' } });
  try {
    const [equilibrium, stretched] = await Promise.all([
      readEnergy('h2-equilibrium', controller.signal),
      readEnergy('h2-stretched', controller.signal),
    ]);
    if (active.current !== controller) return;
    store.setState({ run: controller.signal.aborted
      ? { kind: 'failed' } : { kind: 'ready', equilibrium, stretched } });
  } catch {
    if (active.current === controller) store.setState({ run: { kind: 'failed' } });
  } finally {
    clearTimeout(timeout);
    if (active.current === controller) active.current = null;
  }
}
