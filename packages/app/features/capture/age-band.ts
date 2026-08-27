// Age-band helpers for capture surfaces.
// SOT: docs/pack/08-visual-hierarchy-spacing-spec.md §2.4
// SOT-KEYWORDS: age band capture young child teen adult target size labels voice band

import type { VoiceBand } from '@acme/student-model';

export type AgeBand = 'young' | 'child' | 'teen' | 'adult';

const BAND_FALLBACK: AgeBand = 'teen';

export function asAgeBand(value?: string | null): AgeBand {
  if (value === 'young' || value === 'child' || value === 'teen' || value === 'adult') return value;
  return BAND_FALLBACK;
}

export function buttonSizeForBand(ageBand: AgeBand): 'sm' | 'md' | 'lg' | 'xl' {
  switch (ageBand) {
    case 'young':
      return 'xl';
    case 'child':
      return 'xl';
    case 'teen':
      return 'lg';
    case 'adult':
    default:
      return 'md';
  }
}

export interface CaptureLabels {
  camera: string;
  photoLibrary: string;
  file: string;
  type: string;
  voice: string;
  prompt: string;
}

export type RealtimeHintKey = 'closer' | 'steady' | 'one' | 'light' | 'glare';

export function realtimeHintForBand(key: RealtimeHintKey, ageBand: AgeBand): string {
  const labels: Record<RealtimeHintKey, Record<AgeBand, string>> = {
    closer: {
      young: 'Move a little closer',
      child: 'Move closer so the page fits',
      teen: 'Move closer',
      adult: 'Move closer',
    },
    steady: {
      young: 'Hold still',
      child: 'Hold the phone steady',
      teen: 'Hold steady',
      adult: 'Hold steady',
    },
    one: {
      young: 'One problem at a time',
      child: 'Show one problem at a time',
      teen: 'One problem per shot',
      adult: 'One problem per shot',
    },
    light: {
      young: 'Need more light?',
      child: 'Make sure it is bright',
      teen: 'Check the lighting',
      adult: 'Check the lighting',
    },
    glare: {
      young: 'No shiny spots',
      child: 'Avoid glare on the page',
      teen: 'Avoid glare',
      adult: 'Avoid glare',
    },
  };
  return labels[key][ageBand];
}

export function captureLabelsForBand(ageBand: AgeBand): CaptureLabels {
  switch (ageBand) {
    case 'young':
      return {
        camera: 'Take a picture',
        photoLibrary: 'Choose a photo',
        file: 'Pick a file',
        type: 'Type the words',
        voice: 'Say it out loud',
        prompt: 'How do you want to add your work?',
      };
    case 'child':
      return {
        camera: 'Take a photo',
        photoLibrary: 'Photo library',
        file: 'Upload a file',
        type: 'Type it',
        voice: 'Say it',
        prompt: 'How do you want to add your work?',
      };
    case 'adult':
      return {
        camera: 'Camera',
        photoLibrary: 'Photo library',
        file: 'File',
        type: 'Type',
        voice: 'Voice',
        prompt: 'Choose an input method',
      };
    case 'teen':
    default:
      return {
        camera: 'Camera',
        photoLibrary: 'Photo library',
        file: 'File',
        type: 'Type it',
        voice: 'Say it',
        prompt: 'How do you want to add your work?',
      };
  }
}

/**
 * Doc 08's four presentation bands map onto doc 31 §2.1's four voice bands.
 * They stay different types: the UI band decides how big a button is, the voice
 * band decides how the tutor talks, and conflating them is how a type-scale
 * change silently rewrites a six-year-old's reading level.
 *
 * This used to collapse to the plane's two-value register instead, which threw
 * away the distinction doc 31 was written to restore — `child` and `teen` both
 * became `older`, so a nine-year-old and a seventeen-year-old were handed the
 * same prompt. The two-value register still exists and is still two values, but
 * it is now derived from the band at the coaching boundary rather than stored
 * in place of it (`planeRegisterFor` in `@acme/student-model`).
 *
 * `adult` maps to 9-12 because doc 08's adult band is the Cool dial — an
 * educator or a guardian — and the register they should meet is the unsimplified
 * one, which is what 9-12 is.
 */
export function voiceBandFor(ageBand: AgeBand): VoiceBand {
  switch (ageBand) {
    case 'young':
      return 'k-2';
    case 'child':
      return '3-5';
    case 'teen':
      return '6-8';
    case 'adult':
    default:
      return '9-12';
  }
}
