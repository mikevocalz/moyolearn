'use client';
// Active, prediction-led science experiences: the engine provides observations,
// while the student must supply the explanation. No LLM bypass or false simulations.
// SOT: docs/compute/moyo-science-lab.md
// SOT-KEYWORDS: science experiments chemistry atoms balance biology genetics photosynthesis physics acceleration daylight

import { useState } from 'react';
import { Button, Card, Heading, PressScale, Text } from '@acme/ui';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import type { AgeBand } from '../capture/age-band';
import { bandScaleFor } from '../capture/age-band';
import {
  approximateDaylightHours,
  isWaterMolecule,
  motionAtTime,
  offspringProbabilities,
  photosynthesisReady,
  reactionCounts,
  REACTIONS,
  type Coefficients,
  type Genotype,
  type ReactionId,
} from './science.models';

const GENOTYPES: readonly Genotype[] = ['AA', 'Aa', 'aa'];

function ChoiceRow<T extends string | number>({
  label, options, selected, choose,
}: {
  label: string;
  options: readonly T[];
  selected: T;
  choose: (value: T) => void;
}) {
  return (
    <View className="gap-element">
      <Text variant="label" tone="muted">{label}</Text>
      <View className="flex-row flex-wrap gap-element">
        {options.map((option) => (
          <PressScale
            key={String(option)}
            className={`min-h-target-teen rounded-control border-2 border-border px-4 py-3 ${selected === option ? 'bg-primary shadow-card' : 'bg-surface-raised'}`}
            aria-label={`${label}: ${option}`}
            aria-selected={selected === option}
            onPress={() => choose(option)}
          >
            <TWText className={selected === option ? 'font-semibold text-on-primary' : 'text-text'}>{String(option)}</TWText>
          </PressScale>
        ))}
      </View>
    </View>
  );
}

function Observation({ heading, message }: { heading: string; message: string }) {
  return (
    <Card className="gap-element">
      <Heading level={3} size="title">{heading}</Heading>
      <Text>{message}</Text>
    </Card>
  );
}

