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

/**
 * The five choices on the "Choose how to share work" hub.
 * The build prompt asks for these exact learner-facing labels:
 * Take photo, Choose photos, Upload PDF/file, Type/paste, Describe by voice.
 */
export interface CaptureLabels {
  takePhoto: string;
  choosePhotos: string;
  uploadFile: string;
  typePaste: string;
  describeVoice: string;
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
        takePhoto: 'Take photo',
        choosePhotos: 'Choose photos',
        uploadFile: 'Upload PDF/file',
        typePaste: 'Type or paste',
        describeVoice: 'Describe by voice',
        prompt: 'How do you want to share your work?',
      };
    case 'child':
      return {
        takePhoto: 'Take photo',
        choosePhotos: 'Choose photos',
        uploadFile: 'Upload PDF/file',
        typePaste: 'Type or paste',
        describeVoice: 'Describe by voice',
        prompt: 'How do you want to share your work?',
      };
    case 'adult':
      return {
        takePhoto: 'Take photo',
        choosePhotos: 'Choose photos',
        uploadFile: 'Upload PDF/file',
        typePaste: 'Type or paste',
        describeVoice: 'Describe by voice',
        prompt: 'Choose how to share your work',
      };
    case 'teen':
    default:
      return {
        takePhoto: 'Take photo',
        choosePhotos: 'Choose photos',
        uploadFile: 'Upload PDF/file',
        typePaste: 'Type or paste',
        describeVoice: 'Describe by voice',
        prompt: 'How do you want to share your work?',
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

/**
 * The exact inverse of `voiceBandFor`, for reading the persisted band back into
 * the presentation register — the live session bootstrap turns the server's
 * doc 31 voice band into the band the shell IA and touch targets key off
 * (doc 36 §3.1 maps k-2→young … 9-12→adult, same table).
 *
 * `undefined` for an unreadable value rather than a coerced band: "no band"
 * already has a meaning at every call site (the shell's teen default), and a
 * value the server never wrote is transport noise, not a learner's answer —
 * `asVoiceBand` owns coercion for values the server READ, not ones a response
 * body carried.
 */
export function ageBandForVoiceBand(value?: string | null): AgeBand | undefined {
  switch (value) {
    case 'k-2':
      return 'young';
    case '3-5':
      return 'child';
    case '6-8':
      return 'teen';
    case '9-12':
      return 'adult';
    default:
      return undefined;
  }
}
