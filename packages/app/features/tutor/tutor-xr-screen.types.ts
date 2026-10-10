// What the spatial screen needs, in a file neither platform's renderer owns.
//
// The web fork of the entry must not import the native screen even for a type:
// a type-only import is erased at build, but it is still a specifier a bundler
// resolves, and resolving the native screen means resolving Viro on web. So the
// props live here and all three files — native screen, native entry, web entry
// — read them from the same place.
// SOT: packages/app/features/tutor/tutor-xr-screen.native.tsx
// SOT-KEYWORDS: tutor xr screen props types platform neutral no viro

import type { ComponentType, ReactNode } from 'react';
import type { BoardChromeHandlers, BoardChromePresentation, XrSurfaceInput } from '@acme/ui/xr';
import type { AgeBand } from '../capture/age-band.ts';

export interface TutorXrScreenProps {
  ageBand: AgeBand;
  /** Leaving the headset. The route pops; the session keeps running. */
  onExit: () => void;
  /** The existing export-and-submit path, unchanged. */
  onAsk: (png: string | null, spoken?: string) => void;
  asking?: boolean;
  /** Loaded only inside XR; native assets and Rive stay out of the web entry. */
  loadQuestionPanel?: () => Promise<ComponentType<TutorXrQuestionPanelProps> | null>;
  loadBoardPanel?: () => Promise<ComponentType<TutorXrBoardPanelProps> | null>;
}

/** Production host contract: one engine, one calibrated content rectangle. */
export interface TutorXrBoardPanelProps {
  slot: { position: readonly [number, number, number]; yaw: number };
  bound: boolean;
  enabled: boolean;
  content: ReactNode;
  termination?: { source: number; cancel: boolean; revision: number };
  onSurfaceInput(sample: XrSurfaceInput): void;
  handlers: BoardChromeHandlers;
  presentation: BoardChromePresentation;
  onError(): void;
}

export interface TutorXrQuestionPanelProps {
  slot: { position: readonly [number, number, number]; yaw: number };
  question: string;
  skill: string;
  enabled: boolean;
  busy: boolean;
  listening: boolean;
  status: string;
  hasMarks: boolean;
  onVoice(): void;
  /** LISTEN/RETRY up-or-exit edge — push-to-talk pairs down/up. */
  onVoiceEnd?(): void;
  onHint(): void;
  onSubmit(): void;
  onBoard(): void;
  onError(): void;
}
