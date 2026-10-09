'use client';
// An age-appropriate bridge from a student's bond-length hypothesis to a real
// QDK/Chemistry electronic-structure calculation. Shared by Expo and Next.js.
// Calculation is explicitly classical; there is no claim of quantum-hardware access.
// SOT: docs/compute/qdk-chemistry.md
// SOT-KEYWORDS: chemistry lab quantum qdk molecule hydrogen scf electron bond prediction

import { useState } from 'react';
import { Button, Card, Container, FadeIn, Heading, PressScale, Text } from '@acme/ui';
import { ScrollView, Section, View, Text as TWText } from '@acme/ui/tw';
import { useAppSession } from '../../providers/session';
import { API_URL } from '../../core/api-url';
import { useIsOnline } from '../../core/use-is-online';

type MoleculeId = 'h2-equilibrium' | 'h2-stretched';
type Prediction = 'equilibrium' | 'stretched';
type EnergyReading = {
  moleculeId: MoleculeId;
  energyHartree: number;
  method: 'Hartree-Fock/SCF';
  basis: 'sto-3g';
  computeEngine: 'Microsoft QDK/Chemistry';
  note: string;
};
type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'failed' }
  | { kind: 'ready'; equilibrium: EnergyReading; stretched: EnergyReading };

const MOLECULES = [
  { id: 'h2-equilibrium', title: 'A · Closer hydrogen atoms', distance: '0.74 Å' },
  { id: 'h2-stretched', title: 'B · Farther hydrogen atoms', distance: '1.50 Å' },
] as const;

async function readEnergy(moleculeId: MoleculeId): Promise<EnergyReading> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
  const response = await fetch(`${API_URL}/api/chemistry/energy`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moleculeId }),
    signal: controller.signal,
  });
  if (!response.ok) throw new Error('Unable to run the chemistry calculation');
  const result = (await response.json()) as EnergyReading;
  if (
    result.moleculeId !== moleculeId ||
    result.method !== 'Hartree-Fock/SCF' ||
    result.basis !== 'sto-3g' ||
    result.computeEngine !== 'Microsoft QDK/Chemistry' ||
    !Number.isFinite(result.energyHartree)
  ) {
    throw new Error('Invalid chemistry result');
  }
  return result;
  } finally {
    clearTimeout(timeout);
  }
}

