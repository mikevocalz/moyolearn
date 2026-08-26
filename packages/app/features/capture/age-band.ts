// Age-band helpers for capture surfaces.
// SOT: docs/pack/08-visual-hierarchy-spacing-spec.md §2.4
// SOT-KEYWORDS: age band capture young child teen adult target size labels

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
 * Doc 08's four presentation bands collapse to doc 07 §3's two-value policy
 * register. They are different things and stay different types: the UI band
 * decides how big a button is, the plane band decides the tutor's voice and
 * which crisis wording a child is shown.
 *
 * `child` maps to `young` rather than `older` because the register is a safety
 * default — a nine-year-old shown the teenage crisis script is the failure
 * worth avoiding, and a teenager shown a slightly plainer one is not.
 */
export function planeBandFor(ageBand: AgeBand): 'young' | 'older' {
  return ageBand === 'young' || ageBand === 'child' ? 'young' : 'older';
}
