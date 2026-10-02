import type { ReactNode } from 'react';

export interface MoyoSpecsTutorRoomProps {
  /** World-space head origin in Viro metres. */
  headPosition: readonly [number, number, number];
  /** Head yaw in degrees; turns the existing Moyo comfort arc as one unit. */
  headYawDeg: number;
  tutorName: string;
  tutorLine: string;
  assignmentTitle: string;
  question: string;
  progressLabel?: string;
  onAskTutor?: () => void;
  onOpenAssignment?: () => void;
  onBoardSelect?: () => void;
  /** Optional extra Viro-authored content placed on the centre board. */
  boardContent?: ReactNode;
}

export interface MoyoSpecsCompiledScene {
  scene: unknown;
  polylines: unknown[];
  bindings: unknown[];
  diagnostics: string[];
  handlers: Map<string, unknown>;
}
