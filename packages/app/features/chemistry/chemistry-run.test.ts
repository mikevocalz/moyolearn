import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from 'zustand/vanilla';
import {
  calculateChemistryRun, chooseChemistryPrediction,
  type ChemistryState, type EnergyReading, type MoleculeId,
} from './chemistry-run.ts';

function harness() {
  const store = createStore<ChemistryState>(() => ({ prediction: 'equilibrium', run: { kind: 'idle' } }));
  const active: { current: AbortController | null } = { current: null };
  const requests: {
    signal: AbortSignal; resolve: (reading: EnergyReading) => void; reject: (error: Error) => void;
  }[] = [];
  const read = (_id: MoleculeId, signal: AbortSignal) => new Promise<EnergyReading>((resolve, reject) => {
    requests.push({ signal, resolve, reject });
  });
  const finish = (offset: number) => {
    for (const [i, moleculeId] of (['h2-equilibrium', 'h2-stretched'] as const).entries()) {
      requests[offset + i]!.resolve({
        moleculeId, energyHartree: -1.1,
        method: 'Hartree-Fock/SCF', basis: 'sto-3g', computeEngine: 'Microsoft QDK/Chemistry', note: 'test fixture',
      });
    }
  };
  return { store, active, requests, read, finish };
}

test('late results cannot reappear after changing a prediction, even when it changes back', async () => {
  const h = harness();
  const first = calculateChemistryRun(h.store, h.active, h.read);
  chooseChemistryPrediction(h.store, h.active, 'stretched');
  assert.equal(h.requests[0]!.signal.aborted, true);
  chooseChemistryPrediction(h.store, h.active, 'equilibrium');
  const next = calculateChemistryRun(h.store, h.active, h.read);
  h.finish(0);
  await first;
  assert.equal(h.store.getState().run.kind, 'running');
  h.finish(2);
  await next;
  assert.equal(h.store.getState().run.kind, 'ready');
});

test('a stale failure cannot replace the result of a newer calculation', async () => {
  const h = harness();
  const first = calculateChemistryRun(h.store, h.active, h.read);
  chooseChemistryPrediction(h.store, h.active, 'stretched');
  const next = calculateChemistryRun(h.store, h.active, h.read);
  h.finish(2);
  await next;
  h.requests[0]!.reject(new Error('old request failed'));
  await first;
  assert.equal(h.store.getState().run.kind, 'ready');
  assert.equal(h.store.getState().prediction, 'stretched');
});

test('repeated presses during the same run do not submit duplicate calculations', async () => {
  const h = harness();
  const first = calculateChemistryRun(h.store, h.active, h.read);
  await calculateChemistryRun(h.store, h.active, h.read);
  assert.equal(h.requests.length, 2);
  h.finish(0);
  await first;
  assert.equal(h.active.current, null);
});