export function ChemistryLabScreen() {
  const { activeContext, status } = useAppSession();
  const online = useIsOnline();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [run, setRun] = useState<RunState>({ kind: 'idle' });
  const ageBand = activeContext.gradeBand;

  const calculate = async () => {
    if (!prediction || !online || run.kind === 'running') return;
    setRun({ kind: 'running' });
    try {
      const [equilibrium, stretched] = await Promise.all([
        readEnergy('h2-equilibrium'),
        readEnergy('h2-stretched'),
      ]);
      setRun({ kind: 'ready', equilibrium, stretched });
    } catch {
      setRun({ kind: 'failed' });
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="gap-group py-6 pb-48">
          {status === 'loading' ? (
            <Text tone="muted">Opening chemistry lab…</Text>
          ) : ageBand !== 'teen' && ageBand !== 'adult' ? (
            <Section className="gap-stack">
              <Heading level={1} size="title">Chemistry Lab</Heading>
              <Text tone="muted">This molecular computing activity is for advanced learners.</Text>
            </Section>
          ) : (
            <ChemistryExperiment
              online={online}
              prediction={prediction}
              onPredict={(choice) => {
                setPrediction(choice);
                setRun({ kind: 'idle' });
              }}
              run={run}
              onCalculate={calculate}
            />
          )}
        </Container>
      </ScrollView>
    </View>
  );
}

function ChemistryExperiment({
  online,
  prediction,
  onPredict,
  run,
  onCalculate,
}: {
  online: boolean;
  prediction: Prediction | null;
  onPredict: (choice: Prediction) => void;
  run: RunState;
  onCalculate: () => void;
}) {
  return (
    <View className="gap-group">
      <FadeIn>
        <Section className="gap-element">
          <Text variant="label" tone="muted">CHEMISTRY · MOLECULAR STRUCTURE</Text>
          <Heading level={1} size="display-sm">Why does bond length matter?</Heading>
          <Text tone="muted">
            Hydrogen has two atoms and two electrons. Explore how their separation
            changes a calculated electronic energy.
          </Text>
        </Section>
      </FadeIn>

      <Section className="gap-stack">
        <Heading level={2} size="title">1. Look at the two structures</Heading>
        <View className="flex-row flex-wrap gap-stack">
          {MOLECULES.map((molecule) => (
            <Card key={molecule.id} className="flex-1 basis-[42%] gap-element">
              <Text variant="label" tone="muted">{molecule.title}</Text>
              <View className="items-center justify-center rounded-card bg-surface-sunken p-6">
                <TWText className="font-display text-xl font-bold text-text">
                  {molecule.id === 'h2-equilibrium' ? 'H — H' : 'H ——— H'}
                </TWText>
              </View>
              <Text variant="caption" tone="muted">
                H–H distance: {molecule.distance}
              </Text>
            </Card>
          ))}
        </View>
      </Section>

      <Section className="gap-stack">
        <Heading level={2} size="title">2. Make a prediction</Heading>
        <Text>Which arrangement do you think will have the lower electronic energy?</Text>
        <View className="gap-element">
          <PressScale
            className={`rounded-card border-2 border-border p-4 ${prediction === 'equilibrium' ? 'bg-primary' : 'bg-surface-raised'}`}
            aria-label="Predict that the closer hydrogen atoms have lower energy"
            aria-selected={prediction === 'equilibrium'}
            onPress={() => onPredict('equilibrium')}
          >
            <TWText className={prediction === 'equilibrium' ? 'font-semibold text-on-primary' : 'text-text'}>
              A · The closer pair
            </TWText>
          </PressScale>
          <PressScale
            className={`rounded-card border-2 border-border p-4 ${prediction === 'stretched' ? 'bg-primary' : 'bg-surface-raised'}`}
            aria-label="Predict that the farther hydrogen atoms have lower energy"
            aria-selected={prediction === 'stretched'}
            onPress={() => onPredict('stretched')}
          >
            <TWText className={prediction === 'stretched' ? 'font-semibold text-on-primary' : 'text-text'}>
              B · The farther pair
            </TWText>
          </PressScale>
        </View>
        <Button
          variant="primary"
          title={run.kind === 'running' ? 'Calculating electronic energies…' : 'Test my prediction with QDK'}
          disabled={!online || !prediction || run.kind === 'running'}
          onPress={() => { void onCalculate(); }}
        />
        {!online ? (
          <Text tone="muted">You are offline. You can still make your prediction; calculations need a connection.</Text>
        ) : null}
      </Section>

      {run.kind === 'failed' ? (
        <Card className="gap-element">
          <Heading level={3} size="title">The calculation is unavailable</Heading>
          <Text tone="muted">
            Your prediction is still here. Try again when the chemistry service is ready.
          </Text>
          <Button title="Try calculation again" variant="outline" onPress={() => { void onCalculate(); }} />
        </Card>
      ) : null}

      {run.kind === 'ready' ? (
        <FadeIn>
          <Section className="gap-stack">
            <Heading level={2} size="title">3. Examine the evidence</Heading>
            <Card className="gap-stack">
              <Text variant="label" tone="muted">QDK/Chemistry · Hartree–Fock · STO-3G</Text>
              <TWText className="text-base font-semibold text-text">
                A · {run.equilibrium.energyHartree.toFixed(6)} Hartree
              </TWText>
              <TWText className="text-base font-semibold text-text">
                B · {run.stretched.energyHartree.toFixed(6)} Hartree
              </TWText>
              <Text tone="muted">
                These are calculated values for the same molecule using the same approximation.
                They are not experimental measurements or quantum-computer results.
              </Text>
            </Card>
            <Heading level={3} size="title">What do you notice?</Heading>
            <Text>
              Compare the two negative energy values. Which is lower, and how might
              attraction between electrons and nuclei help explain the difference?
              What happens if you bring the atoms even closer?
            </Text>
            <Text variant="caption" tone="muted">
              Your prediction was {prediction === 'equilibrium' ? 'the closer pair' : 'the farther pair'}.
              Explain your reasoning before asking Natalie for the next hint.
            </Text>
          </Section>
        </FadeIn>
      ) : null}
    </View>
  );
}
