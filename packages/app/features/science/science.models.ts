// Deterministic, offline-safe science calculations; no model or external APIs.
// This domain is independent from learner identity and is safe to reuse in Expo.
// SOT: docs/compute/moyo-science-lab.md
// SOT-KEYWORDS: science chemistry balancing genetics punnett photosynthesis physics acceleration seasons daylight

export const SCIENCE_SUBJECTS = [
  { id: 'chemistry', title: 'Chemistry', subtitle: 'Matter, atoms and reactions', symbol: '⚗' },
  { id: 'biology', title: 'Biology', subtitle: 'Living systems and inheritance', symbol: '🌱' },
  { id: 'physics', title: 'Physics', subtitle: 'Motion, forces and energy', symbol: '↗' },
  { id: 'earth', title: 'Earth & Space', subtitle: 'Our planet and the Sun', symbol: '☀' },
] as const;
export type ScienceSubject = (typeof SCIENCE_SUBJECTS)[number]['id'];

export const REACTIONS = {
  water: {
    title: 'Forming water',
    reactants: ['H₂', 'O₂'],
    product: 'H₂O',
    species: [
      { atoms: { H: 2, O: 0 }, side: 'left' },
      { atoms: { H: 0, O: 2 }, side: 'left' },
      { atoms: { H: 2, O: 1 }, side: 'right' },
    ],
  },
  ammonia: {
    title: 'Forming ammonia',
    reactants: ['N₂', 'H₂'],
    product: 'NH₃',
    species: [
      { atoms: { N: 2, H: 0 }, side: 'left' },
      { atoms: { N: 0, H: 2 }, side: 'left' },
      { atoms: { N: 1, H: 3 }, side: 'right' },
    ],
  },
} as const;

export type ReactionId = keyof typeof REACTIONS;
export type Coefficients = readonly [number, number, number];
export type AtomTally = Readonly<Record<string, number>>;

export function reactionCounts(id: ReactionId, coefficients: Coefficients): {
  reactants: AtomTally;
  products: AtomTally;
  balanced: boolean;
} {
  const species = REACTIONS[id].species;
  const left: Record<string, number> = {};
  const right: Record<string, number> = {};
  for (let i = 0; i < 3; i += 1) {
    const compound = species[i];
    const count = coefficients[i];
    // The UI only permits 1..6; non-finite or fractional values are never valid.
    if (!Number.isInteger(count) || count < 1 || count > 6) {
      throw new RangeError('A coefficient must be an integer from 1 to 6');
    }
    const tally = compound.side === 'left' ? left : right;
    for (const [element, perMolecule] of Object.entries(compound.atoms)) {
      tally[element] = (tally[element] ?? 0) + perMolecule * count;
    }
  }
  const atoms = new Set([...Object.keys(left), ...Object.keys(right)]);
  return {
    reactants: left,
    products: right,
    balanced: [...atoms].every((element) => left[element] === right[element]),
  };
}

export function isWaterMolecule(hydrogen: number, oxygen: number): boolean {
  return hydrogen === 2 && oxygen === 1;
}

export type Genotype = 'AA' | 'Aa' | 'aa';
export function offspringProbabilities(first: Genotype, second: Genotype): {
  AA: number;
  Aa: number;
  aa: number;
} {
  const counts = { AA: 0, Aa: 0, aa: 0 };
  for (const a of first) {
    for (const b of second) {
      const genotype: Genotype = a === 'A' && b === 'A'
        ? 'AA'
        : a === 'a' && b === 'a'
          ? 'aa'
          : 'Aa';
      counts[genotype] += 1;
    }
  }
  return { AA: counts.AA / 4, Aa: counts.Aa / 4, aa: counts.aa / 4 };
}

export function photosynthesisReady(light: boolean, water: boolean, carbonDioxide: boolean): boolean {
  return light && water && carbonDioxide;
}

export function motionAtTime(initialVelocity: number, acceleration: number, seconds: number): {
  meters: number;
  metersPerSecond: number;
} {
  if (![initialVelocity, acceleration, seconds].every(Number.isFinite) || seconds < 0) {
    throw new RangeError('Motion parameters must be finite; time cannot be negative');
  }
  return {
    meters: initialVelocity * seconds + 0.5 * acceleration * seconds * seconds,
    metersPerSecond: initialVelocity + acceleration * seconds,
  };
}

/** Idealized spherical-Earth solstice model: no refraction, elevation or twilight. */
export function approximateDaylightHours(latitudeDegrees: number, solstice: 'june' | 'december'): number {
  if (!Number.isFinite(latitudeDegrees) || Math.abs(latitudeDegrees) > 90) {
    throw new RangeError('Latitude must be between -90 and 90 degrees');
  }
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const declination = solstice === 'june' ? 23.44 : -23.44;
  const hourAngleCosine = -Math.tan(radians(latitudeDegrees)) * Math.tan(radians(declination));
  if (hourAngleCosine <= -1) return 24;
  if (hourAngleCosine >= 1) return 0;
  return 24 * Math.acos(hourAngleCosine) / Math.PI;
}
