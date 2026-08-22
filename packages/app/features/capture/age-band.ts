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