function WaterBuilder({ ageBand }: { ageBand: AgeBand }) {
  const [h, setH] = useState(1);
  const [o, setO] = useState(1);
  const [checked, setChecked] = useState(false);
  const scale = bandScaleFor(ageBand);

  const update = (element: 'H' | 'O', change: number) => {
    if (element === 'H') setH((value) => Math.max(0, Math.min(4, value + change)));
    else setO((value) => Math.max(0, Math.min(4, value + change)));
    setChecked(false);
  };
  return (
    <View className="gap-stack">
      <Heading level={2} size="title">Build a water molecule</Heading>
      <Text>Water is made from hydrogen and oxygen. Choose how many of each atom belongs in one molecule.</Text>
      <Card className="gap-stack">
        <View className="flex-row flex-wrap gap-element">
          {Array.from({ length: h }, (_, i) => (
            <View key={`h${i}`} className="rounded-full bg-surface-sunken p-4">
              <TWText className="font-semibold text-text">H</TWText>
            </View>
          ))}
          {Array.from({ length: o }, (_, i) => (
            <View key={`o${i}`} className="rounded-full bg-primary p-4">
              <TWText className="font-semibold text-on-primary">O</TWText>
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap gap-stack">
          <View className="gap-element">
            <Text variant="label">Hydrogen atoms: {h}</Text>
            <View className="flex-row gap-element">
              <Button variant="outline" title="− Hydrogen" disabled={h === 0} onPress={() => update('H', -1)} />
              <Button variant="outline" title="+ Hydrogen" disabled={h === 4} onPress={() => update('H', 1)} />
            </View>
          </View>
          <View className="gap-element">
            <Text variant="label">Oxygen atoms: {o}</Text>
            <View className="flex-row gap-element">
              <Button variant="outline" title="− Oxygen" disabled={o === 0} onPress={() => update('O', -1)} />
              <Button variant="outline" title="+ Oxygen" disabled={o === 4} onPress={() => update('O', 1)} />
            </View>
          </View>
        </View>
      </Card>
      <Button variant="primary" size={ageBand === 'young' ? 'xl' : 'lg'} title="Check my molecule" onPress={() => setChecked(true)} />
      {checked ? (
        <Observation
          heading={isWaterMolecule(h, o) ? 'Your model matches water!' : 'Look at your model again'}
          message={isWaterMolecule(h, o)
            ? 'You built one water molecule. What does each letter represent?'
            : 'Try looking at the small numbers in a chemical formula. Does the number tell you atoms or molecules?'}
        />
      ) : null}
      <TWText className={`text-text-muted ${scale.lead}`}>A model helps us count atoms. It is not a picture of their actual size.</TWText>
    </View>
  );
}

function BalanceReaction() {
  const [reaction, setReaction] = useState<ReactionId>('water');
  const [coefficients, setCoefficients] = useState<Coefficients>([1, 1, 1]);
  const [checked, setChecked] = useState(false);
  const [hint, setHint] = useState(false);
  const data = REACTIONS[reaction];
  const counts = reactionCounts(reaction, coefficients);
  const atoms = Object.keys(counts.reactants);

  const changeCoefficient = (index: number, amount: number) => {
    setCoefficients((old) => old.map((value, i) => i === index ? Math.max(1, Math.min(6, value + amount)) : value) as unknown as Coefficients);
    setChecked(false);
  };

  const changeReaction = (value: ReactionId) => {
    setReaction(value);
    setCoefficients([1, 1, 1]);
    setChecked(false);
    setHint(false);
  };

  return (
    <View className="gap-stack">
      <Heading level={2} size="title">Conservation of atoms</Heading>
      <Text>Balance a chemical reaction without changing any subscripts. Make the atom counts equal on both sides.</Text>
      <ChoiceRow label="Choose a reaction" options={['water', 'ammonia'] as const} selected={reaction} choose={changeReaction} />
      <Card className="gap-stack">
        <TWText className="font-display text-lg font-bold text-text">
          {coefficients[0]} {data.reactants[0]} + {coefficients[1]} {data.reactants[1]} → {coefficients[2]} {data.product}
        </TWText>
        <Text tone="muted">Adjust each big number (coefficient):</Text>
        {data.species.map((_compound, index) => (
          <View key={index} className="flex-row items-center justify-between gap-element">
            <TWText className="font-semibold text-text">
              {index < 2 ? data.reactants[index] : data.product}: {coefficients[index]}
            </TWText>
            <View className="flex-row gap-element">
              <Button title="−" variant="outline" size="sm" disabled={coefficients[index] === 1} onPress={() => changeCoefficient(index, -1)} />
              <Button title="+" variant="outline" size="sm" disabled={coefficients[index] === 6} onPress={() => changeCoefficient(index, 1)} />
            </View>
          </View>
        ))}
      </Card>
      <Card className="gap-element">
        <Text variant="label" tone="muted">OBSERVATION · ATOMS COUNTED</Text>
        {atoms.map((atom) => (
          <View key={atom} className="flex-row items-center justify-between">
            <Text>{atom} atoms</Text>
            <TWText className="font-semibold text-text">
              Left {counts.reactants[atom]} · Right {counts.products[atom]}
            </TWText>
          </View>
        ))}
      </Card>
      <View className="flex-row flex-wrap gap-element">
        <Button variant="primary" title="Check conservation" onPress={() => setChecked(true)} />
        <Button variant="outline" title={hint ? 'Hide hint' : 'Give me a hint'} onPress={() => setHint((v) => !v)} />
      </View>
      {hint ? (
        <Text tone="muted">Focus on one element first. Which side has fewer of those atoms? Change a coefficient and count again.</Text>
      ) : null}
      {checked ? (
        <Observation
          heading={counts.balanced ? 'Both sides conserve atoms' : 'Not balanced yet'}
          message={counts.balanced
            ? 'Both sides contain the same number of every element. What did you change, and why?'
            : 'At least one element has a different count on the two sides. Find it in the observation table and revise a coefficient.'}
        />
      ) : null}
    </View>
  );
}

export function ChemistryExperiment({ ageBand }: { ageBand: AgeBand }) {
  return ageBand === 'young' || ageBand === 'child'
    ? <WaterBuilder ageBand={ageBand} />
    : <BalanceReaction />;
}

function PhotosynthesisExplorer({ ageBand }: { ageBand: AgeBand }) {
  const [light, setLight] = useState(false);
  const [water, setWater] = useState(true);
  const [carbonDioxide, setCarbonDioxide] = useState(true);
  const [ran, setRan] = useState(false);
  const ready = photosynthesisReady(light, water, carbonDioxide);
  const change = (set: (value: boolean) => void, value: boolean) => {
    set(!value); setRan(false);
  };
  return (
    <View className="gap-stack">
      <Heading level={2} size="title">What does a plant need?</Heading>
      <Text>Try giving a green plant light, water, and carbon dioxide. Predict what happens when something is missing.</Text>
      <Card className="gap-stack">
        <TWText className="text-xl text-text">🌱</TWText>
        <ChoiceRow label="Sunlight" options={['Off', 'On'] as const} selected={light ? 'On' : 'Off'} choose={(v) => change(setLight, light)} />
        <ChoiceRow label="Water" options={['Off', 'On'] as const} selected={water ? 'On' : 'Off'} choose={(v) => change(setWater, water)} />
        {ageBand !== 'young' ? (
          <ChoiceRow label="Carbon dioxide (CO₂)" options={['Off', 'On'] as const} selected={carbonDioxide ? 'On' : 'Off'} choose={(v) => change(setCarbonDioxide, carbonDioxide)} />
        ) : null}
      </Card>
      <Button variant="primary" title="Run plant experiment" onPress={() => setRan(true)} />
      {ran ? (
        <Observation
          heading={ready ? 'Conditions support photosynthesis' : 'Photosynthesis is limited'}
          message={ready
            ? 'A green plant can use these inputs to make sugars. What energy source powers this process?'
            : 'One of the ingredients is missing. Which change would let the plant make sugars using light?'}
        />
      ) : null}
      <Text variant="caption" tone="muted">
        Simplified classroom model: chlorophyll, temperature, mineral nutrients and plant health also matter. Plants also respire.
      </Text>
    </View>
  );
}

function GeneticsExplorer() {
  const [first, setFirst] = useState<Genotype>('Aa');
  const [second, setSecond] = useState<Genotype>('Aa');
  const [prediction, setPrediction] = useState(0.5);
  const [ran, setRan] = useState(false);
  const distribution = offspringProbabilities(first, second);
  return (
    <View className="gap-stack">
      <Heading level={2} size="title">Explore a Punnett square</Heading>
      <Text>Choose two parent genotypes. Each gives one allele. Predict the share of offspring with two recessive alleles (aa).</Text>
      <Card className="gap-stack">
        <ChoiceRow label="Parent 1 genotype" options={GENOTYPES} selected={first} choose={(value) => { setFirst(value); setRan(false); }} />
        <ChoiceRow label="Parent 2 genotype" options={GENOTYPES} selected={second} choose={(value) => { setSecond(value); setRan(false); }} />
        <ChoiceRow label="My prediction for aa (%)" options={[0,25,50,75,100] as const} selected={Math.round(prediction * 100)} choose={(value) => { setPrediction(value / 100); setRan(false); }} />
      </Card>
      <Button variant="primary" title="Test inheritance prediction" onPress={() => setRan(true)} />
      {ran ? (
        <Card className="gap-stack">
          <Heading level={3} size="title">Possible combinations</Heading>
          <Text>AA: {Math.round(distribution.AA * 100)}% · Aa: {Math.round(distribution.Aa * 100)}% · aa: {Math.round(distribution.aa * 100)}%</Text>
          <Text>{distribution.aa === prediction
            ? 'Your prediction agrees with the model. Can you explain why each parent contributes one allele?'
            : 'Your prediction differed from the four possible allele pairs. Which combinations can make aa?'}</Text>
          <Text variant="caption" tone="muted">
            These are probabilities for a simplified single-gene Mendelian example,
            not guarantees for four real children or a model of all genetic traits.
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

export function BiologyExperiment({ ageBand }: { ageBand: AgeBand }) {
  return ageBand === 'young' || ageBand === 'child'
    ? <PhotosynthesisExplorer ageBand={ageBand} />
    : <GeneticsExplorer />;
}

export function PhysicsExperiment({ ageBand }: { ageBand: AgeBand }) {
  const [initialVelocity, setInitialVelocity] = useState(2);
  const [acceleration, setAcceleration] = useState(1);
  const [seconds, setSeconds] = useState(4);
  const [prediction, setPrediction] = useState<'more' | 'less' | null>(null);
  const [ran, setRan] = useState(false);
  const reset = (callback: () => void) => { callback(); setRan(false); };
  const result = motionAtTime(initialVelocity, acceleration, seconds);
  const compared = motionAtTime(initialVelocity, acceleration * 2, seconds);

  return (
    <View className="gap-stack">
      <Heading level={2} size="title">Motion lab · Rolling a cart</Heading>
      <Text>Set a cart's starting speed, acceleration and time. Predict how greater acceleration changes the distance travelled.</Text>
      <Card className="gap-stack">
        <ChoiceRow label="Starting speed (m/s)" options={[0, 2, 4] as const} selected={initialVelocity} choose={(value) => reset(() => setInitialVelocity(value))} />
        <ChoiceRow label="Acceleration (m/s²)" options={[0, 1, 2] as const} selected={acceleration} choose={(value) => reset(() => setAcceleration(value))} />
        <ChoiceRow label="Time (seconds)" options={[2, 4, 6] as const} selected={seconds} choose={(value) => reset(() => setSeconds(value))} />
      </Card>
      <ChoiceRow label="If acceleration doubles, distance will…" options={['more', 'less'] as const} selected={prediction ?? 'more'} choose={(value) => { setPrediction(value); setRan(false); }} />
      <Button variant="primary" title="Run cart experiment" disabled={prediction === null} onPress={() => setRan(true)} />
      {ran ? (
        <Card className="gap-stack">
          <Heading level={3} size="title">Measured by the motion model</Heading>
          <Text>Cart travels {result.meters.toFixed(1)} m. Final speed: {result.metersPerSecond.toFixed(1)} m/s.</Text>
          <View className="h-4 w-full overflow-hidden rounded-full bg-surface-sunken">
            <View className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, result.meters / 65 * 100)}%` }} />
          </View>
          <Text>With twice the acceleration: {compared.meters.toFixed(1)} m over the same time.</Text>
          <Text>{compared.meters > result.meters && prediction === 'more' || compared.meters < result.meters && prediction === 'less'
            ? 'Your prediction matches this idealized model. Why does time matter?'
            : 'Compare the two distances. What stayed the same, and what changed?'}</Text>
          <Text variant="caption" tone="muted">
            Idealized one-dimensional, constant-acceleration motion; no drag, rolling resistance or slopes.
          </Text>
        </Card>
      ) : null}
      {ageBand === 'teen' || ageBand === 'adult' ? (
        <Text tone="muted">Explore the relationship: distance = starting speed × time + ½ × acceleration × time².</Text>
      ) : null}
    </View>
  );
}

export function EarthExperiment({ ageBand }: { ageBand: AgeBand }) {
  const [latitude, setLatitude] = useState(40);
  const [prediction, setPrediction] = useState<'June' | 'December' | 'same' | null>(null);
  const [ran, setRan] = useState(false);
  const june = approximateDaylightHours(latitude, 'june');
  const december = approximateDaylightHours(latitude, 'december');
  const predicted = june > december + 0.1 ? 'June' : december > june + 0.1 ? 'December' : 'same';

  return (
    <View className="gap-stack">
      <Heading level={2} size="title">Earth & Space · Daylight explorer</Heading>
      <Text>
        Earth is tilted as it orbits the Sun. Choose a latitude and predict which
        solstice gives more daylight there.
      </Text>
      <Card className="gap-stack">
        <ChoiceRow
          label="Latitude (degrees)"
          options={[0, 40, 65, -40] as const}
          selected={latitude}
          choose={(value) => { setLatitude(value); setRan(false); }}
        />
        <Text variant="caption" tone="muted">Positive latitudes are north; negative latitudes are south.</Text>
        <ChoiceRow
          label="My prediction"
          options={['June', 'December', 'same'] as const}
          selected={prediction ?? 'June'}
          choose={(value) => { setPrediction(value); setRan(false); }}
        />
      </Card>
      <Button variant="primary" title="Compare daylight hours" disabled={prediction === null} onPress={() => setRan(true)} />
      {ran ? (
        <Card className="gap-stack">
          <Heading level={3} size="title">Calculated daylight</Heading>
          <Text>June solstice: {june.toFixed(1)} hours · December solstice: {december.toFixed(1)} hours.</Text>
          <View className="gap-element">
            <Text variant="label">June</Text>
            <View className="h-3 w-full rounded-full bg-surface-sunken">
              <View className="h-full rounded-full bg-primary" style={{ width: `${june / 24 * 100}%` }} />
            </View>
            <Text variant="label">December</Text>
            <View className="h-3 w-full rounded-full bg-surface-sunken">
              <View className="h-full rounded-full bg-primary" style={{ width: `${december / 24 * 100}%` }} />
            </View>
          </View>
          <Text>{prediction === predicted
            ? 'Your prediction agrees with this model. What do you expect in the opposite hemisphere?'
            : 'What does the comparison tell you? How would moving across the equator change your prediction?'}</Text>
          <Text variant="caption" tone="muted">
            Approximate spherical-Earth daylight model. Refraction, elevation,
            atmospheric conditions and twilight are not included.
          </Text>
        </Card>
      ) : null}
      {ageBand === 'young' ? <Text tone="muted">Try moving from north to south and compare the hours again.</Text> : null}
    </View>
  );
}
